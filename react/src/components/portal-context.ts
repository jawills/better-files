import { createContext, useContext } from "react";

// Keep overlays inside the host, including its styles and security boundary.
export const PortalContext = createContext<HTMLElement | null>(null);
export function usePortalContainer() {
  return useContext(PortalContext);
}
