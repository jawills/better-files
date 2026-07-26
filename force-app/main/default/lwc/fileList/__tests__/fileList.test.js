import { createElement } from "lwc";
import FileList from "c/fileList";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import {
  IsConsoleNavigation,
  getFocusedTabInfo,
  openSubtab
} from "lightning/platformWorkspaceApi";

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
  "@salesforce/apex/FileListController.uploadFile",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/resourceUrl/dropzone",
  () => ({ default: "/resource/dropzone" }),
  { virtual: true }
);

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createComponent() {
  const element = createElement("c-file-list", {
    is: FileList
  });
  element.recordId = "001xx0000000001";
  element.objectApiName = "Account";
  element.fileLimit = 6;
  element.includeEmails = false;
  element.filePreview = true;
  document.body.appendChild(element);
  return element;
}

describe("c-file-list console and wire resilience", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("clears the skeleton when getFiles errors", async () => {
    const element = createComponent();

    getFiles.error();
    await flushPromises();

    expect(
      element.shadowRoot.querySelector("a.slds-card__header-link")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("clears the skeleton when getFileCount errors", async () => {
    const element = createComponent();

    getFileCount.error();
    await flushPromises();

    expect(
      element.shadowRoot.querySelector("a.slds-card__header-link")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector("c-stencil")).toBeNull();
  });

  it("opens a console subtab using tabId when parentTabId is undefined", async () => {
    const element = createComponent();
    getFiles.emit([mockFile]);
    await flushPromises();

    IsConsoleNavigation.emit(true);
    getFocusedTabInfo.mockResolvedValue({
      tabId: "primary-tab",
      parentTabId: undefined
    });

    element.shadowRoot
      .querySelector("a.slds-card__header-link")
      .click();
    await flushPromises();

    expect(openSubtab).toHaveBeenCalledWith(
      "primary-tab",
      expect.objectContaining({
        label: "Files",
        pageReference: expect.objectContaining({
          type: "standard__component",
          state: expect.objectContaining({
            c__recordId: "001xx0000000001",
            c__objectName: "Account"
          })
        })
      })
    );
  });

  it("opens a console subtab using parentTabId when nested", async () => {
    const element = createComponent();
    getFiles.emit([mockFile]);
    await flushPromises();

    IsConsoleNavigation.emit(true);
    getFocusedTabInfo.mockResolvedValue({
      tabId: "nested-subtab",
      parentTabId: "parent-tab"
    });

    element.shadowRoot
      .querySelector("a.slds-card__header-link")
      .click();
    await flushPromises();

    expect(openSubtab).toHaveBeenCalledWith(
      "parent-tab",
      expect.objectContaining({ label: "Files" })
    );
  });

  it("opens a console subtab using tabId when parentTabId is null", async () => {
    const element = createComponent();
    getFiles.emit([mockFile]);
    await flushPromises();

    IsConsoleNavigation.emit(true);
    getFocusedTabInfo.mockResolvedValue({
      tabId: "primary-tab",
      parentTabId: null
    });

    element.shadowRoot
      .querySelector("a.slds-card__header-link")
      .click();
    await flushPromises();

    expect(openSubtab).toHaveBeenCalledWith(
      "primary-tab",
      expect.objectContaining({ label: "Files" })
    );
  });
});
