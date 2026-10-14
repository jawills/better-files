import type { FileRecord } from "@/model";

export const liveRecord = {
  recordId: "001fL000009dbKKQAY",
  objectApiName: "Account"
};

export type LiveFiles = {
  recordName: string;
  recordUrl: string;
  files: FileRecord[];
};

export function contentUrl(versionId: string) {
  return `/__salesforce/content/${encodeURIComponent(versionId)}`;
}
