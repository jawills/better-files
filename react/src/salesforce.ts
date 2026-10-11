import type { FileRecord } from "./model";

/** Fields returned by the existing FileListController.FileRow DTO. */
export type SalesforceFileRow = {
  version: {
    Id: string;
    ContentDocumentId: string;
    ContentDocument: {
      Title: string;
      FileExtension: string | null;
      ContentSize: number;
      LastModifiedDate: string;
    };
  };
  linkedEntityType: string | null;
};

const thumbnailExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "txt",
  "csv"
]);

export function fromSalesforceFile(row: SalesforceFileRow): FileRecord {
  const version = row.version;
  const document = version.ContentDocument;
  const extension = document.FileExtension?.toLowerCase() ?? "";
  return {
    versionId: version.Id,
    documentId: version.ContentDocumentId,
    title: document.Title,
    extension,
    sizeBytes: document.ContentSize,
    modifiedAt: document.LastModifiedDate,
    source: row.linkedEntityType === "EmailMessage" ? "email" : "record",
    thumbnailUrl: thumbnailExtensions.has(extension)
      ? `/sfc/servlet.shepherd/version/renditionDownload?rendition=thumb120by90&versionId=${encodeURIComponent(version.Id)}`
      : undefined
  };
}
