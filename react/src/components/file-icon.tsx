import { useState } from "react";
import type { FileRecord } from "@/model";
import { cn } from "@/lib/utils";

function fileFill(extension: string) {
  switch (extension.toLowerCase()) {
    case "pdf":
      return "bf:fill-[#ba3026]";
    case "xls":
    case "xlsx":
    case "csv":
      return "bf:fill-[#2e844a]";
    case "doc":
    case "docx":
      return "bf:fill-[#1b74b8]";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return "bf:fill-[#0b827c]";
    default:
      return "bf:fill-[#706e6b]";
  }
}

export function FileIcon({
  extension,
  className
}: Pick<FileRecord, "extension"> & { className?: string }) {
  return (
    <svg
      className={cn("bf:h-[34px] bf:w-[27px] bf:shrink-0", className)}
      viewBox="0 0 80 96"
      aria-hidden="true"
    >
      <path d="M12 2h38l20 20v69H12z" className={fileFill(extension)} />
      <path d="M50 2v20h20" className="bf:fill-white bf:opacity-35" />
      <path
        d="M24 38h33M24 47h33M24 56h24"
        className="bf:stroke-white bf:opacity-80"
        strokeWidth="3"
      />
      <text
        x="40"
        y="79"
        className="bf:fill-white bf:font-[Arial] bf:text-[13px] bf:font-bold"
        textAnchor="middle"
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
      className="bf:h-[34px] bf:w-[27px] bf:shrink-0 bf:border bf:border-panel-border bf:object-cover"
      src={file.thumbnailUrl}
      alt=""
      onError={() => setFailedUrl(file.thumbnailUrl)}
    />
  ) : (
    <FileIcon extension={file.extension} />
  );
}
