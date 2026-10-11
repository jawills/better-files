import { useEffect, useRef, useState } from "react";
import { UploadFileCard } from "@/components/upload-file-card";
import { fileToBase64 } from "@/upload";
import { FileSurface } from "@/components/file-surface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import type { FileListState, FileRecord, FileSettings } from "@/model";
import { contentUrl, liveRecord, type LiveFiles } from "./live-record";

type LiveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LiveFiles };

/** Share one read across both test cards; cancel obsolete reads when switching fixtures. */
export function useLiveFiles(enabled: boolean) {
  const [state, setState] = useState<LiveState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const response = await fetch("/__salesforce/files", {
          signal: controller.signal
        });
        if (!response.ok)
          throw new Error(
            "Unable to read better-files. Check the Salesforce CLI login and try again."
          );
        const data = (await response.json()) as LiveFiles;
        if (!controller.signal.aborted) setState({ status: "ready", data });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Unable to load files."
          });
      }
    })();
    return () => controller.abort();
  }, [enabled, revision]);
  return { state, refresh: () => setRevision((value) => value + 1) };
}

export function LiveCard({
  state,
  settings,
  refresh
}: {
  state: LiveState;
  settings: FileSettings;
  refresh: () => void;
}) {
  const [selected, setSelected] = useState<FileRecord | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  let cardState: FileListState =
    state.status === "ready" ? { status: "loading" } : state;
  if (state.status === "ready") {
    const eligible = state.data.files.filter(
      (file) =>
        (settings.includeEmails || file.source !== "email") &&
        file.sizeBytes >= settings.minimumFileSizeKb * 1024
    );
    cardState = {
      status: "ready",
      files: eligible.slice(0, settings.fileLimit),
      total: eligible.length
    };
  }
  return (
    <FileSurface
      onClickCapture={(event) => {
        if (event.target instanceof Element) {
          const button = event.target.closest<HTMLButtonElement>(".bf-file");
          if (button) trigger.current = button;
        }
      }}
    >
      <UploadFileCard
        context={liveRecord}
        settings={settings}
        state={cardState}
        upload={{
          send: async (file) => {
            const response = await fetch("/__salesforce/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                base64: await fileToBase64(file)
              })
            });
            const result = (await response.json()) as { message?: string };
            if (!response.ok)
              throw new Error(
                result.message ??
                  "Upload failed. Refresh files before trying again."
              );
          },
          refresh
        }}
        actions={{
          preview: setSelected,
          retry: refresh,
          requestUpload: () => {},
          viewAll: () => {
            if (state.status === "ready")
              window.open(
                state.data.recordUrl,
                "_blank",
                "noopener,noreferrer"
              );
          }
        }}
      />
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent finalFocus={trigger} className="local-file-dialog">
          <DialogTitle className="bf-dialog-title">
            {selected?.title}
          </DialogTitle>
          <DialogDescription className="bf-dialog-description">
            File from better-files.
          </DialogDescription>
          {selected &&
            (/^(png|jpg|jpeg|gif|webp)$/.test(selected.extension) ? (
              <img
                className="local-file-image"
                src={contentUrl(selected.versionId)}
                alt={selected.title}
              />
            ) : /^(pdf|txt|csv)$/.test(selected.extension) ? (
              <iframe
                className="local-file-frame"
                src={contentUrl(selected.versionId)}
                title={selected.title}
              />
            ) : (
              <p>This file type can be downloaded to view.</p>
            ))}
          {selected && (
            <a href={contentUrl(selected.versionId)} download>
              Download file
            </a>
          )}
        </DialogContent>
      </Dialog>
    </FileSurface>
  );
}
