import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { X } from "lucide-react";
import { usePortalContainer } from "@/components/portal-context";
import { cn } from "@/lib/utils";

// LWS stops parent traversal at the host. Base UI's document-wide aria hiding
// can consequently hide the host itself. The popup supplies modal semantics and
// traps Tab locally; the backdrop blocks pointer access outside it.
export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogPrimitive.Root {...props} modal={false} disablePointerDismissal />
  );
}
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// shadcn/ui Base UI dialog with overlays contained within the Salesforce host.
export function DialogContent({
  className,
  children,
  closeLabel = "Close preview",
  onKeyDownCapture,
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
          "bf-dialog bf:fixed bf:left-1/2 bf:top-1/2 bf:w-[calc(100%-32px)] bf:max-w-md bf:-translate-x-1/2 bf:-translate-y-1/2 bf:rounded-lg bf:border bf:border-border bf:bg-background bf:p-6 bf:shadow-lg",
          className
        )}
        {...props}
        aria-modal="true"
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event);
          if (event.key !== "Tab" || event.defaultPrevented) return;
          const popup = event.currentTarget;
          const elements = Array.from(
            popup.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
            )
          ).filter(
            (element) =>
              !element.hidden && element.getAttribute("aria-hidden") !== "true"
          );
          const first = elements[0];
          const last = elements.at(-1);
          if (!first || !last) {
            event.preventDefault();
            popup.focus();
            return;
          }
          if (
            event.shiftKey &&
            (event.target === first || event.target === popup)
          ) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            (event.target === last || event.target === popup)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
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
