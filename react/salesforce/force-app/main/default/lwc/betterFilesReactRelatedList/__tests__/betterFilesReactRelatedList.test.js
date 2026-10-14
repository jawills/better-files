import {
  IsConsoleNavigation,
  EnclosingTabId,
  setTabLabel,
  setTabIcon
} from "lightning/platformWorkspaceApi";
import { createElement } from "lwc";
import { registerRefreshHandler, unregisterRefreshHandler } from "lightning/refresh";
import RelatedList from "c/betterFilesReactRelatedList";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import getFiles from "@salesforce/apex/FileListController.getRelatedListFiles";
import getCount from "@salesforce/apex/FileListController.getRelatedListFileCount";
import getConfig from "@salesforce/apex/FileListController.getRelatedListConfig";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import getExtensions from "@salesforce/apex/FileListController.getRelatedListFileExtensions";
import deleteFiles from "@salesforce/apex/FileListController.deleteFiles";
jest.mock(
  "@salesforce/apex/FileListController.getRelatedListFiles",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/FileListController.getRelatedListFileCount",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/FileListController.getRelatedListConfig",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/FileListController.getRecordName",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/FileListController.getRelatedListFileExtensions",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/FileListController.deleteFiles",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/BetterFilesReactUpload.completeUpload",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/resourceUrl/betterFilesReact",
  () => ({ default: "/resource/betterFilesReact" }),
  { virtual: true }
);
jest.mock(
  "lightning/refresh",
  () => ({
    registerRefreshHandler: jest.fn(),
    unregisterRefreshHandler: jest.fn()
  }),
  { virtual: true }
);
jest.mock("lightning/navigation", () => {
  const Navigate = Symbol("Navigate");
  const NavigationMixin = (Base) =>
    class extends Base {
      [Navigate](page) {
        NavigationMixin.navigate(page);
      }
    };
  NavigationMixin.Navigate = Navigate;
  NavigationMixin.navigate = jest.fn();
  return {
    NavigationMixin,
    CurrentPageReference:
      require("@salesforce/sfdx-lwc-jest").createTestWireAdapter(jest.fn())
  };
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function props() {
  return document
    .querySelector("c-better-files-react-related-list")
    .shadowRoot.querySelector("c-better-files-embedding").config;
}
beforeEach(() => {
  registerRefreshHandler.mockImplementation((context) => {
    if (!(context instanceof HTMLElement))
      throw new TypeError("Invalid contextElement. Must be an HTMLElement or LightningElement.");
    return 456;
  });
  document.title = "Salesforce";
  getFiles.mockResolvedValue([{ documentId: "069x" }]);
  getCount.mockResolvedValue(1);
  getConfig.mockResolvedValue({ filterMode: "Advanced" });
  getRecordName.mockResolvedValue("1Sync");
  getExtensions.mockResolvedValue(["txt"]);
});
afterEach(() => {
  document.body.replaceChildren();
  jest.clearAllMocks();
});
async function mount(Component = RelatedList) {
  const element = createElement("c-better-files-react-related-list", {
    is: Component
  });
  document.body.appendChild(element);
  CurrentPageReference.emit({
    state: {
      file1sync__recordId: "001a",
      file1sync__objectName: "Account",
      file1sync__includeEmails: "false",
      file1sync__minimumFileSizeKb: "2"
    }
  });
  await flush();
  return element;
}
it("passes scoped server queries, metadata, and mapped rows", async () => {
  await mount();
  const config = props();
  expect(await config.adapter.info()).toEqual({
    recordName: "1Sync",
    config: { filterMode: "Advanced" },
    extensions: ["txt"]
  });
  const query = {
    page: 1,
    searchTerm: "budget",
    fileTypeFilter: "extension:txt",
    sortBy: "Title",
    sortDirection: "asc"
  };
  expect(await config.adapter.load(query)).toEqual({
    rows: [{ documentId: "069x" }],
    total: 1
  });
  expect(getFiles).toHaveBeenCalledWith({
    ...query,
    recordId: "001a",
    includeEmails: false,
    minContentSize: 2048,
    fileLimit: 25
  });
  expect(getCount).toHaveBeenCalledWith({
    recordId: "001a",
    includeEmails: false,
    minContentSize: 2048,
    searchTerm: "budget",
    fileTypeFilter: "extension:txt"
  });
});
it("updates the record scope when navigation changes", async () => {
  await mount();
  CurrentPageReference.emit({
    state: { c__recordId: "001b", c__objectName: "Account" }
  });
  await flush();
  expect(props().context.recordId).toBe("001b");
  await props().adapter.load({
    page: 0,
    sortBy: "Title",
    sortDirection: "asc",
    searchTerm: "",
    fileTypeFilter: "all"
  });
  expect(getFiles).toHaveBeenLastCalledWith(
    expect.objectContaining({ recordId: "001b" })
  );
});
it("normalizes Salesforce errors and verifies deletion results", async () => {
  await mount();
  const config = props();
  deleteFiles.mockRejectedValueOnce({ body: { message: "Access denied" } });
  await expect(config.adapter.delete([{ documentId: "069x" }])).rejects.toThrow(
    "Access denied"
  );
  deleteFiles.mockResolvedValueOnce([]);
  await expect(config.adapter.delete([{ documentId: "069x" }])).rejects.toThrow(
    "Deletion not confirmed"
  );
  deleteFiles.mockResolvedValueOnce(["069x"]);
  await config.adapter.delete([{ documentId: "069x" }]);
  config.actions.preview({ documentId: "069x" });
  expect(NavigationMixin.navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({ state: { selectedRecordId: "069x" } })
  );
  config.actions.download([
    { documentId: "069x", versionId: "068x" },
    { documentId: "069y", versionId: "068y" }
  ]);
  expect(NavigationMixin.navigate).toHaveBeenLastCalledWith({
    type: "standard__webPage",
    attributes: { url: "/sfc/servlet.shepherd/version/download/068x/068y?" }
  });
});

it("names the browser tab and leaves a later page's title alone on disconnect", async () => {
  const element = await mount();
  IsConsoleNavigation.emit(false);
  expect(document.title).toBe("Files | Salesforce");
  await props().adapter.info();
  expect(document.title).toBe("1Sync · Files | Salesforce");
  document.title = "Accounts | Salesforce";
  element.remove();
  expect(document.title).toBe("Accounts | Salesforce");
});
it("labels the enclosing console tab when its ID arrives after record data", async () => {
  const element = await mount();
  IsConsoleNavigation.emit({ data: true });
  await props().adapter.info();
  expect(setTabLabel).not.toHaveBeenCalled();
  EnclosingTabId.emit({ data: "files-tab" });
  expect(setTabLabel).toHaveBeenLastCalledWith("files-tab", "1Sync · Files");
  expect(setTabIcon).toHaveBeenLastCalledWith("files-tab", "standard:file", {
    iconAlt: "Files"
  });
  expect(document.title).toBe("Salesforce");
  element.remove();
});
it("ignores a stale record name and restores its previous browser title", async () => {
  const element = await mount();
  IsConsoleNavigation.emit(false);
  let resolveOld;
  getRecordName.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  const oldInfo = props().adapter.info();
  CurrentPageReference.emit({
    state: { c__recordId: "001b", c__objectName: "Account" }
  });
  await flush();
  getRecordName.mockResolvedValueOnce("Acme");
  await props().adapter.info();
  resolveOld("Old record");
  await oldInfo;
  expect(document.title).toBe("Acme · Files | Salesforce");
  element.remove();
  expect(document.title).toBe("Salesforce");
});

it("registers an HTML host, refreshes the embedded list, and unregisters on disconnect", async () => {
  const element = await mount();
  const [context, refresh] = registerRefreshHandler.mock.calls[0];
  expect(context === element).toBe(true);
  expect(await refresh()).toBe(true);
  await flush();
  expect(props().revision).toBe(1);
  element.remove();
  expect(unregisterRefreshHandler).toHaveBeenCalledWith(456);
  document.body.appendChild(element);
  await flush();
  expect(registerRefreshHandler).toHaveBeenCalledTimes(2);
  expect(registerRefreshHandler.mock.calls[1][0] === element).toBe(true);
});

it("loads and names the list when Locker hides LightningElement.isConnected", async () => {
  class LockerRelatedList extends RelatedList {
    get isConnected() {
      return undefined;
    }
  }
  await mount(LockerRelatedList);
  IsConsoleNavigation.emit(false);
  expect(props().context.recordId).toBe("001a");
  await props().adapter.info();
  expect(document.title).toBe("1Sync · Files | Salesforce");
});
