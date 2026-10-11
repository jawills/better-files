import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileCard } from "./file-card";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "./ui/dialog";
import { usePortalContainer } from "./portal-context";
import { validateUpload } from "@/upload";
import type { FileCardProps } from "@/model";

type Row = {
  name: string;
  status: "waiting" | "uploading" | "uploaded" | "failed";
  message?: string;
};
type Toast = { id: number; kind: "success" | "error"; message: string };

/** Shared interaction layer; each host supplies its own upload and refresh transport. */
export function UploadFileCard(props: FileCardProps) {
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshError, setRefreshError] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const region = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const depth = useRef(0);
  const alive = useRef(true);
  const toastId = useRef(0);
  const portal = usePortalContainer();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const dismiss = (id: number) =>
    setToasts((items) => items.filter((item) => item.id !== id));
  useEffect(() => {
    const timers = toasts
      .filter((item) => item.kind === "success")
      .map((item) => setTimeout(() => dismiss(item.id), 8000));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);
  function notify(kind: Toast["kind"], message: string) {
    if (alive.current)
      setToasts((items) => [
        ...items.slice(-2),
        { id: ++toastId.current, kind, message }
      ]);
  }
  async function start(files: File[]) {
    const adapter = props.upload;
    if (!files.length || !adapter || busy.current) return;
    busy.current = true;
    setRunning(true);
    setOpen(true);
    setRefreshError("");
    setDragging(false);
    depth.current = 0;
    const initial: Row[] = files.map((file) => {
      const message =
        !props.settings.multiple && files.length > 1
          ? "Choose one file at a time."
          : validateUpload(file, props.settings);
      return {
        name: file.name,
        status: message ? "failed" : "waiting",
        message
      };
    });
    setRows(initial);
    const update = (index: number, row: Row) => {
      if (alive.current)
        setRows((current) =>
          current.map((value, i) => (i === index ? row : value))
        );
    };
    let uploaded = false;
    try {
      for (const [index, file] of files.entries()) {
        if (!alive.current) break;
        const row = initial[index];
        if (row.status === "failed") {
          notify("error", `${file.name}: ${row.message}`);
          continue;
        }
        update(index, { name: file.name, status: "uploading" });
        try {
          await adapter.send(file, props.context);
          uploaded = true;
          update(index, { name: file.name, status: "uploaded" });
          notify("success", `${file.name} uploaded successfully.`);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Upload failed. Refresh files before trying again.";
          update(index, { name: file.name, status: "failed", message });
          notify("error", `${file.name}: ${message}`);
        }
      }
      if (uploaded) {
        try {
          await adapter.refresh();
        } catch {
          if (alive.current)
            setRefreshError(
              "Files were uploaded, but the list could not refresh. Refresh the page to see them."
            );
        }
      }
    } finally {
      busy.current = false;
      if (alive.current) setRunning(false);
    }
  }
  const toastView = (
    <div className="bf-upload-toasts">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`bf-upload-toast bf-upload-toast-${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label={`Dismiss ${toast.kind} notification`}
            onClick={() => dismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
  const completed = rows.filter(
    (row) => row.status === "uploaded" || row.status === "failed"
  ).length;
  const successful = rows.filter((row) => row.status === "uploaded").length;
  return (
    <>
      <div
        className="bf-drop-region"
        ref={region}
        tabIndex={-1}
        onClickCapture={(event) => {
          if (event.target instanceof Element) {
            const button = event.target.closest<HTMLElement>("button");
            if (button) trigger.current = button;
          }
        }}
        onDragEnter={(event) => {
          if (!props.upload || !event.dataTransfer.types.includes("Files"))
            return;
          event.preventDefault();
          depth.current++;
          if (!busy.current) setDragging(true);
        }}
        onDragOver={(event) => {
          if (!props.upload || !event.dataTransfer.types.includes("Files"))
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = busy.current ? "none" : "copy";
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setDragging(false);
        }}
        onDrop={(event) => {
          if (!props.upload || !event.dataTransfer.types.includes("Files"))
            return;
          event.preventDefault();
          depth.current = 0;
          setDragging(false);
          trigger.current = region.current;
          void start(Array.from(event.dataTransfer.files));
        }}
      >
        <FileCard
          {...props}
          actions={{
            ...props.actions,
            requestUpload: (...args) => {
              if (!props.upload) {
                props.actions.requestUpload(...args);
                return;
              }
              if (busy.current) setOpen(true);
              else input.current?.click();
            }
          }}
        />
        {props.upload && (
          <input
            ref={input}
            className="bf-sr-only"
            type="file"
            tabIndex={-1}
            aria-label="Choose files to upload"
            accept={props.settings.accept}
            multiple={props.settings.multiple}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void start(files);
            }}
          />
        )}
        {dragging && (
          <div className="bf-drop-overlay">
            <span aria-hidden="true">↥</span>
            <strong>Drop files to upload</strong>
            <span>Attach to this record</span>
          </div>
        )}
      </div>
      {running && !open && (
        <Button onClick={() => setOpen(true)}>Show upload status</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          finalFocus={trigger}
          closeLabel="Close upload status"
          className="bf-upload-dialog"
        >
          <DialogTitle className="bf-dialog-title">
            {running ? "Uploading files" : "Upload results"}
          </DialogTitle>
          <DialogDescription className="bf-dialog-description">
            {successful} of {rows.length} files uploaded.{" "}
            {running
              ? "Uploads continue if you close this window."
              : "2 MB limit per file for this test."}
          </DialogDescription>
          <progress
            className="bf-upload-progress"
            value={completed}
            max={Math.max(rows.length, 1)}
            aria-label="Files processed"
          />
          <ul className="bf-upload-rows">
            {rows.map((row, i) => (
              <li key={i}>
                <div>
                  <strong>{row.name}</strong>
                  <span
                    className={`bf-upload-state bf-upload-state-${row.status}`}
                  >
                    {
                      {
                        waiting: "Waiting",
                        uploading: "Uploading…",
                        uploaded: "Uploaded",
                        failed: "Failed"
                      }[row.status]
                    }
                  </span>
                </div>
                {row.message && <p>{row.message}</p>}
              </li>
            ))}
          </ul>
          {refreshError && <p role="alert">{refreshError}</p>}
          <div className="bf-upload-footer">
            <Button onClick={() => setOpen(false)}>
              {running ? "Close" : "Done"}
            </Button>
          </div>
          {open && toastView}
        </DialogContent>
      </Dialog>
      {!open && portal && createPortal(toastView, portal)}
    </>
  );
}
