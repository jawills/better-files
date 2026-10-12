import type {
  FileCardProps,
  FileRecord,
  FileSettings,
  RecordContext
} from "./model";
export type RelatedFile = FileRecord & {
  owner: { id?: string; name: string };
  modifiedBy: { id?: string; name: string };
};
export type SortField =
  | "Title"
  | "Owner"
  | "LastModifiedDate"
  | "LastModifiedBy"
  | "ContentSize";
export type RelatedQuery = {
  page: number;
  searchTerm: string;
  fileTypeFilter: string;
  sortBy: SortField;
  sortDirection: "asc" | "desc";
};
export const relatedPageSize = 25;
export const defaultRelatedConfig = {
  showOwner: true,
  showLastModifiedDate: true,
  showLastModifiedBy: true,
  showFileSize: true,
  filterMode: "Basic" as "Basic" | "Advanced"
};
export type RelatedInfo = {
  recordName: string;
  config: typeof defaultRelatedConfig;
  extensions: string[];
};
export type RelatedListProps = {
  context: RecordContext;
  settings: FileSettings;
  initialFilter?: string;
  revision?: number;
  adapter: {
    maxUploadBytes?: number;
    info: () => Promise<RelatedInfo>;
    load: (
      query: RelatedQuery
    ) => Promise<{ files: RelatedFile[]; total: number }>;
    delete: (files: RelatedFile[]) => Promise<void>;
    upload?: NonNullable<FileCardProps["upload"]>["send"];
  };
  actions: {
    preview: (file: FileRecord) => void;
    download: (files: RelatedFile[]) => void;
    record: () => void;
    object: () => void;
  };
};
