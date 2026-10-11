import {
  defaultSettings,
  type FileListState,
  type FileRecord,
  type FileSettings,
  type RecordContext
} from "@/model";

const officeThumbnail =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 96"><rect width="80" height="96" fill="#dce9ed"/><path d="M6 81V28l45-12 24 19v46z" fill="#faf8f2"/><path d="M13 35l32-8v42H13z" fill="#567c8b"/><path d="M23 32v37m12-40v40M13 48h32" stroke="#faf8f2" stroke-width="3"/><path d="M0 81h80v15H0z" fill="#aebfa9"/></svg>'
  );

export const fixtureContext: RecordContext = {
  recordId: "fixture-acme",
  objectApiName: "Account"
};
export const fixtureFiles: readonly FileRecord[] = [
  {
    versionId: "v1",
    documentId: "d1",
    title: "Acme Services Agreement.pdf",
    extension: "pdf",
    sizeBytes: 2516582,
    modifiedAt: "2026-10-08T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v2",
    documentId: "d2",
    title: "Implementation Budget.xlsx",
    extension: "xlsx",
    sizeBytes: 188416,
    modifiedAt: "2026-10-08T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v3",
    documentId: "d3",
    title: "Office Exterior.jpg",
    extension: "jpg",
    sizeBytes: 3250585,
    modifiedAt: "2026-10-07T12:00:00Z",
    source: "record",
    thumbnailUrl: officeThumbnail
  },
  {
    versionId: "v4",
    documentId: "d4",
    title: "Project Brief.docx",
    extension: "docx",
    sizeBytes: 98304,
    modifiedAt: "2026-10-06T12:00:00Z",
    source: "email"
  },
  {
    versionId: "v5",
    documentId: "d5",
    title: "Q4 Rollout Schedule.pdf",
    extension: "pdf",
    sizeBytes: 430080,
    modifiedAt: "2026-10-05T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v6",
    documentId: "d6",
    title: "Brand Assets.zip",
    extension: "zip",
    sizeBytes: 8598323,
    modifiedAt: "2026-10-04T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v7",
    documentId: "d7",
    title: "Email Signature.png",
    extension: "png",
    sizeBytes: 4096,
    modifiedAt: "2026-10-03T12:00:00Z",
    source: "email"
  },
  {
    versionId: "v8",
    documentId: "d8",
    title: "Meeting Notes.txt",
    extension: "txt",
    sizeBytes: 1024,
    modifiedAt: "2026-10-03T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v9",
    documentId: "d9",
    title: "Signed Order.pdf",
    extension: "pdf",
    sizeBytes: 563200,
    modifiedAt: "2026-10-02T12:00:00Z",
    source: "email"
  },
  {
    versionId: "v10",
    documentId: "d10",
    title: "Site Plan.pdf",
    extension: "pdf",
    sizeBytes: 799744,
    modifiedAt: "2026-10-01T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v11",
    documentId: "d11",
    title: "Contact List.csv",
    extension: "csv",
    sizeBytes: 32768,
    modifiedAt: "2026-09-30T12:00:00Z",
    source: "record"
  },
  {
    versionId: "v12",
    documentId: "d12",
    title: "Requirements.docx",
    extension: "docx",
    sizeBytes: 79872,
    modifiedAt: "2026-09-29T12:00:00Z",
    source: "email"
  }
];

export const scenarios = [
  "Populated",
  "Empty",
  "Loading",
  "Error",
  "Long filenames",
  "Missing thumbnails"
] as const;
export type Scenario = (typeof scenarios)[number];

/** Local-only adapter; live Salesforce filtering and counting stay in Apex. */
export function getFixtureState(
  scenario: Scenario,
  settings: FileSettings = defaultSettings
): FileListState {
  if (scenario === "Loading") return { status: "loading" };
  if (scenario === "Error")
    return {
      status: "error",
      message: "You may not have access to these files."
    };
  if (scenario === "Empty") return { status: "ready", files: [], total: 0 };
  const eligible = fixtureFiles.filter(
    (file) =>
      (settings.includeEmails || file.source !== "email") &&
      file.sizeBytes >= settings.minimumFileSizeKb * 1024
  );
  const files = eligible.slice(0, settings.fileLimit).map((file) => {
    if (scenario === "Long filenames")
      return {
        ...file,
        title: `Acme_Implementation_2026_Final_Reviewed_and_Approved_${file.title}`
      };
    if (scenario === "Missing thumbnails")
      return { ...file, thumbnailUrl: "data:image/png;base64,broken" };
    return file;
  });
  return { status: "ready", files, total: eligible.length };
}
