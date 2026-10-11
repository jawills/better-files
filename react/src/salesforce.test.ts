import { expect, it } from "vitest";
import { fromSalesforceFile, type SalesforceFileRow } from "./salesforce";

const row: SalesforceFileRow = {
  version: {
    Id: "068-version",
    ContentDocumentId: "069-document",
    ContentDocument: {
      Title: "Test file",
      FileExtension: "PDF",
      ContentSize: 12345,
      LastModifiedDate: "2026-10-09T12:00:00Z"
    }
  },
  linkedEntityType: "EmailMessage"
};

it("keeps document navigation separate from version thumbnails and retains email context", () => {
  const file = fromSalesforceFile(row);
  expect(file.documentId).toBe("069-document");
  expect(file.thumbnailUrl).toContain("versionId=068-version");
  expect(file.thumbnailUrl).not.toContain("069-document");
  expect(file.source).toBe("email");
});

it("does not request a thumbnail for unsupported or extensionless files", () => {
  for (const extension of ["zip", null]) {
    const file = fromSalesforceFile({
      ...row,
      linkedEntityType: "Account",
      version: {
        ...row.version,
        ContentDocument: {
          ...row.version.ContentDocument,
          FileExtension: extension
        }
      }
    });
    expect(file.thumbnailUrl).toBeUndefined();
    expect(file.source).toBe("record");
  }
});
