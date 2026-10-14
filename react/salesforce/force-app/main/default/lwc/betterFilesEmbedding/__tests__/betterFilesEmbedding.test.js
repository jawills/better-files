import { createElement } from "lwc";
import Embedding from "c/betterFilesEmbedding";
import completeUpload from "@salesforce/apex/BetterFilesReactUpload.completeUpload";
import getReactAppUrl from "@salesforce/apex/FileListController.getReactAppUrl";
jest.mock(
  "@salesforce/apex/FileListController.getReactAppUrl",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/BetterFilesReactUpload.completeUpload",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const subscriberAppUrl = "https://subscriber--file1sync.my.salesforce.app/app/file1sync__BetterFilesReact";
beforeEach(() => {
  getReactAppUrl.mockResolvedValue(subscriberAppUrl);
});
afterEach(() => {
  document.body.replaceChildren();
  jest.clearAllMocks();
});
async function mountComponent(Component = Embedding) {
  const element = createElement("c-better-files-embedding", { is: Component });
  element.view = "card";
  element.config = {
    context: { recordId: "001a", objectApiName: "Account" },
    settings: {},
    state: { status: "loading" },
    upload: { refresh: jest.fn() },
    actions: { preview: jest.fn() }
  };
  document.body.appendChild(element);
  await flush();
  return element;
}
async function mount(Component = Embedding) {
  const element = await mountComponent(Component);
  return element.shadowRoot.querySelector("lightning-ui-embedding");
}
it("uses the automatically discovered subscriber app URL", async () => {
  const host = await mount();
  expect(host.src).toBe(subscriberAppUrl);
});
it.each([
  undefined,
  "http://subscriber.salesforce.app/app/file1sync__BetterFilesReact",
  "https://subscriber.salesforce.app.attacker.example/app/file1sync__BetterFilesReact",
  "https://subscriber.salesforce.app/app/anotherApp",
  `${subscriberAppUrl}?redirect=https://attacker.example`,
  "https://user:password@subscriber.salesforce.app/app/file1sync__BetterFilesReact"
])("does not create an iframe for a missing or invalid app URL: %s", async (reactAppUrl) => {
  getReactAppUrl.mockResolvedValue(reactAppUrl);
  const element = await mountComponent();
  expect(element.shadowRoot.querySelector("lightning-ui-embedding")).toBeNull();
  expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain("app is unavailable");
  expect(completeUpload).not.toHaveBeenCalled();
});
it("reports app discovery access errors without creating an iframe", async () => {
  getReactAppUrl.mockRejectedValue(new Error("Access denied"));
  const element = await mountComponent();
  expect(element.shadowRoot.querySelector("lightning-ui-embedding")).toBeNull();
  expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain("permissions");
});
it("publishes body metadata using the current host record and returns confirmation", async () => {
  const host = await mount();
  expect(JSON.stringify(host.props)).not.toContain("actions");
  expect(JSON.parse(host.props.payload).context.recordId).toBe("001a");
  completeUpload.mockResolvedValue("068a");
  const replies = [];
  host.addEventListener("bfresponse", (event) =>
    replies.push(JSON.parse(event.detail))
  );
  host.dispatchEvent(
    new CustomEvent("bfrequest", {
      detail: {
        id: "request-1",
        recordId: "001a",
        operation: "completeUpload",
        args: [{ filename: "large.txt", contentBodyId: "05Ta" }]
      }
    })
  );
  await flush();
  expect(completeUpload).toHaveBeenCalledWith({
    filename: "large.txt",
    contentBodyId: "05Ta",
    recordId: "001a"
  });
  expect(replies[0]).toMatchObject({ id: "request-1", result: "068a" });
});
it("rejects stale-record requests before calling Apex", async () => {
  const host = await mount();
  const replies = [];
  host.addEventListener("bfresponse", (event) =>
    replies.push(JSON.parse(event.detail))
  );
  host.dispatchEvent(
    new CustomEvent("bfrequest", {
      detail: {
        id: "old",
        recordId: "001old",
        operation: "completeUpload",
        args: [{ filename: "large.txt", contentBodyId: "05Ta" }]
      }
    })
  );
  await flush();
  expect(completeUpload).not.toHaveBeenCalled();
  expect(replies[0].error).toContain("record changed");
});

it("loads and replies when Locker hides LightningElement.isConnected", async () => {
  class LockerEmbedding extends Embedding {
    get isConnected() {
      return undefined;
    }
  }
  const host = await mount(LockerEmbedding);
  expect(host?.src).toBe(subscriberAppUrl);
  const replies = [];
  host.addEventListener("bfresponse", (event) =>
    replies.push(JSON.parse(event.detail))
  );
  completeUpload.mockResolvedValue("068locker");
  host.dispatchEvent(new CustomEvent("bfrequest", {
    detail: {
      id: "locker", recordId: "001a", operation: "completeUpload",
      args: [{ filename: "test.txt", contentBodyId: "05Ta" }]
    }
  }));
  await flush();
  expect(replies).toEqual([{ id: "locker", result: "068locker" }]);
});

it("ignores app discovery that finishes after the host disconnects", async () => {
  let resolveUrl;
  getReactAppUrl.mockReturnValueOnce(new Promise((resolve) => {
    resolveUrl = resolve;
  }));
  const element = await mountComponent();
  element.remove();
  resolveUrl(subscriberAppUrl);
  await flush();
  expect(element.shadowRoot.querySelector("lightning-ui-embedding")).toBeNull();
});
