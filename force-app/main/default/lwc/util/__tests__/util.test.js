import { mapFile, getConsoleParentTabId } from "c/util";

const baseFile = {
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
    }
  }
};

describe("c-util mapFile", () => {
  it("maps a complete ContentVersion payload", () => {
    const mapped = mapFile(baseFile);

    expect(mapped.ContentDocumentId).toBe("069xx0000000001");
    expect(mapped.Title).toBe("Spec Sheet");
    expect(mapped.LastModifiedBy).toBe("Jane Doe");
    expect(mapped.LastModifiedByLink).toBe("/005xx0000000001");
    expect(mapped.hasPreview).toBe(true);
    expect(mapped.icon).toBe("doctype:pdf");
  });

  it("does not throw when LastModifiedBy is missing", () => {
    const fileWithoutModifier = {
      ...baseFile,
      ContentDocument: {
        ...baseFile.ContentDocument,
        LastModifiedBy: undefined
      }
    };

    expect(() => mapFile(fileWithoutModifier)).not.toThrow();
    const mapped = mapFile(fileWithoutModifier);
    expect(mapped.LastModifiedBy).toBe("");
    expect(mapped.LastModifiedByLink).toBe("/005xx0000000001");
  });

  it("does not throw when LastModifiedById is missing", () => {
    const fileWithoutModifierId = {
      ...baseFile,
      ContentDocument: {
        ...baseFile.ContentDocument,
        LastModifiedById: undefined,
        LastModifiedBy: undefined
      }
    };

    const mapped = mapFile(fileWithoutModifierId);
    expect(mapped.LastModifiedBy).toBe("");
    expect(mapped.LastModifiedByLink).toBeNull();
  });

  it("does not throw when ContentDocument is missing", () => {
    const fileWithoutDocument = {
      Id: "068xx0000000002",
      ContentDocumentId: "069xx0000000002",
      VersionData: null
    };

    expect(() => mapFile(fileWithoutDocument)).not.toThrow();
    const mapped = mapFile(fileWithoutDocument);
    expect(mapped.ContentDocumentId).toBeUndefined();
    expect(mapped.LastModifiedBy).toBe("");
    expect(mapped.LastModifiedByLink).toBeNull();
    expect(mapped.fileUrl).toBeNull();
    expect(mapped.icon).toBe("doctype:unknown");
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
