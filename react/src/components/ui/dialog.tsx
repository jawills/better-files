import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { usePortalContainer } from "@/components/portal-context";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// shadcn/ui Base UI dialog with overlays contained within the Salesforce host.
export function DialogContent({
  className,
  children,
  closeLabel = "Close preview",
  ...props
}: Omit<DialogPrimitive.Popup.Props, "className"> & {
  className?: string;
  closeLabel?: string;
}) {
  const container = usePortalContainer();
  if (!container) return null;
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Backdrop className="bf-dialog-backdrop bf:fixed bf:inset-0 bf:bg-black/40" />
      <DialogPrimitive.Popup
        className={cn(
          "bf-dialog bf:fixed bf:left-1/2 bf:top-1/2 bf:w-[calc(100%-32px)] bf:max-w-md bf:-translate-x-1/2 bf:-translate-y-1/2 bf:rounded-md bf:border bf:border-border bf:bg-background bf:p-6 bf:shadow-lg",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="bf-dialog-close"
          aria-label={closeLabel}
        >
          <X size={16} aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
