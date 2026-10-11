import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatedList } from "./components/related-list";
import { FileSurface } from "./components/file-surface";
import { defaultSettings } from "./model";
import {
  defaultRelatedConfig,
  type RelatedFile,
  type RelatedListProps
} from "./related-list";
afterEach(cleanup);
const file = (id: string): RelatedFile => ({
  documentId: id,
  versionId: `v${id}`,
  title: `File ${id}`,
  extension: "txt",
  modifiedAt: "2026-10-01T12:00:00Z",
  sizeBytes: 123,
  source: "record",
  owner: { name: "Justin", id: "005x" },
  modifiedBy: { name: "Justin" }
});
function setup(overrides: Partial<RelatedListProps["adapter"]> = {}) {
  const adapter = {
    info: vi.fn().mockResolvedValue({
      recordName: "Acme",
      config: defaultRelatedConfig,
      extensions: []
    }),
    load: vi.fn().mockResolvedValue({ files: [file("1")], total: 1 }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  const actions = {
    preview: vi.fn(),
    download: vi.fn(),
    record: vi.fn(),
    object: vi.fn()
  };
  render(
    <FileSurface>
      <RelatedList
        context={{ recordId: "001x", objectApiName: "Account" }}
        settings={defaultSettings}
        adapter={adapter}
        actions={actions}
      />
    </FileSurface>
  );
  return { adapter, actions, user: userEvent.setup() };
}
describe("related list", () => {
  it("retains rows after a failed append and retries the same page without duplicates", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ files: [file("1")], total: 3 })
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValueOnce({
        files: [file("1"), file("2"), file("3")],
        total: 3
      });
    const { user } = setup({ load });
    await screen.findByText("1 of 3 files loaded");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Network failed");
    expect(screen.getByRole("button", { name: "File 1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("3 of 3 files loaded");
    expect(load.mock.calls.map(([query]) => query.page)).toEqual([0, 1, 1]);
    expect(screen.getAllByRole("button", { name: "File 1" })).toHaveLength(1);
  });
  it("confirms bulk deletion, preserves selection on failure, and refreshes after success", async () => {
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error("No delete access"))
      .mockResolvedValueOnce(undefined);
    const { user, actions, adapter } = setup({ delete: remove });
    await screen.findByText("1 of 1 files loaded");
    await user.click(
      screen.getByRole("checkbox", { name: "Select all loaded files" })
    );
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(actions.download).toHaveBeenCalledWith([file("1")]);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("including other records");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText("No delete access");
    expect(
      screen.getByRole("checkbox", { name: "Select File 1", hidden: true })
    ).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(adapter.load).toHaveBeenCalledTimes(2);
  });
  it("ignores stale results after sort changes and clears selection", async () => {
    let resolveOld:
      | ((value: { files: RelatedFile[]; total: number }) => void)
      | undefined;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValue({ files: [file("new")], total: 1 });
    const { user } = setup({ load });
    await user.click(screen.getByRole("button", { name: "Title" }));
    await screen.findByRole("button", { name: "File new" });
    await act(async () => resolveOld?.({ files: [file("old")], total: 1 }));
    expect(
      screen.queryByRole("button", { name: "File old" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Select File new" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "File type" }),
      "image"
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Select File new" })
      ).not.toBeChecked()
    );
    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({
      page: 0,
      sortBy: "Title",
      sortDirection: "asc",
      fileTypeFilter: "image"
    });
  });
  it("debounces server search and honors advanced extensions and hidden columns", async () => {
    const { user, adapter } = setup({
      info: async () => ({
        recordName: "Acme",
        config: {
          ...defaultRelatedConfig,
          filterMode: "Advanced",
          showOwner: false
        },
        extensions: ["", "pdf"]
      })
    });
    await screen.findByRole("option", { name: "No extension" });
    expect(
      screen.queryByRole("columnheader", { name: "Owner" })
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "budget");
    await waitFor(() =>
      expect(adapter.load).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: "budget", page: 0 })
      )
    );
    await user.selectOptions(screen.getByRole("combobox"), "extension:");
    await waitFor(() =>
      expect(adapter.load).toHaveBeenLastCalledWith(
        expect.objectContaining({ fileTypeFilter: "extension:" })
      )
    );
  });
  it("refreshes the current query when an upload finishes after search changes", async () => {
    let finish: (() => void) | undefined;
    const upload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const { user, adapter } = setup({ upload });
    await screen.findByText("1 of 1 files loaded");
    await user.upload(
      screen.getByLabelText("Choose files to upload"),
      new File(["test"], "review.txt", { type: "text/plain" })
    );
    await screen.findByRole("dialog");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
    await user.type(screen.getByRole("searchbox"), "latest");
    await waitFor(() =>
      expect(adapter.load).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: "latest" })
      )
    );
    await act(async () => finish?.());
    await waitFor(() => expect(adapter.load).toHaveBeenCalledTimes(3));
    expect(adapter.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchTerm: "latest", page: 0 })
    );
    expect(
      screen.getByText("review.txt uploaded successfully.")
    ).toBeInTheDocument();
  });
});
