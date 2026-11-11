import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "@/components/portal-context";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

// shadcn/ui Base UI menu: portals and focus guards stay inside the LWC.
export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 4,
  ...props
}: Omit<Menu.Popup.Props, "className"> &
  Pick<Menu.Positioner.Props, "align" | "sideOffset"> & {
    className?: string;
  }) {
  const container = usePortalContainer();
  if (!container) return null;
  return (
    <Menu.Portal container={container}>
      <Menu.Positioner
        align={align}
        sideOffset={sideOffset}
        className="bf:z-50"
      >
        <Menu.Popup
          className={cn(
            "bf:min-w-[9rem] bf:rounded-md bf:border bf:border-border bf:bg-popover bf:p-[0.25rem] bf:text-popover-foreground bf:shadow-md",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: Omit<Menu.Item.Props, "className"> & { className?: string }) {
  return (
    <Menu.Item
      className={cn(
        "bf:flex bf:cursor-pointer bf:items-center bf:gap-[0.5rem] bf:rounded-sm bf:px-[0.75rem] bf:py-[0.5rem] bf:outline-none bf:data-highlighted:bg-accent bf:data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}
