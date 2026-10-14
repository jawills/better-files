import { Component, type PropsWithChildren } from "react";

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
        <div className="better-files">
          <p role="alert">Unable to display files: {this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
