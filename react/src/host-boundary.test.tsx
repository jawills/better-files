import { afterEach, describe, expect, it, vi } from "vitest";
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
import { FixtureCard } from "./demo/fixture-card";
import { fixtureContext, getFixtureState } from "./demo/fixtures";
import { defaultSettings, type FileCardProps } from "./model";
import { mountFiles } from "./mount";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function props(): FileCardProps {
  return {
    context: fixtureContext,
    settings: defaultSettings,
    state: getFixtureState("Populated"),
    actions: {
      preview: vi.fn(),
      viewAll: vi.fn(),
      requestUpload: vi.fn(),
      retry: vi.fn()
    }
  };
}

describe("Salesforce host boundary", () => {
  it("updates host context without remounting, rejects duplicate mounts, and cleans up for reuse", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const initial = props();
    let view: ReturnType<typeof mountFiles>;
    await act(async () => {
      view = mountFiles(container, initial);
    });
    expect(
      within(container).getByRole("button", { name: "Files (12)" })
    ).toBeInTheDocument();
    expect(() => mountFiles(container, initial)).toThrow("already mounted");
    const next = {
      ...initial,
      context: { recordId: "another-record", objectApiName: "Case" },
      settings: { ...defaultSettings, includeEmails: false },
      state: getFixtureState("Empty")
    };
    await act(async () => view.update(next));
    await userEvent.click(
      within(container).getByRole("button", { name: "Files (0)" })
    );
    expect(initial.actions.viewAll).toHaveBeenCalledWith(
      next.context,
      next.settings
    );
    expect(
      within(container).queryByRole("button", { name: "View All" })
    ).not.toBeInTheDocument();
    await act(async () => view.unmount());
    expect(container).toBeEmptyDOMElement();
    expect(() => view.update(initial)).toThrow("unmounted");
    await act(async () => {
      view = mountFiles(container, initial);
    });
    expect(
      within(container).getByRole("button", { name: "Files (12)" })
    ).toBeInTheDocument();
    await act(async () => view.unmount());
    container.remove();
  });

  it("contains a preview in the correct instance and restores keyboard focus after Escape", async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(
      <>
        <FixtureCard label="first" />
        <FixtureCard label="second" />
      </>
    );
    const triggers = screen.getAllByRole("button", {
      name: "Preview Acme Services Agreement.pdf"
    });
    await user.click(triggers[1]);
    const dialog = screen.getByRole("dialog");
    const surfaces = container.querySelectorAll(".better-files");
    expect(surfaces[1]).toContainElement(dialog);
    expect(surfaces[0]).not.toContainElement(dialog);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Close preview" })
      ).toHaveFocus()
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await waitFor(() => expect(triggers[1]).toHaveFocus());
    await user.click(triggers[1]);
    unmount();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("supports keyboard upload selection through the host-owned menu", async () => {
    vi.spyOn(document.body, "insertAdjacentElement").mockImplementation(() => {
      throw new Error(
        "Lightning Web Security: body insertions are not allowed."
      );
    });
    const user = userEvent.setup();
    const { container } = render(<FixtureCard />);
    screen.getByRole("button", { name: "Show file actions" }).focus();
    await user.keyboard("{ArrowDown}");
    const item = await screen.findByRole("menuitem", { name: "Upload Files" });
    expect(container.querySelector(".better-files")).toContainElement(item);
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("status", { name: "Main card action" })
    ).toHaveTextContent("No file was uploaded");
  });

  it("recovers from a load error and replaces failed thumbnails with file-type icons", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FixtureCard scenario="Error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load files");
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Files (12)" })
    ).toBeInTheDocument();
    unmount();
    const { container } = render(<FixtureCard scenario="Missing thumbnails" />);
    const image = container.querySelector("img");
    if (!image) throw new Error("Fixture thumbnail is missing");
    const file = image.parentElement;
    fireEvent.error(image);
    expect(file?.querySelector("img")).toBeNull();
    expect(file?.querySelector("svg")).not.toBeNull();
  });
});
