import { useState } from "react";
import type { FileRecord } from "@/model";

function fileColor(extension: string) {
  switch (extension.toLowerCase()) {
    case "pdf":
      return "#ba3026";
    case "xls":
    case "xlsx":
    case "csv":
      return "#2e844a";
    case "doc":
    case "docx":
      return "#1b74b8";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return "#0b827c";
    default:
      return "#706e6b";
  }
}

export function FileIcon({ extension }: Pick<FileRecord, "extension">) {
  return (
    <svg className="bf-file-icon" viewBox="0 0 80 96" aria-hidden="true">
      <path d="M12 2h38l20 20v69H12z" fill={fileColor(extension)} />
      <path d="M50 2v20h20" fill="#fff" opacity=".35" />
      <path
        d="M24 38h33M24 47h33M24 56h24"
        stroke="#fff"
        opacity=".8"
        strokeWidth="3"
      />
      <text
        x="40"
        y="79"
        fill="#fff"
        textAnchor="middle"
        fontFamily="Arial"
        fontWeight="bold"
        fontSize="13"
      >
        {extension.slice(0, 4).toUpperCase() || "FILE"}
      </text>
    </svg>
  );
}

export function FileThumbnail({
  file,
  enabled
}: {
  file: FileRecord;
  enabled: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return enabled && file.thumbnailUrl && file.thumbnailUrl !== failedUrl ? (
    <img
      className="bf-thumbnail"
      src={file.thumbnailUrl}
      alt=""
      onError={() => setFailedUrl(file.thumbnailUrl)}
    />
  ) : (
    <FileIcon extension={file.extension} />
  );
}
