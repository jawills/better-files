import { useId, type CSSProperties } from "react";
import { ChevronDown, File, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { FileThumbnail } from "@/components/file-icon";
import type { FileCardProps } from "@/model";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

type GridStyle = CSSProperties & { "--bf-columns": number };

/** Pure UI: supplied state is already filtered, counted, and limited by the host. */
export function FileCard({ context, settings, state, actions }: FileCardProps) {
  const titleId = useId();
  const columns =
    Number.isInteger(settings.filesPerRow) &&
    settings.filesPerRow > 0 &&
    settings.filesPerRow < 12
      ? settings.filesPerRow
      : 3;
  const style: GridStyle = { "--bf-columns": columns };
  const upload = () => actions.requestUpload(context, settings);
  const viewAll = () => actions.viewAll(context, settings);
  const isEmpty = state.status === "ready" && state.total === 0;

  return (
    <div className="bf-card-container">
      <section
        className="bf-card"
        aria-labelledby={titleId}
        aria-busy={state.status === "loading"}
      >
        <header className="bf-header">
          <span className="bf-badge">
            <File size={21} fill="white" stroke="#1b96ff" aria-hidden="true" />
          </span>
          <h2 id={titleId}>
            <button type="button" className="bf-title-link" onClick={viewAll}>
              {state.status === "ready" ? `Files (${state.total})` : "Files"}
            </button>
          </h2>
          <Button className="bf-upload-wide" onClick={upload}>
            <Plus size={15} aria-hidden="true" />
            Upload Files
          </Button>
          <div className="bf-upload-narrow">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={<Button size="icon" />}
                aria-label="Show file actions"
              >
                <ChevronDown size={16} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={upload}>
                  Upload Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {state.status === "loading" && (
          <div className="bf-loading" role="status">
            <span className="bf-sr-only">Loading files</span>
            <div className="bf-grid" style={style} aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="bf-skeleton" key={index}>
                  <span />
                  <div>
                    <i />
                    <i />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {state.status === "error" && (
          <div className="bf-message" role="alert">
            <p>Unable to load files.</p>
            <p className="bf-error-detail">{state.message}</p>
            <Button onClick={actions.retry}>Try Again</Button>
          </div>
        )}
        {isEmpty && (
          <div className="bf-message">
            <p>No files yet.</p>
            <Button onClick={upload}>Upload Files</Button>
          </div>
        )}
        {state.status === "ready" && !isEmpty && (
          <ul className="bf-grid" style={style}>
            {state.files.map((file) => (
              <li key={file.versionId}>
                <button
                  type="button"
                  className="bf-file"
                  onClick={() => actions.preview(file)}
                  title={file.title}
                  aria-label={`Preview ${file.title}`}
                >
                  <FileThumbnail file={file} enabled={settings.filePreview} />
                  <span className="bf-file-copy">
                    <span className="bf-filename">{file.title}</span>
                    <span className="bf-metadata">
                      {dateFormat.format(new Date(file.modifiedAt))} ·{" "}
                      {formatSize(file.sizeBytes)}
                      {file.extension && ` · ${file.extension.toUpperCase()}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {state.status === "ready" && !isEmpty && (
          <footer className="bf-footer">
            <Button variant="link" onClick={viewAll}>
              View All
            </Button>
          </footer>
        )}
      </section>
    </div>
  );
}
