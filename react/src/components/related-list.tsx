import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent
} from "react";
import { Files, ChevronDown } from "lucide-react";
import { UploadSurface } from "./upload-file-card";
import { FileIcon } from "./file-icon";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import {
  defaultRelatedConfig,
  type RelatedFile,
  type RelatedInfo,
  type RelatedListProps,
  type RelatedQuery,
  type SortField
} from "@/related-list";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load files. Try again.";
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;

/** Server queries own sorting and paging; failed appends never advance the page. */
export function RelatedList(props: RelatedListProps) {
  const { adapter, actions } = props;
  const [info, setInfo] = useState<RelatedInfo>();
  const [infoError, setInfoError] = useState("");
  const [query, setQuery] = useState<RelatedQuery>({
    page: 0,
    searchTerm: "",
    fileTypeFilter: props.initialFilter ?? "all",
    sortBy: "LastModifiedDate",
    sortDirection: "desc"
  });
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<RelatedFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<RelatedFile[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setQuery((q) =>
          q.searchTerm === search.trim()
            ? q
            : { ...q, searchTerm: search.trim(), page: 0 }
        ),
      350
    );
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setInfoError("");
    adapter
      .info()
      .then((value) => {
        if (!active) return;
        setInfo(value);
        const allowed =
          value.config.filterMode === "Advanced"
            ? ["all", ...value.extensions.map((ext) => `extension:${ext}`)]
            : ["all", "image", "document"];
        setQuery((q) =>
          allowed.includes(q.fileTypeFilter)
            ? q
            : { ...q, fileTypeFilter: "all" }
        );
      })
      .catch((e) => {
        if (active) setInfoError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [adapter, revision, props.revision]);
  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const request = ++generation.current;
      inFlight.current = true;
      setLoading(true);
      setError("");
      if (!append) {
        setFiles([]);
        setTotal(0);
        setSelected(new Set());
      }
      try {
        const result = await adapter.load({ ...query, page: nextPage });
        if (request !== generation.current) return;
        setFiles((previous) => [
          ...new Map(
            (append ? [...previous, ...result.files] : result.files).map(
              (file) => [file.documentId, file]
            )
          ).values()
        ]);
        setTotal(result.total);
        setPage(nextPage);
      } catch (e) {
        if (request === generation.current) {
          setError(errorMessage(e));
          throw e;
        }
      } finally {
        if (request === generation.current) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [adapter, query]
  );
  useEffect(() => {
    void load(0, false).catch(() => {});
    return () => {
      generation.current++;
      inFlight.current = false;
    };
  }, [load, props.revision]);
  const currentLoad = useRef(load);
  useEffect(() => {
    currentLoad.current = load;
  }, [load]);
  const refresh = useCallback(async () => {
    if (!alive.current) return;
    setRevision((v) => v + 1);
    await currentLoad.current(0, false);
  }, []);
  const chosen = files.filter((file) => selected.has(file.documentId));
  const config = info?.config ?? defaultRelatedConfig;
  function sort(field: SortField) {
    setSelected(new Set());
    setQuery((q) => ({
      ...q,
      page: 0,
      sortBy: field,
      sortDirection:
        q.sortBy === field && q.sortDirection === "asc" ? "desc" : "asc"
    }));
  }
  function rememberActionTrigger(event: SyntheticEvent<HTMLElement>) {
    // Portal events bubble through React, but their buttons disappear on close.
    if (
      !(event.target instanceof Element) ||
      !event.currentTarget.contains(event.target)
    )
      return;
    const button = event.target.closest<HTMLElement>("button");
    if (button) deleteTrigger.current = button;
  }
  function confirmDelete(rows: RelatedFile[]) {
    setDeleting(rows);
    setDeleteError("");
  }
  async function remove() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await adapter.delete(deleting);
      if (!alive.current) return;
      setNotice(
        `${deleting.length} ${deleting.length === 1 ? "file deleted" : "files deleted"}.`
      );
      setDeleting([]);
      setSelected(new Set());
      try {
        await refresh();
      } catch {
        /* The list displays the refresh error. */
      }
    } catch (e) {
      if (alive.current) setDeleteError(errorMessage(e));
    } finally {
      if (alive.current) setDeleteBusy(false);
    }
  }
  const heading = (field: SortField, label: string) => (
    <th
      scope="col"
      aria-sort={
        query.sortBy === field
          ? query.sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        className="bf:[font:inherit] bf:text-inherit"
        onClick={() => sort(field)}
      >
        {label}{" "}
        {query.sortBy === field && (query.sortDirection === "asc" ? "↑" : "↓")}
      </button>
    </th>
  );
  const person = (value: RelatedFile["owner"]) =>
    value.id ? (
      <a href={`/${encodeURIComponent(value.id)}`}>{value.name || "Unknown"}</a>
    ) : (
      value.name || "—"
    );
  return (
    <UploadSurface
      context={props.context}
      settings={props.settings}
      upload={
        adapter.upload
          ? { send: adapter.upload, refresh, maxBytes: adapter.maxUploadBytes }
          : undefined
      }
    >
      {(requestUpload) => (
        <section
          className="bf:rounded-lg bf:border bf:border-panel-border bf:bg-background bf:text-base bf:text-foreground"
          aria-label="Related files"
          onClickCapture={rememberActionTrigger}
          onKeyDownCapture={rememberActionTrigger}
        >
          <header className="bf:flex bf:items-center bf:gap-3 bf:rounded-t-[calc(var(--bf-radius-lg)-1px)] bf:bg-header bf:p-4 bf:max-[601px]:gap-2 bf:max-[601px]:p-3">
            <span className="bf:grid bf:size-8 bf:shrink-0 bf:place-items-center bf:rounded-md bf:bg-icon bf:text-white">
              <Files size={24} />
            </span>
            <div className="bf:min-w-0 bf:flex-1">
              <nav
                aria-label="Breadcrumb"
                className="bf:flex bf:flex-wrap bf:gap-2 bf:text-sm bf:text-muted bf:[&>button]:text-primary bf:[&>button]:text-left"
              >
                <button onClick={actions.object}>
                  {props.context.objectApiName === "Account"
                    ? "Accounts"
                    : props.context.objectApiName}
                </button>
                <span>›</span>
                <button onClick={actions.record}>
                  {info?.recordName || "Record"}
                </button>
              </nav>
              <h2 className="bf:mt-0.5 bf:text-heading bf:font-semibold">
                Files {loading && !files.length ? "" : `(${total})`}
              </h2>
            </div>
            {adapter.upload && (
              <Button onClick={requestUpload}>Upload Files</Button>
            )}
          </header>
          <div className="bf:flex bf:flex-wrap bf:items-center bf:gap-2 bf:px-4 bf:py-2.5">
            <input
              ref={searchInput}
              className="bf:max-w-full bf:min-h-control bf:rounded-md bf:border bf:border-border bf:bg-background bf:px-2.5 bf:py-1 bf:[font:inherit] bf:text-foreground bf:w-[250px] bf:max-[601px]:min-w-[150px] bf:max-[601px]:flex-1"
              type="search"
              aria-label="Search files"
              placeholder="Search files…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(new Set());
              }}
            />
            <select
              className="bf:max-w-full bf:min-h-control bf:rounded-md bf:border bf:border-border bf:bg-background bf:px-2.5 bf:py-1 bf:[font:inherit] bf:text-foreground"
              aria-label="File type"
              value={query.fileTypeFilter}
              onChange={(e) => {
                setSelected(new Set());
                setQuery({ ...query, page: 0, fileTypeFilter: e.target.value });
              }}
            >
              <option value="all">All files</option>
              {config.filterMode === "Advanced" ? (
                info?.extensions.map((ext) => (
                  <option key={ext} value={`extension:${ext}`}>
                    {ext ? ext.toUpperCase() : "No extension"}
                  </option>
                ))
              ) : (
                <>
                  <option value="image">Images</option>
                  <option value="document">Documents</option>
                </>
              )}
            </select>
            <div
              className="bf:ml-auto bf:text-sm bf:text-muted bf:max-[601px]:ml-0"
              role="status"
            >
              {chosen.length
                ? `${chosen.length} selected`
                : "Select files to take action"}
            </div>
            {chosen.length > 0 && (
              <>
                <Button onClick={() => actions.download(chosen)}>
                  Download
                </Button>
                <Button onClick={() => confirmDelete(chosen)}>Delete</Button>
              </>
            )}
          </div>
          {infoError && (
            <div
              role="alert"
              className="bf:m-0 bf:flex bf:items-center bf:gap-3 bf:p-4"
            >
              {infoError}{" "}
              <Button onClick={() => setRevision((v) => v + 1)}>
                Retry settings
              </Button>
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="bf:m-0 bf:flex bf:items-center bf:gap-3 bf:p-4"
            >
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          <div
            className="bf:overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Files table"
          >
            <table
              className="bf:w-full bf:border-collapse bf:text-left bf:whitespace-nowrap bf:[&_th]:bg-table-header bf:[&_th]:text-sm bf:[&_th]:font-semibold bf:[&_th]:text-muted bf:[&_th]:py-2 bf:[&_td]:py-[11px] bf:[&_th]:px-2.5 bf:[&_td]:px-2.5 bf:[&_th]:border-t bf:[&_td]:border-t bf:[&_th]:border-divider bf:[&_td]:border-divider bf:[&_th:first-child]:w-10 bf:[&_td:first-child]:w-10 bf:[&_th:first-child]:pl-4 bf:[&_td:first-child]:pl-4 bf:[&_th:last-child]:w-[50px] bf:[&_td:last-child]:w-[50px] bf:[&_th:last-child]:pr-4 bf:[&_td:last-child]:pr-4 bf:[&_a]:text-primary bf:[&_a]:no-underline bf:[&_a:hover]:underline bf:[&_button:hover]:underline"
              aria-busy={loading}
            >
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      className="bf:size-4 bf:accent-primary bf:align-middle"
                      aria-label="Select all loaded files"
                      disabled={!files.length || loading}
                      checked={
                        files.length > 0 && chosen.length === files.length
                      }
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            chosen.length > 0 && chosen.length < files.length;
                      }}
                      onChange={(e) =>
                        setSelected(
                          new Set(
                            e.target.checked
                              ? files.map((f) => f.documentId)
                              : []
                          )
                        )
                      }
                    />
                  </th>
                  {heading("Title", "Title")}
                  {config.showOwner && heading("Owner", "Owner")}
                  {config.showLastModifiedDate &&
                    heading("LastModifiedDate", "Modified")}
                  {config.showLastModifiedBy &&
                    heading("LastModifiedBy", "Modified by")}
                  {config.showFileSize && heading("ContentSize", "Size")}
                  <th scope="col">
                    <span className="bf:sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.documentId}
                    className={
                      selected.has(file.documentId) ? "bf:bg-accent" : undefined
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="bf:size-4 bf:accent-primary bf:align-middle"
                        aria-label={`Select ${file.title}`}
                        checked={selected.has(file.documentId)}
                        disabled={loading}
                        onChange={(e) =>
                          setSelected((previous) => {
                            const next = new Set(previous);
                            if (e.target.checked) next.add(file.documentId);
                            else next.delete(file.documentId);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="bf:flex bf:min-w-[200px] bf:items-center bf:gap-2.5">
                        <FileIcon
                          extension={file.extension}
                          className="bf:h-[26px] bf:w-[21px] bf:flex-[0_0_21px]"
                        />
                        <button
                          className="bf:max-w-[420px] bf:text-left bf:whitespace-normal bf:text-primary bf:wrap-anywhere"
                          onClick={() => actions.preview(file)}
                        >
                          {file.title}
                        </button>
                      </div>
                    </td>
                    {config.showOwner && <td>{person(file.owner)}</td>}
                    {config.showLastModifiedDate && (
                      <td>
                        <time dateTime={file.modifiedAt}>
                          {new Date(file.modifiedAt).toLocaleDateString()}
                        </time>
                      </td>
                    )}
                    {config.showLastModifiedBy && (
                      <td>{person(file.modifiedBy)}</td>
                    )}
                    {config.showFileSize && <td>{size(file.sizeBytes)}</td>}
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="bf:grid bf:size-[26px] bf:cursor-pointer bf:place-items-center bf:rounded-md bf:border bf:border-border bf:bg-background bf:text-muted"
                          aria-label={`Actions for ${file.title}`}
                        >
                          <ChevronDown size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => actions.preview(file)}
                          >
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => actions.download([file])}
                          >
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => confirmDelete([file])}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && (
            <p
              role="status"
              className="bf:m-0 bf:flex bf:items-center bf:gap-3 bf:p-4"
            >
              Loading files…
            </p>
          )}
          {!loading && !error && !files.length && (
            <p className="bf:m-0 bf:px-4 bf:py-10 bf:text-center">
              {query.searchTerm || query.fileTypeFilter !== "all"
                ? "No files match your search."
                : "No files attached yet. Drop files here to upload."}
            </p>
          )}
          {error && (
            <div
              className="bf:m-0 bf:flex bf:items-center bf:gap-3 bf:p-4"
              role="alert"
            >
              {error}{" "}
              <Button
                onClick={() => {
                  if (!inFlight.current)
                    void load(
                      files.length ? page + 1 : 0,
                      files.length > 0
                    ).catch(() => {});
                }}
              >
                Retry
              </Button>
            </div>
          )}
          <footer className="bf:flex bf:min-h-[38px] bf:items-center bf:justify-between bf:border-t bf:border-divider bf:px-4 bf:py-[9px] bf:text-sm bf:text-muted">
            <span>
              {files.length} of {total} files loaded
            </span>
            {files.length < total && !error && (
              <Button
                disabled={loading}
                onClick={() => {
                  if (!inFlight.current)
                    void load(page + 1, true).catch(() => {});
                }}
              >
                Load more
              </Button>
            )}
          </footer>
          <Dialog
            open={deleting.length > 0}
            onOpenChange={(open) => {
              if (!open && !deleteBusy) setDeleting([]);
            }}
          >
            <DialogContent
              finalFocus={() =>
                deleteTrigger.current?.isConnected
                  ? deleteTrigger.current
                  : searchInput.current
              }
              closeLabel="Cancel deletion"
            >
              <DialogTitle>
                Delete{" "}
                {deleting.length === 1
                  ? deleting[0]?.title
                  : `${deleting.length} files`}
                ?
              </DialogTitle>
              <DialogDescription>
                This deletes the files from Salesforce, including other records
                where they are shared.
              </DialogDescription>
              {deleteError && <p role="alert">{deleteError}</p>}
              <div className="bf:mt-4 bf:flex bf:justify-end bf:gap-2 bf:[&>button]:min-w-18 bf:[&>button]:px-4">
                <Button disabled={deleteBusy} onClick={() => setDeleting([])}>
                  Cancel
                </Button>
                <Button disabled={deleteBusy} onClick={() => void remove()}>
                  {deleteBusy ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>
      )}
    </UploadSurface>
  );
}
