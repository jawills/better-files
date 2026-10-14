import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadFileCard } from "./components/upload-file-card";
import { FileSurface } from "./components/file-surface";
import { defaultSettings, type FileCardProps } from "./model";
import { MAX_UPLOAD_BYTES, validateUpload } from "./upload";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function props(): FileCardProps {
  return {
    context: { recordId: "account-test", objectApiName: "Account" },
    settings: defaultSettings,
    state: { status: "ready", files: [], total: 0 },
    actions: {
      preview: vi.fn(),
      viewAll: vi.fn(),
      requestUpload: vi.fn(),
      retry: vi.fn()
    },
    upload: { send: vi.fn().mockResolvedValue(undefined), refresh: vi.fn() }
  };
}
function renderCard(value = props()) {
  const result = render(
    <FileSurface>
      <UploadFileCard {...value} />
    </FileSurface>
  );
  const region = result.container.querySelector(".bf-drop-region");
  if (!region) throw new Error("Missing drop region");
  return { ...result, region, value };
}
const file = (name: string) =>
  new File(["example"], name, { type: "text/plain" });
const drop = (target: Element, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { types: ["Files"], files } });

it("uploads a dropped batch sequentially, reports mixed outcomes, and refreshes once without duplicating on a second drop", async () => {
  const value = props();
  let finish: () => void = () => {};
  const send = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    )
    .mockRejectedValueOnce(new Error("Access denied"))
    .mockResolvedValue(undefined);
  value.upload = { send, refresh: vi.fn() };
  const { region } = renderCard(value);
  drop(region, [file("one.txt"), file("two.txt"), file("three.txt")]);
  expect(screen.getByRole("dialog")).toHaveTextContent("Uploading files");
  expect(send).toHaveBeenCalledTimes(1);
  drop(region, [file("duplicate.txt")]);
  await act(async () => finish());
  await screen.findByText("Upload results");
  expect(send).toHaveBeenCalledTimes(3);
  expect(send.mock.calls.map((call) => call[0].name)).toEqual([
    "one.txt",
    "two.txt",
    "three.txt"
  ]);
  expect(screen.getByRole("dialog")).toHaveTextContent("2 of 3 files uploaded");
  expect(screen.getByRole("alert")).toHaveTextContent("two.txt: Access denied");
  expect(screen.getAllByRole("status")).toHaveLength(2);
  expect(value.upload.refresh).toHaveBeenCalledTimes(1);
});

it("rejects unsafe filename characters while allowing Unicode filenames", () => {
  for (const name of ["folder/file.txt", "folder\\file.txt", "null\u0000.txt", "control\u001f.txt"]) {
    expect(validateUpload({ name, size: 1, type: "text/plain" }, defaultSettings))
      .toContain("filename without path separators");
  }
  expect(validateUpload({ name: "Résumé 📄.txt", size: 1, type: "text/plain" }, defaultSettings))
    .toBeUndefined();
});

it("rejects type, empty, oversize, and multiple-file violations before sending", async () => {
  expect(
    validateUpload(
      { name: "large.txt", type: "text/plain", size: MAX_UPLOAD_BYTES },
      defaultSettings
    )
  ).toBeUndefined();
  expect(
    validateUpload(
      { name: "large.txt", type: "text/plain", size: MAX_UPLOAD_BYTES + 1 },
      defaultSettings
    )
  ).toContain("2 MB");
  const { region, value } = renderCard();
  drop(region, [file("unsafe.html"), new File([], "empty.txt")]);
  await screen.findByText("Upload results");
  expect(value.upload?.send).not.toHaveBeenCalled();
  cleanup();
  const single = props();
  single.settings = { ...defaultSettings, multiple: false };
  const second = renderCard(single);
  drop(second.region, [file("one.txt"), file("two.txt")]);
  expect(
    within(screen.getByRole("dialog")).getAllByText(
      "Choose one file at a time."
    )
  ).toHaveLength(2);
  expect(single.upload?.send).not.toHaveBeenCalled();
});

it("uses the file picker and restores focus, and reports refresh failure without marking the upload failed", async () => {
  const value = props();
  value.upload = {
    send: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockRejectedValue(new Error("Offline"))
  };
  const { container } = renderCard(value);
  const user = userEvent.setup();
  const button = screen.getAllByRole("button", { name: "Upload Files" })[0];
  await user.click(button);
  const input = screen.getByLabelText("Choose files to upload");
  await user.upload(input, file("picker.txt"));
  await screen.findByText("Upload results");
  expect(screen.getByRole("dialog")).toHaveTextContent("1 of 1 files uploaded");
  expect(screen.getByRole("alert")).toHaveTextContent("list could not refresh");
  expect(container.querySelector(".bf-portals")).toContainElement(
    screen.getByRole("dialog")
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(button).toHaveFocus());
});

it("keeps the overlay over nested children and ignores non-file drags", () => {
  const { region } = renderCard();
  fireEvent.dragEnter(region, { dataTransfer: { types: ["text/plain"] } });
  expect(screen.queryByText("Drop files to upload")).toBeNull();
  const event = { dataTransfer: { types: ["Files"] } };
  fireEvent.dragEnter(region, event);
  fireEvent.dragEnter(region.querySelector("header")!, event);
  fireEvent.dragLeave(region.querySelector("header")!, event);
  expect(screen.getByText("Drop files to upload")).toBeInTheDocument();
  fireEvent.dragLeave(region, event);
  expect(screen.queryByText("Drop files to upload")).toBeNull();
});
