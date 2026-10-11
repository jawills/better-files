import { createElement } from "lwc";
import BetterFilesReactCard from "c/betterFilesReactCard";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import uploadFile from "@salesforce/apex/BetterFilesReactUpload.uploadFile";
import { refreshApex } from "@salesforce/apex";
import { loadScript } from "lightning/platformResourceLoader";
import {
  registerRefreshHandler,
  unregisterRefreshHandler
} from "lightning/refresh";
import { NavigationMixin } from "lightning/navigation";

jest.mock(
  "@salesforce/apex/FileListController.getFiles",
  () => ({
    default: require("@salesforce/sfdx-lwc-jest").createApexTestWireAdapter(
      jest.fn()
    )
  }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/FileListController.getFileCount",
  () => ({
    default: require("@salesforce/sfdx-lwc-jest").createApexTestWireAdapter(
      jest.fn()
    )
  }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/BetterFilesReactUpload.uploadFile",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex",
  () => ({ refreshApex: jest.fn().mockResolvedValue() }),
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
    registerRefreshHandler: jest.fn().mockReturnValue(123),
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
  return { NavigationMixin };
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
let instances;
let library;
function createCard(recordId = "001000000000001AAA") {
  const element = createElement("c-better-files-react-card", {
    is: BetterFilesReactCard
  });
  element.recordId = recordId;
  element.objectApiName = "Account";
  document.body.appendChild(element);
  return element;
}
function ready(total = 1) {
  getFiles.emit([{ title: "Proposal", documentId: "069000000000001AAA" }]);
  getFileCount.emit(total);
}
function props() {
  const instance = instances[instances.length - 1];
  return instance.update.mock.calls.at(-1)?.[0] ?? instance.initial;
}

beforeEach(() => {
  instances = [];
  library = {
    defaultSettings: {
      accept: ".txt",
      multiple: true,
      filePreview: true,
      fileLimit: 6,
      filesPerRow: 3,
      includeEmails: true,
      minimumFileSizeKb: 0
    },
    fromSalesforceFile: (file) => file,
    fileToBase64: jest.fn().mockResolvedValue("dGVzdA=="),
    mountFiles: jest.fn((container, initial) => {
      const instance = { initial, update: jest.fn(), unmount: jest.fn() };
      instances.push(instance);
      return instance;
    })
  };
  window.BetterFilesReact = library;
  loadScript.mockResolvedValue();
  refreshApex.mockResolvedValue();
  uploadFile.mockResolvedValue("068000000000001AAA");
});
afterEach(() => {
  while (document.body.firstChild) document.body.firstChild.remove();
  delete window.BetterFilesReact;
  jest.clearAllMocks();
});

it("defaults wire settings, updates display options, and keeps the count when only the row limit changes", async () => {
  const element = createCard();
  await flush();
  expect(getFiles.getLastConfig()).toMatchObject({
    fileLimit: 6,
    includeEmails: true,
    minContentSize: null
  });
  ready(7);
  await flush();
  expect(props().state).toMatchObject({ status: "ready", total: 7 });
  element.filePreview = false;
  element.filesPerRow = 2;
  expect(props().settings).toMatchObject({
    filePreview: false,
    filesPerRow: 2
  });
  element.fileLimit = 2;
  await flush();
  expect(getFiles.getLastConfig().fileLimit).toBe(2);
  getFiles.emit([]);
  expect(props().state).toEqual({ status: "ready", files: [], total: 7 });
  element.fileLimit = "2";
  expect(props().state.status).toBe("ready");
  element.includeEmails = false;
  element.minimumFileSizeKb = 10;
  await flush();
  expect(getFileCount.getLastConfig()).toMatchObject({
    includeEmails: false,
    minContentSize: 10240
  });
  expect(props().state.status).toBe("loading");
  getFiles.emit([]);
  getFileCount.emit(0);
  expect(props().state).toEqual({ status: "ready", files: [], total: 0 });
});

it("unmounts the previous record and clears its files before navigating to another record", async () => {
  const element = createCard();
  await flush();
  ready();
  const previous = instances[0];
  element.recordId = "001000000000002AAA";
  await flush();
  expect(previous.unmount).toHaveBeenCalledTimes(1);
  expect(props().state).toEqual({ status: "loading" });
  expect(props().context.recordId).toBe("001000000000002AAA");
  expect(getFiles.getLastConfig().recordId).toBe("001000000000002AAA");
  ready(0);
  expect(props().state.total).toBe(0);
  element.remove();
  expect(instances[1].unmount).toHaveBeenCalledTimes(1);
  expect(unregisterRefreshHandler).toHaveBeenCalledWith(123);
  document.body.appendChild(element);
  await flush();
  expect(library.mountFiles).toHaveBeenCalledTimes(3);
  expect(registerRefreshHandler).toHaveBeenCalledTimes(2);
});

it("uses the captured upload context, refreshes both wires, and preserves upload and refresh errors", async () => {
  createCard();
  await flush();
  ready();
  const adapter = props().upload;
  await adapter.send({ name: "test.txt" }, { recordId: "001000000000001AAA" });
  expect(uploadFile).toHaveBeenCalledWith({
    filename: "test.txt",
    base64: "dGVzdA==",
    recordId: "001000000000001AAA"
  });
  await adapter.refresh();
  expect(refreshApex).toHaveBeenCalledTimes(2);
  uploadFile.mockRejectedValueOnce({
    body: { message: "Insufficient access" }
  });
  await expect(
    adapter.send({ name: "test.txt" }, props().context)
  ).rejects.toThrow("Insufficient access");
  refreshApex.mockRejectedValueOnce(new Error("Refresh unavailable"));
  await expect(adapter.refresh()).rejects.toThrow("Refresh unavailable");
  const handler = registerRefreshHandler.mock.calls[0][1];
  expect(await handler()).toBe(true);
  refreshApex.mockRejectedValueOnce(new Error("Refresh unavailable"));
  expect(await handler()).toBe(false);
});

it("routes native preview and View All with the current record and filters", async () => {
  const element = createCard();
  element.includeEmails = false;
  element.minimumFileSizeKb = 5;
  await flush();
  ready();
  props().actions.preview({ documentId: "069000000000001AAA" });
  expect(NavigationMixin.navigate).toHaveBeenLastCalledWith({
    type: "standard__namedPage",
    attributes: { pageName: "filePreview" },
    state: { selectedRecordId: "069000000000001AAA" }
  });
  props().actions.viewAll(props().context, props().settings);
  expect(NavigationMixin.navigate.mock.calls.at(-1)[0].state).toEqual({
    file1sync__recordId: element.recordId,
    file1sync__objectName: "Account",
    file1sync__includeEmails: "false",
    file1sync__minimumFileSizeKb: "5"
  });
  getFiles.error({ message: "No file access" });
  expect(props().state).toEqual({ status: "error", message: "No file access" });
});

it("retries a failed resource load and waits for a record before mounting", async () => {
  loadScript.mockRejectedValueOnce(new Error("Resource unavailable"));
  const element = createCard(undefined);
  element.recordId = undefined;
  await flush();
  expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toBe(
    "Resource unavailable"
  );
  element.shadowRoot.querySelector("lightning-button").click();
  await flush();
  expect(element.shadowRoot.textContent).toContain("Select a record");
  expect(library.mountFiles).not.toHaveBeenCalled();
  element.recordId = "001000000000001AAA";
  await flush();
  expect(library.mountFiles).toHaveBeenCalledTimes(1);
});

it("does not mount after disconnecting during library loading", async () => {
  let finish;
  loadScript.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const element = createCard();
  element.remove();
  finish();
  await flush();
  expect(library.mountFiles).not.toHaveBeenCalled();
});
