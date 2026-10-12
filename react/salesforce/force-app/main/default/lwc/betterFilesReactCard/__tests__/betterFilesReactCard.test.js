import { createElement } from "lwc";
import BetterFilesReactCard from "c/betterFilesReactCard";
import getFiles from "@salesforce/apex/FileListController.getFiles";
import getFileCount from "@salesforce/apex/FileListController.getFileCount";
import completeUpload from "@salesforce/apex/BetterFilesReactUpload.completeUpload";
import { refreshApex } from "@salesforce/apex";
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
  "@salesforce/apex/BetterFilesReactUpload.completeUpload",
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
  return document
    .querySelector("c-better-files-react-card")
    .shadowRoot.querySelector("c-better-files-embedding").config;
}
beforeEach(() => {
  refreshApex.mockResolvedValue();
  completeUpload.mockResolvedValue("068000000000001AAA");
});
afterEach(() => {
  while (document.body.firstChild) document.body.firstChild.remove();
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
  await flush();
  expect(props().settings).toMatchObject({
    filePreview: false,
    filesPerRow: 2
  });
  element.fileLimit = 2;
  await flush();
  expect(getFiles.getLastConfig().fileLimit).toBe(2);
  getFiles.emit([]);
  await flush();
  expect(props().state).toEqual({ status: "ready", rows: [], total: 7 });
  element.fileLimit = "2";
  await flush();
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
  await flush();
  expect(props().state).toEqual({ status: "ready", rows: [], total: 0 });
});

it("clears previous record data and unregisters refresh on disconnect", async () => {
  const element = createCard();
  ready();
  await flush();
  element.recordId = "001000000000002AAA";
  await flush();
  expect(props().state).toEqual({ status: "loading" });
  expect(props().context.recordId).toBe("001000000000002AAA");
  expect(getFiles.getLastConfig().recordId).toBe("001000000000002AAA");
  element.remove();
  expect(unregisterRefreshHandler).toHaveBeenCalledWith(123);
});
it("refreshes both wires and preserves refresh errors", async () => {
  createCard();
  ready();
  await flush();
  await props().upload.refresh();
  expect(refreshApex).toHaveBeenCalledTimes(2);
  refreshApex.mockRejectedValueOnce(new Error("Refresh unavailable"));
  await expect(props().upload.refresh()).rejects.toThrow("Refresh unavailable");
  const handler = registerRefreshHandler.mock.calls[0][1];
  expect(await handler()).toBe(true);
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
  await flush();
  expect(props().state).toEqual({ status: "error", message: "No file access" });
});

it("waits for a record before rendering the embedding host", async () => {
  const element = createCard();
  element.recordId = undefined;
  await flush();
  expect(element.shadowRoot.textContent).toContain("Select a record");
  expect(
    element.shadowRoot.querySelector("c-better-files-embedding")
  ).toBeNull();
});
