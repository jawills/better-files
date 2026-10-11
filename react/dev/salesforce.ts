import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { MAX_UPLOAD_BYTES, validateUpload } from "../src/upload.ts";
import { defaultSettings } from "../src/model.ts";
import {
  liveRecord,
  contentUrl,
  type LiveFiles
} from "../src/demo/live-record.ts";

const run = promisify(execFile);
const api = "/services/data/v67.0";
const mimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/plain"
};
type Org = { id: string; instanceUrl: string };
type FileLink = {
  LinkedEntityId: string;
  ContentDocument: {
    Id: string;
    LatestPublishedVersionId: string;
    Title: string;
    FileExtension: string | null;
    ContentSize: number;
    LastModifiedDate: string;
  };
};

/** Only same-origin requests to a loopback host can use the CLI-backed adapter. */
export function isLocalRequest(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  return !request.headers.origin || request.headers.origin === `http://${host}`;
}

/** Development adapter pinned to the approved org and account. */
export function salesforceDev(): Plugin {
  let filesPromise: Promise<LiveFiles> | undefined;

  // Let the CLI own authentication and refresh; no token enters the Vite client.
  async function cli<T>(args: string[]): Promise<T> {
    const { stdout } = await run(
      "sf",
      [...args, "--target-org", "better-files", "--json"],
      {
        timeout: 60_000,
        maxBuffer: 10 * 1024 ** 2
      }
    );
    const response = JSON.parse(stdout) as { status: number; result: T };
    if (response.status !== 0)
      throw new Error("Salesforce CLI request failed.");
    return response.result;
  }

  async function query<T>(soql: string): Promise<T[]> {
    const result = await cli<{ records: T[] }>([
      "data",
      "query",
      "--query",
      soql
    ]);
    return result.records;
  }

  function loadFiles() {
    return (filesPromise ??= (async (): Promise<LiveFiles> => {
      const org = await cli<Org>(["org", "display"]);
      if (org.id !== "00DfL000008l38pUAA")
        throw new Error("Unexpected org for better-files.");
      const [accounts, emails] = await Promise.all([
        query<{ Name: string }>(
          `SELECT Name FROM Account WHERE Id = '${liveRecord.recordId}'`
        ),
        query<{ Id: string }>(
          `SELECT Id FROM EmailMessage WHERE RelatedToId = '${liveRecord.recordId}' AND HasAttachment = true`
        )
      ]);
      if (!accounts[0]) throw new Error("The test account is not accessible.");
      const ids = [liveRecord.recordId, ...emails.map((row) => row.Id)];
      const links = await query<FileLink>(
        `SELECT LinkedEntityId, ContentDocument.Id, ContentDocument.LatestPublishedVersionId, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.ContentSize, ContentDocument.LastModifiedDate FROM ContentDocumentLink WHERE LinkedEntityId IN (${ids.map((id) => `'${id}'`).join(",")}) AND ContentDocument.FileType != 'SNOTE' ORDER BY SystemModstamp DESC`
      );
      const files = new Map<string, LiveFiles["files"][number]>();
      for (const link of links) {
        const doc = link.ContentDocument;
        const versionId = doc.LatestPublishedVersionId;
        if (!versionId) continue;
        const source =
          link.LinkedEntityId === liveRecord.recordId ? "record" : "email";
        if (files.has(versionId) && source !== "email") continue;
        const extension = doc.FileExtension?.toLowerCase() ?? "";
        files.set(versionId, {
          versionId,
          documentId: doc.Id,
          title: doc.Title,
          extension,
          sizeBytes: doc.ContentSize,
          modifiedAt: doc.LastModifiedDate,
          source,
          thumbnailUrl:
            mimeTypes[extension]?.startsWith("image/") &&
            doc.ContentSize <= 5 * 1024 ** 2
              ? contentUrl(versionId)
              : undefined
        });
      }
      return {
        recordName: accounts[0].Name,
        recordUrl: `${org.instanceUrl}/lightning/r/Account/${liveRecord.recordId}/related`,
        files: [...files.values()]
      };
    })().finally(() => {
      filesPromise = undefined;
    }));
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (!isLocalRequest(req)) {
      res.writeHead(403).end();
      return;
    }
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/__salesforce/upload" && req.method === "POST") {
      await upload(req, res);
      return;
    }
    if (req.method !== "GET") {
      res.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    const match =
      /^\/__salesforce\/content\/(068[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?)$/.exec(
        path
      );
    if (path !== "/__salesforce/files" && !match) {
      res.writeHead(404).end();
      return;
    }
    try {
      const data = await loadFiles();
      if (!match) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
        return;
      }
      const file = data.files.find((item) => item.versionId === match[1]);
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        mimeTypes[file.extension] ?? "application/octet-stream"
      );
      const name = file.title.toLowerCase().endsWith(`.${file.extension}`)
        ? file.title
        : `${file.title}.${file.extension}`;
      res.setHeader(
        "Content-Disposition",
        `${mimeTypes[file.extension] ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, "%27")}`
      );
      if (mimeTypes[file.extension] === "text/plain") {
        res.setHeader("Content-Security-Policy", "sandbox");
      }
      const directory = await mkdtemp(join(tmpdir(), "better-files-preview-"));
      try {
        const path = join(directory, "content");
        await cli<unknown>([
          "api",
          "request",
          "rest",
          `${api}/sobjects/ContentVersion/${file.versionId}/VersionData`,
          "--method",
          "GET",
          "--stream-to-file",
          path
        ]);
        res.setHeader("Content-Length", (await stat(path)).size);
        await pipeline(createReadStream(path), res);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    } catch {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message:
            "Unable to read files from better-files. Check the Salesforce CLI login, then try again."
        })
      );
    }
  }
  let uploading = false;
  async function upload(req: IncomingMessage, res: ServerResponse) {
    const reply = (status: number, message: string) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message }));
    };
    if (req.headers.origin !== `http://${req.headers.host}`) {
      reply(403, "Upload must originate from this local preview.");
      return;
    }
    if (req.headers["content-type"] !== "application/json") {
      reply(415, "Expected a JSON upload.");
      return;
    }
    if (uploading) {
      reply(409, "Another upload is running. Wait for it to finish.");
      return;
    }
    uploading = true;
    let directory: string | undefined;
    try {
      const chunks: Buffer[] = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4096) {
          reply(413, "The upload limit for this test is 2 MB per file.");
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        reply(400, "Invalid upload request.");
        return;
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("filename" in body) ||
        !("base64" in body) ||
        typeof body.filename !== "string" ||
        typeof body.base64 !== "string" ||
        body.base64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)
      ) {
        reply(400, "Invalid file data.");
        return;
      }
      const bytes = Buffer.from(body.base64, "base64");
      const error = validateUpload(
        { name: body.filename, size: bytes.length, type: "" },
        defaultSettings
      );
      if (error) {
        reply(400, error);
        return;
      }
      const org = await cli<Org>(["org", "display"]);
      if (org.id !== "00DfL000008l38pUAA") {
        reply(
          403,
          "The better-files alias does not point to the approved development org."
        );
        return;
      }
      directory = await mkdtemp(join(tmpdir(), "better-files-upload-"));
      const file = join(directory, "request.json");
      await writeFile(
        file,
        JSON.stringify({
          Title: body.filename,
          PathOnClient: body.filename,
          VersionData: body.base64,
          FirstPublishLocationId: liveRecord.recordId
        }),
        { mode: 0o600 }
      );
      // Creation and the initial record link are one Salesforce operation.
      await cli<unknown>([
        "api",
        "request",
        "rest",
        `${api}/sobjects/ContentVersion`,
        "--method",
        "POST",
        "--body",
        `@${file}`
      ]);
      reply(201, "File uploaded successfully.");
    } catch {
      reply(
        502,
        "Could not confirm the upload. Refresh files before trying again."
      );
    } finally {
      uploading = false;
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }
  return {
    name: "better-files-local-salesforce",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__salesforce/")) {
          next();
          return;
        }
        void handle(req, res);
      });
    }
  };
}
