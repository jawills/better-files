import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDropzone } from "react-dropzone";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { FileCard } from "./file-card";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "./ui/dialog";
import { usePortalContainer } from "./portal-context";
import { MAX_UPLOAD_BYTES, validateUpload } from "@/upload";
import { cn } from "@/lib/utils";
import type { FileCardProps } from "@/model";

type Row = {
  name: string;
  status: "waiting" | "uploading" | "uploaded" | "failed";
  message?: string;
};
type Toast = { id: number; kind: "success" | "error"; message: string };

/** Shared interaction layer; each host supplies its own upload and refresh transport. */
export function UploadFileCard(props: FileCardProps) {
  return (
    <UploadSurface {...props}>
      {(requestUpload) => (
        <FileCard {...props} actions={{ ...props.actions, requestUpload }} />
      )}
    </UploadSurface>
  );
}

type UploadSurfaceProps = Pick<
  FileCardProps,
  "context" | "settings" | "upload"
> & {
  children: (requestUpload: () => void) => ReactNode;
  actions?: Pick<FileCardProps["actions"], "requestUpload">;
};

export function UploadSurface(props: UploadSurfaceProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshError, setRefreshError] = useState("");
  const trigger = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const toastId = useRef(0);
  const portal = usePortalContainer();
  // Validate the whole batch in start() so rejected files keep their order and messages.
  const {
    getRootProps,
    getInputProps,
    rootRef,
    isDragActive,
    open: openFilePicker
  } = useDropzone({
    disabled: !props.upload || running,
    noClick: true,
    noKeyboard: true,
    noPaste: true,
    useFsAccessApi: false,
    onDrop: (files, _rejections, event) => {
      if (!alive.current || busy.current) return;
      if (event.type === "drop") trigger.current = rootRef.current;
      void start(files);
    },
    onError: (error) => notify("error", error.message)
  });
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
    if (!files.length || !adapter || busy.current || !alive.current) return;
    busy.current = true;
    setRunning(true);
    setOpen(true);
    setRefreshError("");
    const initial: Row[] = files.map((file) => {
      const message =
        !props.settings.multiple && files.length > 1
          ? "Choose one file at a time."
          : validateUpload(file, props.settings, adapter.maxBytes);
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
    <div className="bf:pointer-events-none bf:fixed bf:top-4 bf:left-1/2 bf:z-[9010] bf:grid bf:max-h-[calc(100dvh-32px)] bf:w-[min(580px,calc(100vw-32px))] bf:-translate-x-1/2 bf:gap-2 bf:overflow-auto bf:p-1">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "bf:pointer-events-auto bf:flex bf:items-center bf:gap-3 bf:rounded-md bf:px-3.5 bf:py-3 bf:text-base bf:leading-normal bf:text-toast-text bf:shadow-[0_3px_10px_#18181820]",
            toast.kind === "success"
              ? "bf:bg-toast-success"
              : "bf:bg-toast-error"
          )}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.kind === "success" ? (
            <CircleCheck
              className="bf:mt-1 bf:self-start bf:fill-toast-text bf:stroke-toast-success"
              size={24}
              aria-hidden="true"
            />
          ) : (
            <CircleAlert
              className="bf:mt-1 bf:self-start bf:fill-toast-text bf:stroke-toast-error"
              size={24}
              aria-hidden="true"
            />
          )}
          <span className="bf:min-w-0 bf:flex-1 bf:wrap-anywhere">
            {toast.message}
          </span>
          <button
            type="button"
            className="bf:grid bf:size-8 bf:shrink-0 bf:self-start bf:place-items-center bf:rounded-sm bf:p-1.5 bf:text-inherit bf:hover:bg-white/15 bf:focus-visible:outline-toast-text"
            aria-label={`Dismiss ${toast.kind} notification`}
            onClick={() => dismiss(toast.id)}
          >
            <X size={20} aria-hidden="true" />
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
        data-file-drop
        {...getRootProps({
          className: "bf:relative",
          tabIndex: -1,
          onClickCapture: (event) => {
            if (event.target instanceof Element) {
              const button = event.target.closest<HTMLElement>("button");
              if (button) trigger.current = button;
            }
          }
        })}
      >
        {props.children(() => {
          if (!props.upload)
            props.actions?.requestUpload(props.context, props.settings);
          else if (busy.current) setOpen(true);
          else openFilePicker();
        })}
        {props.upload && (
          <input
            {...getInputProps({
              className: "bf:sr-only",
              "aria-label": "Choose files to upload",
              accept: props.settings.accept,
              multiple: props.settings.multiple
            })}
          />
        )}
        {isDragActive && !running && props.upload && (
          <div className="bf:pointer-events-none bf:absolute bf:inset-0.5 bf:z-10 bf:flex bf:min-h-[100px] bf:flex-col bf:items-center bf:justify-center bf:gap-1.5 bf:rounded-lg bf:border-2 bf:border-dashed bf:border-primary bf:bg-accent/96 bf:text-accent-foreground">
            <span className="bf:text-[28px]" aria-hidden="true">
              ↥
            </span>
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
          className="bf:max-h-[calc(100vh-40px)] bf:overflow-visible"
        >
          <DialogTitle>
            {running ? "Uploading files" : "Upload results"}
          </DialogTitle>
          <DialogDescription>
            {successful} of {rows.length} files uploaded.{" "}
            {running
              ? "Uploads continue if you close this window."
              : `${Math.floor((props.upload?.maxBytes ?? MAX_UPLOAD_BYTES) / 1024 / 1024)} MB limit per file.`}
          </DialogDescription>
          <progress
            className="bf:mb-3 bf:block bf:h-1.5 bf:w-full bf:appearance-none bf:border-0 bf:bg-divider bf:[&::-webkit-progress-bar]:bg-divider bf:[&::-webkit-progress-value]:bg-primary bf:[&::-moz-progress-bar]:bg-primary"
            value={completed}
            max={Math.max(rows.length, 1)}
            aria-label="Files processed"
          />
          <ul className="bf:max-h-[45vh] bf:overflow-auto">
            {rows.map((row, i) => (
              <li key={i} className="bf:border-b bf:border-divider bf:py-2.5">
                <div className="bf:flex bf:items-baseline bf:justify-between bf:gap-4">
                  <strong className="bf:text-base bf:font-normal bf:wrap-anywhere">
                    {row.name}
                  </strong>
                  <span
                    className={cn("bf:shrink-0 bf:text-sm", {
                      "bf:text-success": row.status === "uploaded",
                      "bf:text-error": row.status === "failed"
                    })}
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
                {row.message && (
                  <p className="bf:pt-1.5 bf:text-sm bf:text-error">
                    {row.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {refreshError && <p role="alert">{refreshError}</p>}
          <div className="bf:mt-4 bf:flex bf:justify-end bf:gap-2 bf:[&>button]:min-w-18 bf:[&>button]:px-4">
            <Button variant="primary" onClick={() => setOpen(false)}>
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
