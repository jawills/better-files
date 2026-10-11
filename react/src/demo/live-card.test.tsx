import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./app";
import type { LiveFiles } from "./live-record";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads record files and opens their actual local content in the owning card", async () => {
  const data: LiveFiles = {
    recordName: "Test account",
    recordUrl:
      "https://example.my.salesforce.com/lightning/r/Account/test/related",
    files: [
      {
        versionId: "068test",
        documentId: "069test",
        title: "Logo.png",
        extension: "png",
        sizeBytes: 2000,
        modifiedAt: "2026-10-09",
        source: "record"
      }
    ]
  };
  const fetchFiles = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => data });
  vi.stubGlobal("fetch", fetchFiles);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText("Live files: Test account account in better-files.");
  expect(fetchFiles).toHaveBeenCalledTimes(1);
  const main = within(
    screen.getByRole("region", { name: "Main record region" })
  );
  await user.click(main.getByRole("button", { name: "Preview Logo.png" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("img")).toHaveAttribute(
    "src",
    "/__salesforce/content/068test"
  );
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  await user.keyboard("{Escape}");
  expect(main.getByRole("button", { name: "Preview Logo.png" })).toHaveFocus();
});

it("recovers from a failed record read with the card retry action", async () => {
  const fetchFiles = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValue({
      ok: true,
      json: async () => ({ recordName: "Empty", recordUrl: "", files: [] })
    });
  vi.stubGlobal("fetch", fetchFiles);
  const user = userEvent.setup();
  render(<App />);
  const retry = await screen.findAllByRole("button", { name: "Try Again" });
  await user.click(retry[0]);
  expect(await screen.findAllByText("No files yet.")).toHaveLength(2);
  expect(fetchFiles).toHaveBeenCalledTimes(2);
});
