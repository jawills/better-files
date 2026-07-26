import { createElement } from "lwc";
import FileRelatedList from "c/fileRelatedList";
import { CurrentPageReference } from "lightning/navigation";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";

const mockFile = {
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

jest.mock(
  "@salesforce/apex/FileListController.getFiles",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter(jest.fn())
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.getFileCount",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter(jest.fn())
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/FileListController.getRecordName",
  () => {
    return {
      default: jest.fn()
    };
  },
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
  "@salesforce/apex/FileListController.searchContentVersions",
  () => ({ default: jest.fn() }),
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

describe("c-file-related-list console load resilience", () => {
  beforeEach(() => {
    getRecordName.mockResolvedValue("Acme");
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("clears the skeleton when files arrive before file count", async () => {
    const element = createComponent();
    emitPageReference();
    await flushPromises();

    // Intentionally emit files first — wiredFileCount is still undefined
    getFiles.emit([mockFile]);
    await flushPromises();

    expect(element.shadowRoot.querySelector(".slds-page-header")).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("updates additional-files state when file count arrives after files", async () => {
    const element = createComponent();
    emitPageReference();
    await flushPromises();

    getFiles.emit([mockFile]);
    await flushPromises();
    getFileCount.emit(5);
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Files (5)");
  });

  it("clears the skeleton when getFiles errors", async () => {
    const element = createComponent();
    emitPageReference();
    await flushPromises();

    getFiles.error();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".slds-page-header")).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("clears the skeleton when getFileCount errors", async () => {
    const element = createComponent();
    emitPageReference();
    await flushPromises();

    getFileCount.error();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".slds-page-header")).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("renders files when LastModifiedBy is missing on a row", async () => {
    const element = createComponent();
    emitPageReference();
    await flushPromises();

    const fileWithoutModifier = {
      ...mockFile,
      ContentDocument: {
        ...mockFile.ContentDocument,
        LastModifiedBy: undefined
      }
    };

    getFiles.emit([fileWithoutModifier]);
    getFileCount.emit(1);
    await flushPromises();

    expect(element.shadowRoot.querySelector(".slds-page-header")).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-file-data-table")).not.toBeNull();
  });
});
