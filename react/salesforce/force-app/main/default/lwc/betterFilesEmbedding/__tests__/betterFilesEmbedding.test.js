import { createElement } from "lwc";
import Embedding from "c/betterFilesEmbedding";
import completeUpload from "@salesforce/apex/BetterFilesReactUpload.completeUpload";
jest.mock(
  "@salesforce/apex/BetterFilesReactUpload.completeUpload",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => {
  document.body.replaceChildren();
  jest.clearAllMocks();
});
async function mount() {
  const element = createElement("c-better-files-embedding", { is: Embedding });
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
  return element.shadowRoot.querySelector("lightning-ui-embedding");
}
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
