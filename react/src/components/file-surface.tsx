import { useState, type ComponentProps } from "react";
import { PortalContext } from "@/components/portal-context";

/** Contains both the React UI and its portalled overlays within the host. */
export function FileSurface({ children, ...props }: ComponentProps<"div">) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div className="better-files" {...props}>
      <PortalContext value={container}>
        {children}
        <div className="bf-portals" ref={setContainer} />
      </PortalContext>
    </div>
  );
}
