import { useState, type ComponentProps } from "react";
import { PortalContext } from "@/components/portal-context";
import { cn } from "@/lib/utils";
import type { FileTheme } from "@/model";

/** Contains both the React UI and its portalled overlays within the host. */
export function FileSurface({
  children,
  className,
  theme,
  ...props
}: ComponentProps<"div"> & { theme?: FileTheme }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div
      {...props}
      data-files-surface
      // Overlays portal inside the surface, so they take its theme too.
      data-theme={theme}
      className={cn(
        "bf:font-sans bf:text-base bf:leading-normal bf:text-foreground bf:text-left bf:scheme-light",
        // A scoped reset replaces global Preflight. :where lets element utilities override it.
        "bf:[:where(&,&_*,&_::before,&_::after)]:box-border",
        "bf:[:where(&_*,&_::before,&_::after)]:border-0 bf:[:where(&_*,&_::before,&_::after)]:border-solid bf:[:where(&_*,&_::before,&_::after)]:border-border",
        "bf:[:where(&_button)]:[font:inherit] bf:[:where(&_button)]:text-inherit bf:[:where(&_button)]:cursor-pointer bf:[:where(&_button)]:bg-transparent bf:[:where(&_button)]:p-0",
        "bf:[:where(&_h2,&_p,&_ul)]:m-0 bf:[:where(&_ul)]:list-none bf:[:where(&_ul)]:p-0",
        "bf:[:where(&_button,&_input,&_select,&_a,&_[tabindex='0'],&_[role='menuitem'])]:focus-visible:outline-2 bf:[:where(&_button,&_input,&_select,&_a,&_[tabindex='0'],&_[role='menuitem'])]:focus-visible:outline-solid bf:[:where(&_button,&_input,&_select,&_a,&_[tabindex='0'],&_[role='menuitem'])]:focus-visible:outline-primary bf:[:where(&_button,&_input,&_select,&_a,&_[tabindex='0'],&_[role='menuitem'])]:focus-visible:outline-offset-2",
        "bf:[:where(&_svg)]:block bf:[:where(&_svg)]:shrink-0",
        className
      )}
    >
      <PortalContext value={container}>
        {children}
        <div data-files-portals ref={setContainer} />
      </PortalContext>
    </div>
  );
}
