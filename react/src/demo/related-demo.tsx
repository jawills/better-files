import { useMemo, useState } from "react";
import { FileSurface } from "@/components/file-surface";
import { RelatedList } from "@/components/related-list";
import { cn } from "@/lib/utils";
import { defaultSettings, type FileTheme } from "@/model";
import {
  defaultRelatedConfig,
  relatedPageSize,
  type RelatedFile,
  type RelatedListProps
} from "@/related-list";
import { fixtureContext, fixtureFiles } from "./fixtures";

export function RelatedDemo({ theme }: { theme: FileTheme }) {
  const [notice, setNotice] = useState("");
  const adapter = useMemo<RelatedListProps["adapter"]>(() => {
    let files: RelatedFile[] = Array.from({ length: 58 }, (_, i) => ({
      ...fixtureFiles[i % fixtureFiles.length],
      documentId: `d${i}`,
      versionId: `v${i}`,
      title: `${fixtureFiles[i % fixtureFiles.length].title}${i >= fixtureFiles.length ? ` (${i + 1})` : ""}`,
      owner: { name: "Justin Wills" },
      modifiedBy: { name: i % 2 ? "Sarah Chen" : "Justin Wills" }
    }));
    return {
      info: async () => ({
        recordName: "Acme",
        config: defaultRelatedConfig,
        extensions: []
      }),
      load: async (query) => {
        const images = new Set(["jpg", "png", "jpeg", "gif"]);
        const matched = files.filter(
          (file) =>
            file.title.toLowerCase().includes(query.searchTerm.toLowerCase()) &&
            (query.fileTypeFilter === "all" ||
              (query.fileTypeFilter === "image"
                ? images.has(file.extension)
                : !images.has(file.extension)))
        );
        const value = (file: RelatedFile) =>
          ({
            Title: file.title,
            Owner: file.owner.name,
            LastModifiedBy: file.modifiedBy.name,
            LastModifiedDate: file.modifiedAt,
            ContentSize: file.sizeBytes
          })[query.sortBy];
        matched.sort((a, b) => {
          const av = value(a),
            bv = value(b);
          return (
            (typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv))) *
            (query.sortDirection === "asc" ? 1 : -1)
          );
        });
        return {
          files: matched.slice(
            query.page * relatedPageSize,
            (query.page + 1) * relatedPageSize
          ),
          total: matched.length
        };
      },
      delete: async (rows) => {
        const ids = new Set(rows.map((f) => f.documentId));
        files = files.filter((f) => !ids.has(f.documentId));
      },
      upload: async (file) => {
        const id = crypto.randomUUID();
        files = [
          {
            documentId: id,
            versionId: id,
            title: file.name,
            extension: file.name.split(".").pop() ?? "",
            sizeBytes: file.size,
            modifiedAt: new Date().toISOString(),
            source: "record",
            owner: { name: "Justin Wills" },
            modifiedBy: { name: "Justin Wills" }
          },
          ...files
        ];
      }
    };
  }, []);
  return (
    <main className="bf:mx-auto bf:box-border bf:max-w-[1280px] bf:p-6 bf:max-[601px]:p-4">
      <h1 className="bf:mt-0 bf:mb-2 bf:text-[23px]">
        Better Files{" "}
        <span className="bf:ml-3 bf:text-sm bf:font-normal">Related list</span>
      </h1>
      <p className="bf:mt-0 bf:mb-6">
        Fixture preview. Uploads and deletes affect this preview only.{" "}
        <a href={`/?theme=${theme}`}>Record card</a>
      </p>
      {notice && <p role="status">{notice}</p>}
      <FileSurface
        theme={theme}
        className={cn(
          theme !== "better-files" && "bf:rounded-[6px] bf:bg-(--page) bf:p-4"
        )}
      >
        <RelatedList
          context={fixtureContext}
          settings={{ ...defaultSettings, theme }}
          adapter={adapter}
          actions={{
            preview: (file) => setNotice(`Preview requested: ${file.title}`),
            download: (files) =>
              setNotice(`Download requested: ${files.length} files`),
            record: () => setNotice("Record navigation requested: Acme"),
            object: () => setNotice("Object navigation requested: Accounts")
          }}
        />
      </FileSurface>
    </main>
  );
}
