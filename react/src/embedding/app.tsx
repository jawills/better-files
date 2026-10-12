import type { ViewSDK, DataSDK } from "@salesforce/platform-sdk/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileSurface } from "../components/file-surface";
import { UploadFileCard } from "../components/upload-file-card";
import { RelatedList } from "../components/related-list";
import { RenderBoundary } from "../components/render-boundary";
import {
  defaultSettings,
  type FileCardProps,
  type FileSettings,
  type RecordContext
} from "../model";
import {
  fromSalesforceFile,
  fromSalesforceRelatedFile,
  type SalesforceFileRow
} from "../salesforce";
import type { RelatedListProps } from "../related-list";
import { createHostTransport, type HostOperations } from "./transport";
import { EMBEDDED_MAX_UPLOAD_BYTES, uploadBinary } from "./upload";
import "../styles.css";
import "./styles.css";

type HostProps = {
  view: "card" | "related";
  context: RecordContext;
  settings: Partial<FileSettings>;
  state?:
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; rows: SalesforceFileRow[]; total: number };
  initialFilter?: string;
  revision?: number;
  lightningOrigin: string;
};
function hostProps(input: unknown): HostProps | undefined {
  let value: unknown;
  try {
    value =
      input &&
      typeof input === "object" &&
      "payload" in input &&
      typeof input.payload === "string"
        ? JSON.parse(input.payload)
        : undefined;
  } catch {
    return;
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("view" in value) ||
    (value.view !== "card" && value.view !== "related") ||
    !("context" in value) ||
    !value.context ||
    typeof value.context !== "object" ||
    !("recordId" in value.context) ||
    typeof value.context.recordId !== "string" ||
    !value.context.recordId ||
    !("lightningOrigin" in value) ||
    typeof value.lightningOrigin !== "string"
  )
    return;
  return value as HostProps;
}

function EmbeddedFiles({ sdk, data }: { sdk: ViewSDK; data: DataSDK }) {
  const [props, setProps] = useState<HostProps>();
  useEffect(() => {
    const ui = sdk.getUiState?.();
    if (!ui) return;
    document.documentElement.classList.add("bf-embedded");
    setProps(hostProps(ui.state.props));
    const unsubscribe = ui.subscribe((next) => setProps(hostProps(next.props)));
    return () => {
      unsubscribe();
      document.documentElement.classList.remove("bf-embedded");
    };
  }, [sdk]);
  if (!props)
    return (
      <p className="embedding-status">
        Open Files from a Salesforce record page.
      </p>
    );
  const key = `${props.view}:${props.context.recordId}:${props.settings.includeEmails}:${props.settings.minimumFileSizeKb}`;
  return <ConnectedFiles key={key} sdk={sdk} data={data} host={props} />;
}

function ConnectedFiles({
  sdk,
  data,
  host
}: {
  sdk: ViewSDK;
  data: DataSDK;
  host: HostProps;
}) {
  const transport = useMemo(
    () => createHostTransport(sdk, host.context),
    [sdk, host.context.recordId]
  );
  const abort = useRef(new AbortController());
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    abort.current = new AbortController();
    transport.connect();
    return () => {
      abort.current.abort();
      transport.dispose();
    };
  }, [abort, transport]);
  const settings = { ...defaultSettings, ...host.settings };
  const { request } = transport;
  const send = useMemo(
    () => async (file: File) => {
      const fetchSalesforce = data.fetch?.bind(data);
      if (!fetchSalesforce)
        throw new Error(
          "Salesforce upload transport is unavailable. Refresh the page."
        );
      await uploadBinary(
        file,
        (input, init) => fetchSalesforce(input, init),
        (input) => request("completeUpload", input),
        abort.current.signal
      );
    },
    [data, request, abort]
  );
  const relatedAdapter = useMemo<RelatedListProps["adapter"]>(
    () => ({
      info: () => request("info"),
      load: async (query) => {
        const result = await request("load", query);
        return {
          total: result.total,
          files: result.rows.map((row) =>
            withThumbnailOrigin(
              fromSalesforceRelatedFile(row),
              host.lightningOrigin
            )
          )
        };
      },
      delete: (files) => request("delete", files),
      upload: send,
      maxUploadBytes: EMBEDDED_MAX_UPLOAD_BYTES
    }),
    [request, send, host.lightningOrigin]
  );
  function action<K extends keyof HostOperations>(
    operation: K,
    ...args: HostOperations[K]["args"]
  ) {
    setActionError("");
    request(operation, ...args).catch((error) =>
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to complete the action."
      )
    );
  }
  const state: FileCardProps["state"] =
    host.state?.status === "ready"
      ? {
          status: "ready",
          total: host.state.total,
          files: host.state.rows.map((row) =>
            withThumbnailOrigin(fromSalesforceFile(row), host.lightningOrigin)
          )
        }
      : (host.state ?? { status: "loading" });
  return (
    <FileSurface>
      {actionError && <p role="alert">{actionError}</p>}
      {host.view === "card" ? (
        <UploadFileCard
          context={host.context}
          settings={settings}
          state={state}
          upload={{
            send,
            maxBytes: EMBEDDED_MAX_UPLOAD_BYTES,
            refresh: () => request("refresh")
          }}
          actions={{
            preview: (file) => action("preview", file),
            viewAll: () => action("viewAll"),
            requestUpload: () => {},
            retry: () => action("retry")
          }}
        />
      ) : (
        <RelatedList
          context={host.context}
          settings={settings}
          initialFilter={host.initialFilter}
          revision={host.revision}
          adapter={relatedAdapter}
          actions={{
            preview: (file) => action("preview", file),
            download: (files) => action("download", files),
            record: () => action("record"),
            object: () => action("object")
          }}
        />
      )}
    </FileSurface>
  );
}

function withThumbnailOrigin<T extends { thumbnailUrl?: string }>(
  file: T,
  origin: string
): T {
  return {
    ...file,
    thumbnailUrl: file.thumbnailUrl
      ? new URL(file.thumbnailUrl, origin).href
      : undefined
  };
}

async function connectToSalesforce() {
  await import("@salesforce/platform-sdk/ui-embedding");
  const { getViewSDK } = await import("@salesforce/platform-sdk/view");
  const sdk = await getViewSDK();
  const { createDataSDK } = await import("@salesforce/platform-sdk/data");
  const data = await createDataSDK();
  return { sdk, data };
}

function SalesforceConnection() {
  const [connection, setConnection] = useState<{
    sdk: ViewSDK;
    data: DataSDK;
  }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setFailed(true);
    }, 20000);
    connectToSalesforce()
      .then(({ sdk, data }) => {
        if (active) {
          setConnection({ sdk, data });
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);
  if (connection) return <EmbeddedFiles {...connection} />;
  return (
    <p className="embedding-status" role={failed ? "alert" : "status"}>
      {failed
        ? "Unable to connect to Salesforce. Refresh the page to try again."
        : "Loading files…"}
    </p>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("Files root element is missing.");
createRoot(container).render(
  <RenderBoundary>
    <SalesforceConnection />
  </RenderBoundary>
);
