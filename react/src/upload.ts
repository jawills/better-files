import type { FileSettings } from "./model.ts";

// The base64 transport is deliberately bounded for synchronous Apex.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function validateUpload(
  file: Pick<File, "name" | "size" | "type">,
  settings: Pick<FileSettings, "accept">,
  maxBytes = MAX_UPLOAD_BYTES
) {
  if (
    !file.name ||
    file.name.length > 255 ||
    /[\\/]/.test(file.name) ||
    Array.from(file.name).some((character) => character.charCodeAt(0) < 32)
  )
    return "Use a filename without path separators, up to 255 characters.";
  if (!file.size) return "This file is empty.";
  if (file.size > maxBytes)
    return `The upload limit is ${Math.floor(maxBytes / 1024 / 1024)} MB per file.`;
  const allowed = settings.accept
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (
    allowed.length &&
    !allowed.some((value) =>
      value.startsWith(".")
        ? name.endsWith(value)
        : value.endsWith("/*")
          ? mime.startsWith(value.slice(0, -1))
          : mime === value
    )
  )
    return "This file type is not allowed.";
  return undefined;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read file."));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}
