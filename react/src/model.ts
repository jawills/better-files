export type FileRecord = {
  versionId: string;
  documentId: string;
  title: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  thumbnailUrl?: string;
  source: "record" | "email";
};

export type RecordContext = { recordId: string; objectApiName: string };

/** Wisty UI's Salesforce themes, or Better Files' original approved look. */
export const fileThemes = ["cosmos", "lightning-blue", "better-files"] as const;
export type FileTheme = (typeof fileThemes)[number];

export const defaultSettings = {
  accept:
    ".pdf,.doc,.docx,.rtf,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.zip",
  multiple: true,
  filePreview: true,
  fileLimit: 6,
  filesPerRow: 3,
  includeEmails: true,
  minimumFileSizeKb: 0,
  theme: "cosmos" as FileTheme
};

export type FileSettings = typeof defaultSettings;
export type FileListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; files: readonly FileRecord[]; total: number };

/** The Salesforce wrapper owns data, navigation, and upload transport. */
export type FileCardProps = {
  upload?: {
    maxBytes?: number;
    send: (file: File, context: RecordContext) => Promise<void>;
    refresh: () => void | Promise<void>;
  };
  context: RecordContext;
  settings: FileSettings;
  state: FileListState;
  actions: {
    preview: (file: FileRecord) => void;
    viewAll: (context: RecordContext, settings: FileSettings) => void;
    requestUpload: (context: RecordContext, settings: FileSettings) => void;
    retry: () => void;
  };
};
