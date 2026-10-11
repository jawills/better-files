import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { UploadFileCard } from "@/components/upload-file-card";
import { FileSurface } from "@/components/file-surface";
import type { FileCardProps } from "@/model";
import { RenderBoundary } from "@/components/render-boundary";

const roots = new WeakMap<HTMLElement, Root>();

/** One root per host element. The host must unmount before detaching it. */
export function mountView<Props>(
  container: HTMLElement,
  view: (props: Props) => ReactNode,
  props: Props
) {
  if (roots.has(container))
    throw new Error("A React view is already mounted in this container.");
  const root = createRoot(container);
  roots.set(container, root);
  let active = true;
  root.render(<RenderBoundary>{view(props)}</RenderBoundary>);
  return {
    update(next: Props) {
      if (!active) throw new Error("Cannot update an unmounted React view.");
      root.render(<RenderBoundary>{view(next)}</RenderBoundary>);
    },
    unmount() {
      if (!active) return;
      active = false;
      root.unmount();
      roots.delete(container);
    }
  };
}

export function mountFiles(container: HTMLElement, props: FileCardProps) {
  return mountView(
    container,
    (next) => (
      <FileSurface>
        <UploadFileCard {...next} />
      </FileSurface>
    ),
    props
  );
}
