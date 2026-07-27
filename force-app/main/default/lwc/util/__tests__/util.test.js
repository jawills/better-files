import {
  mapFile,
  getConsoleParentTabId,
  getFileTypeCategory,
  matchesFileTypeFilter
} from "c/util";

const baseVersion = {
  Id: "068xx0000000001",
  ContentDocumentId: "069xx0000000001",
  VersionData: null,
  ContentDocument: {
    Id: "069xx0000000001",
    Title: "Spec Sheet",
    CreatedDate: "2024-01-01T00:00:00.000Z",
    ContentSize: 2048,
    LastModifiedDate: "2024-01-02T00:00:00.000Z",
    FileExtension: "pdf",
    LastModifiedById: "005xx0000000001",
    LastModifiedBy: {
      Name: "Jane Doe"
    },
    OwnerId: "005xx0000000002",
    Owner: {
      Name: "Alex Owner"
    }
  }
};

const baseFileRow = {
  version: baseVersion,
  linkedEntityId: "001xx0000000001",
  linkedEntityType: "Account"
};

describe("c-util mapFile", () => {
  it("maps a FileRow payload with Owner", () => {
    const mapped = mapFile(baseFileRow);

    expect(mapped.ContentDocumentId).toBe("069xx0000000001");
    expect(mapped.Title).toBe("Spec Sheet");
    expect(mapped.LastModifiedBy).toBe("Jane Doe");
    expect(mapped.LastModifiedByLink).toBe("/005xx0000000001");
    expect(mapped.Owner).toBe("Alex Owner");
    expect(mapped.OwnerLink).toBe("/005xx0000000002");
    expect(mapped.hasPreview).toBe(true);
    expect(mapped.icon).toBe("doctype:pdf");
    expect(mapped.downloadUrl).toBe(
      "/sfc/servlet.shepherd/document/download/069xx0000000001"
    );
  });

  it("maps a legacy ContentVersion payload without Owner", () => {
    const mapped = mapFile(baseVersion);

    expect(mapped.ContentDocumentId).toBe("069xx0000000001");
    expect(mapped.Owner).toBe("Alex Owner");
    expect(mapped.OwnerLink).toBe("/005xx0000000002");
  });

  it("does not throw when LastModifiedBy is missing", () => {
    const fileWithoutModifier = {
      ...baseFileRow,
      version: {
        ...baseVersion,
        ContentDocument: {
          ...baseVersion.ContentDocument,
          LastModifiedBy: undefined
        }
      }
    };

    expect(() => mapFile(fileWithoutModifier)).not.toThrow();
    const mapped = mapFile(fileWithoutModifier);
    expect(mapped.LastModifiedBy).toBe("");
    expect(mapped.LastModifiedByLink).toBe("/005xx0000000001");
  });

  it("does not throw when LastModifiedById is missing", () => {
    const fileWithoutModifierId = {
      ...baseFileRow,
      version: {
        ...baseVersion,
        ContentDocument: {
          ...baseVersion.ContentDocument,
          LastModifiedById: undefined,
          LastModifiedBy: undefined
        }
      }
    };

    const mapped = mapFile(fileWithoutModifierId);
    expect(mapped.LastModifiedBy).toBe("");
    expect(mapped.LastModifiedByLink).toBeNull();
  });

  it("does not throw when ContentDocument is missing", () => {
    const fileWithoutDocument = {
      version: {
        Id: "068xx0000000002",
        ContentDocumentId: "069xx0000000002",
        VersionData: null
      }
    };

    expect(() => mapFile(fileWithoutDocument)).not.toThrow();
    const mapped = mapFile(fileWithoutDocument);
    expect(mapped.ContentDocumentId).toBe("069xx0000000002");
    expect(mapped.LastModifiedBy).toBe("");
    expect(mapped.LastModifiedByLink).toBeNull();
    expect(mapped.Owner).toBe("");
    expect(mapped.OwnerLink).toBeNull();
    expect(mapped.fileUrl).toBeNull();
    expect(mapped.icon).toBe("doctype:unknown");
  });
});

describe("c-util file type filter", () => {
  it("categorizes image and document extensions", () => {
    expect(getFileTypeCategory("jpg")).toBe("image");
    expect(getFileTypeCategory(".PNG")).toBe("image");
    expect(getFileTypeCategory("pdf")).toBe("document");
    expect(getFileTypeCategory("bin")).toBe("other");
  });

  it("matches file type filters", () => {
    expect(matchesFileTypeFilter("jpg", "all")).toBe(true);
    expect(matchesFileTypeFilter("jpg", "image")).toBe(true);
    expect(matchesFileTypeFilter("jpg", "document")).toBe(false);
    expect(matchesFileTypeFilter("pdf", "document")).toBe(true);
  });
});

describe("c-util getConsoleParentTabId", () => {
  it("uses tabId when parentTabId is undefined", () => {
    expect(
      getConsoleParentTabId({ tabId: "primary-tab", parentTabId: undefined })
    ).toBe("primary-tab");
  });

  it("uses tabId when parentTabId is null", () => {
    expect(
      getConsoleParentTabId({ tabId: "primary-tab", parentTabId: null })
    ).toBe("primary-tab");
  });

  it("uses parentTabId when nested under a primary tab", () => {
    expect(
      getConsoleParentTabId({
        tabId: "nested-subtab",
        parentTabId: "parent-tab"
      })
    ).toBe("parent-tab");
  });
});
