import { Component, type PropsWithChildren } from "react";
import { FileSurface } from "./file-surface";

/** Keep a library or host compatibility failure visible instead of blanking the card. */
export class RenderBoundary extends Component<
  PropsWithChildren,
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.message) {
      return (
        <FileSurface>
          <p role="alert">Unable to display files: {this.state.message}</p>
        </FileSurface>
      );
    }
    return this.props.children;
  }
}
