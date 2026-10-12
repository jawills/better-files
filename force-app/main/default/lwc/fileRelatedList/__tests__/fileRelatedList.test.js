import { createElement } from "lwc";
import FileRelatedList from "c/fileRelatedList";
import { CurrentPageReference } from "lightning/navigation";
import getRelatedListFiles from "@salesforce/apex/FileListController.getRelatedListFiles";
import getRelatedListFileCount from "@salesforce/apex/FileListController.getRelatedListFileCount";
import getRelatedListFileExtensions from "@salesforce/apex/FileListController.getRelatedListFileExtensions";
import deleteFile from "@salesforce/apex/FileListController.deleteFile";
import deleteFiles from "@salesforce/apex/FileListController.deleteFiles";
import LightningConfirm from "lightning/confirm";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import getRelatedListConfig from "@salesforce/apex/FileListController.getRelatedListConfig";

const mockFile = {
  version: {
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
  },
  linkedEntityId: "001xx0000000001",
  linkedEntityType: "Account"
};

jest.mock(
  "@salesforce/apex/FileListController.getRelatedListFileExtensions",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "lightning/confirm",
  () => ({ __esModule: true, default: { open: jest.fn() } }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.getRelatedListFiles",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.getRelatedListFileCount",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.getRecordName",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.deleteFile",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.deleteFiles",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.getRelatedListConfig",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter(jest.fn())
    };
  },
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createComponent() {
  const element = createElement("c-file-related-list", {
    is: FileRelatedList
  });
  document.body.appendChild(element);
  return element;
}

function emitPageReference(recordId = "001xx0000000001") {
  CurrentPageReference.emit({
    type: "standard__component",
    attributes: {
      componentName: "file1sync__fileRelatedList"
    },
    state: {
      c__recordId: recordId,
      c__objectName: "Account",
      c__includeEmails: false
    }
  });
}

function emitDefaultConfig() {
  getRelatedListConfig.emit({
    showOwner: true,
    showLastModifiedDate: true,
    showLastModifiedBy: true,
    showFileSize: true
  });
}

function mockListData(files = [mockFile], count = files.length) {
  getRelatedListFiles.mockResolvedValue(files);
  getRelatedListFileCount.mockResolvedValue(count);
}

async function loadRelatedList(
  element,
  files = [mockFile],
  count = files.length
) {
  mockListData(files, count);
  emitPageReference();
  emitDefaultConfig();
  await flushPromises();
  // Wait for the existing layout remount before tests retain a table reference.
  await new Promise(requestAnimationFrame);
  await flushPromises();
  return element;
}

describe("c-file-related-list", () => {
  beforeEach(() => {
    getRecordName.mockResolvedValue("Acme");
    getRelatedListFileExtensions.mockResolvedValue(["pdf", "png"]);
    deleteFile.mockResolvedValue(mockFile.version.ContentDocumentId);
    deleteFiles.mockResolvedValue([mockFile.version.ContentDocumentId]);
    LightningConfirm.open.mockResolvedValue(true);
    mockListData();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("clears the skeleton after files load", async () => {
    const element = createComponent();
    await loadRelatedList(element);

    expect(
      element.shadowRoot.querySelector(".slds-page-header")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("updates the title with the file count", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 5);

    expect(element.shadowRoot.querySelector("h2").textContent).toBe(
      "Files (5)"
    );
  });

  it("clears the skeleton when file load errors", async () => {
    const element = createComponent();
    getRelatedListFiles.mockRejectedValue(new Error("load failed"));
    getRelatedListFileCount.mockResolvedValue(0);
    emitPageReference();
    emitDefaultConfig();
    await flushPromises();
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-page-header")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("renders files when LastModifiedBy is missing on a row", async () => {
    const element = createComponent();
    const fileWithoutModifier = {
      ...mockFile,
      version: {
        ...mockFile.version,
        ContentDocument: {
          ...mockFile.version.ContentDocument,
          LastModifiedBy: undefined
        }
      }
    };

    await loadRelatedList(element, [fileWithoutModifier], 1);

    expect(
      element.shadowRoot.querySelector("c-file-data-table")
    ).not.toBeNull();
  });

  it("replaces loaded files on refresh instead of appending", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 1);

    const secondFile = {
      ...mockFile,
      version: {
        ...mockFile.version,
        Id: "068xx0000000002",
        ContentDocument: {
          ...mockFile.version.ContentDocument,
          Id: "069xx0000000002",
          Title: "Second File"
        }
      }
    };

    mockListData([secondFile], 1);
    emitPageReference();
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe(
      "Files (1)"
    );
    expect(getRelatedListFiles).toHaveBeenCalled();
  });

  it("does not show Get More when loaded file count matches total", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 1);

    expect(element.shadowRoot.querySelector("[data-id='get-more']")).toBeNull();
  });

  it("does not show Get More when the list is empty but count is higher", async () => {
    const element = createComponent();
    await loadRelatedList(element, [], 3);

    expect(element.shadowRoot.querySelector("[data-id='get-more']")).toBeNull();
  });

  it("shows Get More when more files exist than are loaded", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 30);

    expect(
      element.shadowRoot.querySelector("[data-id='get-more']")
    ).not.toBeNull();
  });

  it("hides Get More when the next page returns no new files", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 30);

    getRelatedListFiles.mockResolvedValueOnce([]);
    const getMore = element.shadowRoot.querySelector("[data-id='get-more']");
    getMore.click();
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector("[data-id='get-more']")).toBeNull();
    expect(
      element.shadowRoot.querySelector("c-file-data-table")
    ).not.toBeNull();
  });

  it("loads files via non-cacheable apex on navigation", async () => {
    const element = createComponent();
    const uploadedFile = {
      ...mockFile,
      version: {
        ...mockFile.version,
        Id: "068xx0000000099",
        ContentDocument: {
          ...mockFile.version.ContentDocument,
          Id: "069xx0000000099",
          Title: "Just Uploaded"
        }
      }
    };

    await loadRelatedList(element, [uploadedFile, mockFile], 2);

    expect(getRelatedListFiles).toHaveBeenCalled();
    expect(getRelatedListFileCount).toHaveBeenCalled();
    expect(element.shadowRoot.querySelector("h2").textContent).toBe(
      "Files (2)"
    );
  });

  it("loads files when state uses the package namespace prefix", async () => {
    const element = createComponent();
    mockListData([mockFile], 1);
    CurrentPageReference.emit({
      type: "standard__component",
      attributes: {
        componentName: "file1sync__fileRelatedList"
      },
      state: {
        file1sync__recordId: "001xx0000000001",
        file1sync__objectName: "Account",
        file1sync__includeEmails: "true"
      }
    });
    emitDefaultConfig();
    await flushPromises();
    await flushPromises();

    expect(getRelatedListFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "001xx0000000001",
        includeEmails: true
      })
    );
    expect(
      element.shadowRoot.querySelector("c-file-data-table")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector("h2").textContent).toBe(
      "Files (1)"
    );
  });

  it("coerces string includeEmails from URL state to a boolean for Apex", async () => {
    const element = createComponent();
    mockListData([mockFile], 1);
    CurrentPageReference.emit({
      type: "standard__component",
      attributes: {
        componentName: "file1sync__fileRelatedList"
      },
      state: {
        c__recordId: "001xx0000000001",
        c__objectName: "Account",
        c__includeEmails: "true"
      }
    });
    emitDefaultConfig();
    await flushPromises();
    await flushPromises();

    expect(getRelatedListFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        includeEmails: true
      })
    );
    expect(
      element.shadowRoot.querySelector("c-file-data-table")
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("[data-id='empty-table']")
    ).toBeNull();
  });

  it("shows the Apex error when file load fails", async () => {
    const element = createComponent();
    getRelatedListFiles.mockRejectedValue({
      body: {
        message:
          "Value provided is invalid for action parameter 'includeEmails' of type 'Boolean'"
      }
    });
    getRelatedListFileCount.mockResolvedValue(0);
    emitPageReference();
    emitDefaultConfig();
    await flushPromises();
    await flushPromises();

    const errorEl = element.shadowRoot.querySelector("[data-id='load-error']");
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toContain("includeEmails");
    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Files");
  });

  it("renders the file table inside the page header detail row", async () => {
    const element = createComponent();
    await loadRelatedList(element);

    const table = element.shadowRoot.querySelector(
      ".slds-page-header__detail-row c-file-data-table"
    );
    expect(table).not.toBeNull();
  });

  it("does not set fixed column widths so the datatable can fill the page", async () => {
    const element = createComponent();
    await loadRelatedList(element);

    const table = element.shadowRoot.querySelector("c-file-data-table");
    expect(table.columns.every((col) => col.fixedWidth === undefined)).toBe(
      true
    );
    expect(table.columns.every((col) => col.initialWidth === undefined)).toBe(
      true
    );
  });

  it.each([
    ["fileUrl", "Title"],
    [undefined, "Title"],
    ["OwnerLink", "Owner"],
    ["LastModifiedDate", "LastModifiedDate"],
    ["LastModifiedByLink", "LastModifiedBy"],
    ["ContentSize", "ContentSize"]
  ])(
    "sorts %s by its server field %s in both directions",
    async (fieldName, sortBy) => {
      const element = createComponent();
      await loadRelatedList(element);
      const table = element.shadowRoot.querySelector("c-file-data-table");
      expect(table.sortedBy).toBe("LastModifiedDate");
      expect(table.sortedDirection).toBe("desc");
      expect(table.columns.filter((column) => column.sortable)).toHaveLength(5);

      for (const sortDirection of ["asc", "desc"]) {
        table.dispatchEvent(
          new CustomEvent("sort", {
            detail: { fieldName, sortDirection }
          })
        );
        await flushPromises();
        expect(getRelatedListFiles).toHaveBeenLastCalledWith(
          expect.objectContaining({
            sortBy,
            sortDirection,
            page: 0
          })
        );
        expect(table.sortedBy).toBe(fieldName ?? "fileUrl");
        expect(table.sortedDirection).toBe(sortDirection);
      }
    }
  );

  it("restarts pagination on sort and ignores an older page response", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 30);
    let finishOldPage;
    getRelatedListFiles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldPage = resolve;
        })
    );
    element.shadowRoot.querySelector("[data-id='get-more']").click();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 })
    );

    const sortedFile = {
      ...mockFile,
      version: {
        ...mockFile.version,
        Id: "068xx0000000002",
        ContentDocumentId: "069xx0000000002",
        ContentDocument: {
          ...mockFile.version.ContentDocument,
          Id: "069xx0000000002",
          Title: "A First File"
        }
      }
    };
    getRelatedListFiles.mockResolvedValue([sortedFile]);
    const table = element.shadowRoot.querySelector("c-file-data-table");
    table.dispatchEvent(
      new CustomEvent("sort", {
        detail: { fieldName: "fileUrl", sortDirection: "asc" }
      })
    );
    await flushPromises();
    finishOldPage([mockFile]);
    await flushPromises();
    expect(table.data.map((file) => file.Title)).toEqual(["A First File"]);
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, sortBy: "Title" })
    );

    element.shadowRoot.querySelector("[data-id='get-more']").click();
    await flushPromises();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        sortBy: "Title",
        sortDirection: "asc"
      })
    );
  });

  it("keeps sorting through search, clearing search, and file-type changes", async () => {
    const element = createComponent();
    await loadRelatedList(element, [mockFile], 30);
    const table = element.shadowRoot.querySelector("c-file-data-table");
    const search = element.shadowRoot.querySelector("lightning-input");
    search.value = "Spec";
    search.dispatchEvent(new CustomEvent("change"));
    // Sorting while the search is debounced must run only the current query.
    table.dispatchEvent(
      new CustomEvent("sort", {
        detail: { fieldName: "ContentSize", sortDirection: "asc" }
      })
    );
    await flushPromises();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchTerm: "Spec",
        sortBy: "ContentSize",
        sortDirection: "asc",
        page: 0
      })
    );
    expect(getRelatedListFileCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchTerm: "Spec" })
    );

    element.shadowRoot.querySelector("[data-id='get-more']").click();
    await flushPromises();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchTerm: "Spec",
        sortBy: "ContentSize",
        page: 1
      })
    );

    search.value = "";
    search.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchTerm: "",
        sortBy: "ContentSize",
        page: 0
      })
    );

    element.shadowRoot.querySelector("lightning-combobox").dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "image" }
      })
    );
    await flushPromises();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fileTypeFilter: "image",
        sortBy: "ContentSize",
        sortDirection: "asc",
        page: 0
      })
    );
  });

  it("discards an in-flight search when the search is cleared", async () => {
    const element = createComponent();
    await loadRelatedList(element);
    let finishSearch;
    getRelatedListFiles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSearch = resolve;
        })
    );
    const search = element.shadowRoot.querySelector("lightning-input");
    jest.useFakeTimers();
    search.value = "missing";
    search.dispatchEvent(new CustomEvent("change"));
    jest.advanceTimersByTime(350);
    jest.useRealTimers();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchTerm: "missing" })
    );
    search.value = "";
    search.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    finishSearch([]);
    await flushPromises();
    expect(
      element.shadowRoot.querySelector("c-file-data-table").data
    ).toHaveLength(1);
  });
  it.each([undefined, "Basic", "unknown"])(
    "keeps basic filters for mode %s",
    async (filterMode) => {
      const element = createComponent();
      emitPageReference();
      getRelatedListConfig.emit({ filterMode });
      await flushPromises();
      expect(
        element.shadowRoot.querySelector("lightning-combobox").options
      ).toEqual([
        { label: "All files", value: "all" },
        { label: "Images", value: "image" },
        { label: "Documents", value: "document" }
      ]);
      expect(getRelatedListFileExtensions).not.toHaveBeenCalled();
    }
  );

  it.each([true, false])(
    "loads record-wide types when config arrives first: %s",
    async (configFirst) => {
      const element = createComponent();
      getRelatedListFileExtensions.mockResolvedValue(["", "pdf", "png"]);
      if (configFirst) getRelatedListConfig.emit({ filterMode: "Advanced" });
      emitPageReference();
      await flushPromises();
      if (!configFirst) getRelatedListConfig.emit({ filterMode: "Advanced" });
      await flushPromises();
      const filter = element.shadowRoot.querySelector("lightning-combobox");
      expect(filter.options).toEqual([
        { label: "All files", value: "all" },
        { label: "No extension", value: "extension:" },
        { label: "PDF", value: "extension:pdf" },
        { label: "PNG", value: "extension:png" }
      ]);
      expect(getRelatedListFileExtensions).toHaveBeenCalledWith({
        recordId: "001xx0000000001",
        includeEmails: false,
        minContentSize: null
      });
      // Only a PDF is loaded, but the server discovered PNG and extensionless files too.
      expect(
        element.shadowRoot.querySelector("c-file-data-table").data
      ).toHaveLength(1);
      filter.dispatchEvent(
        new CustomEvent("change", { detail: { value: "extension:png" } })
      );
      await flushPromises();
      expect(getRelatedListFiles).toHaveBeenLastCalledWith(
        expect.objectContaining({ fileTypeFilter: "extension:png", page: 0 })
      );
      expect(getRelatedListFileCount).toHaveBeenLastCalledWith(
        expect.objectContaining({ fileTypeFilter: "extension:png" })
      );
      expect(getRelatedListFileExtensions).toHaveBeenCalledTimes(1);
    }
  );

  it("keeps advanced options stable through search and pagination", async () => {
    const element = createComponent();
    mockListData([mockFile], 30);
    getRelatedListConfig.emit({ filterMode: "Advanced" });
    emitPageReference();
    await flushPromises();
    const filter = element.shadowRoot.querySelector("lightning-combobox");
    const options = filter.options;
    filter.dispatchEvent(
      new CustomEvent("change", { detail: { value: "extension:pdf" } })
    );
    await flushPromises();
    const search = element.shadowRoot.querySelector("lightning-input");
    jest.useFakeTimers();
    search.value = "Spec";
    search.dispatchEvent(new CustomEvent("change"));
    jest.advanceTimersByTime(350);
    jest.useRealTimers();
    await flushPromises();
    expect(getRelatedListFileCount).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchTerm: "Spec",
        fileTypeFilter: "extension:pdf"
      })
    );
    element.shadowRoot.querySelector("[data-id='get-more']").click();
    await flushPromises();
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        searchTerm: "Spec",
        fileTypeFilter: "extension:pdf"
      })
    );
    expect(filter.options).toEqual(options);
    expect(getRelatedListFileExtensions).toHaveBeenCalledTimes(1);
  });

  it("discovers newly uploaded types and retains the selected type", async () => {
    const element = createComponent();
    getRelatedListFileExtensions.mockResolvedValue(["pdf"]);
    getRelatedListConfig.emit({ filterMode: "Advanced" });
    emitPageReference();
    await flushPromises();
    const filter = element.shadowRoot.querySelector("lightning-combobox");
    filter.dispatchEvent(
      new CustomEvent("change", { detail: { value: "extension:pdf" } })
    );
    await flushPromises();
    getRelatedListFileExtensions.mockResolvedValue(["pdf", "xlsx"]);
    element.shadowRoot
      .querySelector("lightning-file-upload")
      .dispatchEvent(new CustomEvent("uploadfinished"));
    await flushPromises();
    expect(filter.value).toBe("extension:pdf");
    expect(filter.options).toContainEqual({
      label: "XLSX",
      value: "extension:xlsx"
    });
    expect(getRelatedListFileExtensions).toHaveBeenCalledTimes(2);
  });

  it.each(["single", "bulk"])(
    "resets to All files after %s deletion removes the selected type",
    async (action) => {
      const element = createComponent();
      getRelatedListConfig.emit({ filterMode: "Advanced" });
      emitPageReference();
      await flushPromises();
      const filter = element.shadowRoot.querySelector("lightning-combobox");
      filter.dispatchEvent(
        new CustomEvent("change", { detail: { value: "extension:pdf" } })
      );
      await flushPromises();
      getRelatedListFileExtensions.mockResolvedValue(["png"]);
      const table = element.shadowRoot.querySelector("c-file-data-table");
      if (action === "single") {
        table.dispatchEvent(
          new CustomEvent("rowaction", {
            detail: { action: { name: "Delete" }, row: table.data[0] }
          })
        );
      } else {
        table.dispatchEvent(
          new CustomEvent("rowselection", {
            detail: { selectedRows: table.data }
          })
        );
        await flushPromises();
        [...element.shadowRoot.querySelectorAll("lightning-button")]
          .find((button) => button.label === "Delete")
          .click();
      }
      await flushPromises();
      expect(action === "single" ? deleteFile : deleteFiles).toHaveBeenCalled();
      expect(filter.value).toBe("all");
      expect(filter.options).toEqual([
        { label: "All files", value: "all" },
        { label: "PNG", value: "extension:png" }
      ]);
      expect(getRelatedListFiles).toHaveBeenLastCalledWith(
        expect.objectContaining({ fileTypeFilter: "all", page: 0 })
      );
      expect(getRelatedListFileCount).toHaveBeenLastCalledWith(
        expect.objectContaining({ fileTypeFilter: "all" })
      );
    }
  );

  it("ignores stale types after navigation and respects the new record context", async () => {
    const element = createComponent();
    let finishOldTypes;
    getRelatedListFileExtensions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldTypes = resolve;
        })
    );
    getRelatedListConfig.emit({ filterMode: "Advanced" });
    emitPageReference();
    await flushPromises();
    getRelatedListFileExtensions.mockResolvedValue([]);
    CurrentPageReference.emit({
      state: {
        c__recordId: "001xx0000000002",
        c__objectName: "Account",
        c__includeEmails: "true",
        c__minimumFileSizeKb: "10"
      }
    });
    await flushPromises();
    finishOldTypes(["pdf"]);
    await flushPromises();
    expect(getRelatedListFileExtensions).toHaveBeenLastCalledWith({
      recordId: "001xx0000000002",
      includeEmails: true,
      minContentSize: 10240
    });
    expect(
      element.shadowRoot.querySelector("lightning-combobox").options
    ).toEqual([{ label: "All files", value: "all" }]);
    expect(getRelatedListFiles).toHaveBeenCalledTimes(1);
  });

  it("returns to basic filters when the mode changes", async () => {
    const element = createComponent();
    getRelatedListConfig.emit({ filterMode: "Advanced" });
    emitPageReference();
    await flushPromises();
    element.shadowRoot
      .querySelector("lightning-combobox")
      .dispatchEvent(
        new CustomEvent("change", { detail: { value: "extension:pdf" } })
      );
    await flushPromises();
    emitDefaultConfig();
    await flushPromises();
    expect(element.shadowRoot.querySelector("lightning-combobox").value).toBe(
      "all"
    );
    expect(
      element.shadowRoot.querySelector("lightning-combobox").options
    ).toHaveLength(3);
    expect(getRelatedListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ fileTypeFilter: "all" })
    );
  });

  it("shows extension discovery failures and retries on refresh", async () => {
    const element = createComponent();
    getRelatedListFileExtensions.mockRejectedValueOnce({
      body: { message: "Unable to read file types" }
    });
    getRelatedListConfig.emit({ filterMode: "Advanced" });
    emitPageReference();
    await flushPromises();
    expect(
      element.shadowRoot.querySelector("[data-id='load-error']").textContent
    ).toContain("Unable to read file types");
    expect(getRelatedListFiles).not.toHaveBeenCalled();
    element.shadowRoot
      .querySelector("lightning-file-upload")
      .dispatchEvent(new CustomEvent("uploadfinished"));
    await flushPromises();
    expect(
      element.shadowRoot.querySelector("[data-id='load-error']")
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector("lightning-combobox").options
    ).toHaveLength(3);
  });
});
