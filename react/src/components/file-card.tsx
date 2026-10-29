import { useId } from "react";
import { cn } from "@/lib/utils";
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

// Literal utilities keep every supported host-configured column count in the build.
const gridColumns = [
  "bf:grid-cols-1",
  "bf:grid-cols-2",
  "bf:grid-cols-3",
  "bf:grid-cols-4",
  "bf:grid-cols-5",
  "bf:grid-cols-6",
  "bf:grid-cols-7",
  "bf:grid-cols-8",
  "bf:grid-cols-9",
  "bf:grid-cols-10",
  "bf:grid-cols-11"
] as const;

/** Pure UI: supplied state is already filtered, counted, and limited by the host. */
export function FileCard({ context, settings, state, actions }: FileCardProps) {
  const titleId = useId();
  const columns =
    Number.isInteger(settings.filesPerRow) &&
    settings.filesPerRow > 0 &&
    settings.filesPerRow < 12
      ? settings.filesPerRow
      : 3;
  const gridClassName = cn(
    "bf:grid bf:gap-x-[18px] bf:gap-y-3.5 bf:px-3 bf:pb-3 bf:@max-[600px]:grid-cols-1 bf:@max-[600px]:gap-3",
    gridColumns[columns - 1]
  );
  const upload = () => actions.requestUpload(context, settings);
  const viewAll = () => actions.viewAll(context, settings);
  const isEmpty = state.status === "ready" && state.total === 0;

  return (
    <div className="bf:@container">
      <section
        className="bf:rounded-lg bf:border bf:border-panel-border bf:bg-background"
        aria-labelledby={titleId}
        aria-busy={state.status === "loading"}
      >
        <header className="bf:flex bf:min-h-[59px] bf:items-center bf:gap-3 bf:p-3">
          <span className="bf:flex bf:size-7 bf:shrink-0 bf:items-center bf:justify-center bf:rounded-md bf:bg-icon">
            <File
              size={21}
              className="bf:fill-white bf:stroke-icon"
              aria-hidden="true"
            />
          </span>
          <h2
            id={titleId}
            className="bf:min-w-0 bf:flex-1 bf:text-card-title bf:font-semibold"
          >
            <button
              type="button"
              className="bf:[font:inherit] bf:text-foreground bf:hover:underline"
              onClick={viewAll}
            >
              {state.status === "ready" ? `Files (${state.total})` : "Files"}
            </button>
          </h2>
          <Button className="bf:@max-[600px]:hidden" onClick={upload}>
            <Plus size={15} aria-hidden="true" />
            Upload Files
          </Button>
          <div className="bf:hidden bf:@max-[600px]:block">
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
          <div role="status">
            <span className="bf:sr-only">Loading files</span>
            <div className={gridClassName} aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  className="bf:flex bf:h-[38px] bf:items-center bf:gap-2.5"
                  key={index}
                >
                  <span className="bf:h-8 bf:w-[27px] bf:bg-divider" />
                  <div className="bf:flex-1">
                    <i className="bf:block bf:h-2 bf:w-4/5 bf:bg-divider" />
                    <i className="bf:mt-2 bf:block bf:h-1.5 bf:w-[55%] bf:bg-divider" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {state.status === "error" && (
          <div
            className="bf:px-4 bf:pt-3 bf:pb-6 bf:text-center bf:[&>p]:mb-3"
            role="alert"
          >
            <p>Unable to load files.</p>
            <p className="bf:text-sm bf:text-muted">{state.message}</p>
            <Button onClick={actions.retry}>Try Again</Button>
          </div>
        )}
        {isEmpty && (
          <div className="bf:px-4 bf:pt-3 bf:pb-6 bf:text-center bf:[&>p]:mb-3">
            <p>No files yet.</p>
            <Button onClick={upload}>Upload Files</Button>
          </div>
        )}
        {state.status === "ready" && !isEmpty && (
          <ul className={gridClassName}>
            {state.files.map((file) => (
              <li key={file.versionId} className="bf:min-w-0">
                <button
                  type="button"
                  data-file-preview
                  className="bf:group/file bf:flex bf:w-full bf:items-center bf:gap-2 bf:text-left"
                  onClick={() => actions.preview(file)}
                  title={file.title}
                  aria-label={`Preview ${file.title}`}
                >
                  <FileThumbnail file={file} enabled={settings.filePreview} />
                  <span className="bf:min-w-0 bf:flex-1">
                    <span className="bf:block bf:truncate bf:leading-normal bf:text-primary bf:group-hover/file:underline">
                      {file.title}
                    </span>
                    <span className="bf:block bf:truncate bf:text-sm bf:leading-normal bf:text-muted">
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
          <footer className="bf:border-t bf:border-divider bf:px-3 bf:py-1 bf:text-center">
            <Button variant="link" onClick={viewAll}>
              View All
            </Button>
          </footer>
        )}
      </section>
    </div>
  );
}
