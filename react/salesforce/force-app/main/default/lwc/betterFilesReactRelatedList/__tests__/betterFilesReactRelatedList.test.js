import {
  IsConsoleNavigation,
  EnclosingTabId,
  setTabLabel,
  setTabIcon
} from "lightning/platformWorkspaceApi";
import { createElement } from "lwc";
import RelatedList from "c/betterFilesReactRelatedList";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import getFiles from "@salesforce/apex/FileListController.getRelatedListFiles";
import getCount from "@salesforce/apex/FileListController.getRelatedListFileCount";
import getConfig from "@salesforce/apex/FileListController.getRelatedListConfig";
import getRecordName from "@salesforce/apex/FileListController.getRecordName";
import getExtensions from "@salesforce/apex/FileListController.getRelatedListFileExtensions";
import deleteFiles from "@salesforce/apex/FileListController.deleteFiles";
import uploadFile from "@salesforce/apex/BetterFilesReactUpload.uploadFile";
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
  "@salesforce/apex/BetterFilesReactUpload.uploadFile",
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
let instances;
let library;
beforeEach(() => {
  document.title = "Salesforce";
  instances = [];
  library = {
    defaultSettings: {},
    fromSalesforceRelatedFile: (row) => ({ ...row, mapped: true }),
    fileToBase64: jest.fn().mockResolvedValue("dGVzdA=="),
    mountRelatedList: jest.fn((container, props) => {
      const instance = { props, update: jest.fn(), unmount: jest.fn() };
      instances.push(instance);
      return instance;
    })
  };
  window.BetterFilesReact = library;
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
async function mount() {
  const element = createElement("c-better-files-react-related-list", {
    is: RelatedList
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
  const props = instances[0].props;
  expect(await props.adapter.info()).toEqual({
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
  expect(await props.adapter.load(query)).toEqual({
    files: [{ documentId: "069x", mapped: true }],
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
it("remounts on context changes and keeps in-flight uploads bound to their original record", async () => {
  const element = await mount();
  const old = instances[0];
  CurrentPageReference.emit({
    state: { c__recordId: "001b", c__objectName: "Account" }
  });
  await flush();
  expect(old.unmount).toHaveBeenCalledTimes(1);
  expect(instances[1].props.context.recordId).toBe("001b");
  uploadFile.mockResolvedValue("068x");
  await old.props.adapter.upload({ name: "test.txt" }, old.props.context);
  expect(uploadFile).toHaveBeenCalledWith({
    filename: "test.txt",
    base64: "dGVzdA==",
    recordId: "001a"
  });
  element.remove();
  expect(instances[1].unmount).toHaveBeenCalledTimes(1);
});
it("normalizes Salesforce errors and verifies deletion results", async () => {
  await mount();
  const props = instances[0].props;
  deleteFiles.mockRejectedValueOnce({ body: { message: "Access denied" } });
  await expect(props.adapter.delete([{ documentId: "069x" }])).rejects.toThrow(
    "Access denied"
  );
  deleteFiles.mockResolvedValueOnce([]);
  await expect(props.adapter.delete([{ documentId: "069x" }])).rejects.toThrow(
    "Deletion not confirmed"
  );
  deleteFiles.mockResolvedValueOnce(["069x"]);
  await props.adapter.delete([{ documentId: "069x" }]);
  props.actions.preview({ documentId: "069x" });
  expect(NavigationMixin.navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({ state: { selectedRecordId: "069x" } })
  );
  props.actions.download([
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
  await instances[0].props.adapter.info();
  expect(document.title).toBe("1Sync · Files | Salesforce");
  document.title = "Accounts | Salesforce";
  element.remove();
  expect(document.title).toBe("Accounts | Salesforce");
});
it("labels the enclosing console tab when its ID arrives after record data", async () => {
  const element = await mount();
  IsConsoleNavigation.emit({ data: true });
  await instances[0].props.adapter.info();
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
  const oldInfo = instances[0].props.adapter.info();
  CurrentPageReference.emit({
    state: { c__recordId: "001b", c__objectName: "Account" }
  });
  await flush();
  getRecordName.mockResolvedValueOnce("Acme");
  await instances[1].props.adapter.info();
  resolveOld("Old record");
  await oldInfo;
  expect(document.title).toBe("Acme · Files | Salesforce");
  element.remove();
  expect(document.title).toBe("Salesforce");
});
