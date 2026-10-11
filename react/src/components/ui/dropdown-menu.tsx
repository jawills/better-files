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
            "bf:min-w-36 bf:rounded-md bf:border bf:border-border bf:bg-popover bf:p-1 bf:text-popover-foreground bf:shadow-md",
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
        "bf:flex bf:cursor-pointer bf:items-center bf:gap-2 bf:rounded-sm bf:px-3 bf:py-2 bf:outline-none bf:data-highlighted:bg-accent bf:data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}
