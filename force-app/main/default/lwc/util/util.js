/**
 * Formats bytes into a human-readable string.
 *
 * @param {number} bytes The number of bytes.
 * @param {number} [decimals=0] The number of decimal places to use.
 * @returns {string} The formatted string.
 */
export function formatBytes(bytes, decimals = 0) {
  if (!+bytes) {
    return "0 Bytes";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * @description Returns the Lightning Design System doctype icon based on the file extension provided.
 *
 * @param {string} fileExtension The file extension of the file. Include the leading period. Case-insensitive.
 * @returns {string} The doctype icon name. Returns 'doctype:unknown' if no match is found.
 */
export function getFileIcon(fileExtension) {
  if (!fileExtension) {
    return "doctype:unknown";
  }

  const lowerExtension = fileExtension.toLowerCase().replace(/^\./, "");

  const extensionToIcon = {
    xlsx: "doctype:excel",
    xls: "doctype:excel",
    csv: "doctype:csv",
    docx: "doctype:word",
    doc: "doctype:word",
    pdf: "doctype:pdf",
    pptx: "doctype:ppt",
    ppt: "doctype:ppt",
    txt: "doctype:txt",
    rtf: "doctype:txt",
    png: "doctype:image",
    jpg: "doctype:image",
    jpeg: "doctype:image",
    gif: "doctype:image",
    bmp: "doctype:image",
    svg: "doctype:image",
    zip: "doctype:zip",
    rar: "doctype:zip",
    "7z": "doctype:zip",
    xml: "doctype:xml",
    json: "doctype:json",
    mp3: "doctype:audio",
    wav: "doctype:audio",
    mp4: "doctype:video",
    avi: "doctype:video",
    mov: "doctype:video",
    htm: "doctype:html",
    html: "doctype:html",
    css: "doctype:css",
    js: "doctype:script",
    java: "doctype:code",
    apex: "doctype:code",
    log: "doctype:log"
  };

  return extensionToIcon[lowerExtension] || "doctype:unknown";
}

/**
 * Checks if a file extension is previewable.
 *
 * @param {string} fileExtension The file extension to check (e.g., 'pdf', 'jpg').
 * @returns {boolean} True if the extension is previewable, false otherwise.
 */
export function hasPreview(fileExtension) {
  if (!fileExtension) {
    return false; // Or handle the null/undefined case as needed
  }

  const supportedExtensions = [
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
  ];

  const lowerCaseExtension = fileExtension.toLowerCase();
  return supportedExtensions.includes(lowerCaseExtension);
}

export function getFormattedFileCount(fileCount) {
  return fileCount <= 6 ? fileCount : "6+";
}

export function getConsoleParentTabId({ tabId, parentTabId } = {}) {
  return parentTabId || tabId;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "svg",
  "webp",
  "tif",
  "tiff",
  "heic"
]);

const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "txt",
  "rtf",
  "odt",
  "ods",
  "odp"
]);

export function normalizeFileExtension(fileExtension) {
  return (fileExtension || "").toLowerCase().replace(/^\./, "");
}

export function getFileTypeCategory(fileExtension) {
  const ext = normalizeFileExtension(fileExtension);
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return "document";
  }
  return "other";
}

export function matchesFileTypeFilter(fileExtension, fileTypeFilter) {
  if (!fileTypeFilter || fileTypeFilter === "all") {
    return true;
  }
  return getFileTypeCategory(fileExtension) === fileTypeFilter;
}

export function getFileTypeFilterOptions() {
  return [
    { label: "All files", value: "all" },
    { label: "Images", value: "image" },
    { label: "Documents", value: "document" }
  ];
}

/**
 * Maps an Apex FileRow ({ version, ... }) or a legacy ContentVersion.
 */
export function mapFile(fileOrRow) {
  const file = fileOrRow?.version ?? fileOrRow ?? {};
  const contentDocument = file.ContentDocument || {};
  const lastModifiedById = contentDocument.LastModifiedById;
  const ownerId = contentDocument.OwnerId;
  const contentDocumentId = contentDocument.Id || file.ContentDocumentId;
  return {
    Id: file.Id,
    ContentDocumentId: contentDocumentId,
    Title: contentDocument.Title,
    CreatedDate: contentDocument.CreatedDate,
    ContentSize: formatBytes(contentDocument.ContentSize),
    LastModifiedDate: contentDocument.LastModifiedDate,
    FileExtension: contentDocument.FileExtension,
    VersionData: file.VersionData,
    LastModifiedBy: contentDocument.LastModifiedBy?.Name || "",
    LastModifiedByLink: lastModifiedById ? `/${lastModifiedById}` : null,
    Owner: contentDocument.Owner?.Name || "",
    OwnerLink: ownerId ? `/${ownerId}` : null,
    hasPreview: hasPreview(contentDocument.FileExtension),
    downloadUrl: contentDocumentId
      ? `/sfc/servlet.shepherd/document/download/${contentDocumentId}`
      : null,
    imageUrl: file.Id
      ? `/sfc/servlet.shepherd/version/renditionDownload?rendition=thumb120by90&versionId=${file.Id}`
      : null,
    fileUrl: contentDocument.Id
      ? `/lightning/r/${contentDocument.Id}/view`
      : null,
    icon: getFileIcon(contentDocument.FileExtension),
    linkedEntityId: fileOrRow?.linkedEntityId || null,
    linkedEntityType: fileOrRow?.linkedEntityType || null
  };
}
