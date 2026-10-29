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
export function DialogTitle({
  className,
  ...props
}: Omit<DialogPrimitive.Title.Props, "className"> & { className?: string }) {
  return (
    <DialogPrimitive.Title
      {...props}
      className={cn(
        "bf:m-0 bf:pr-5 bf:text-heading bf:font-semibold bf:wrap-anywhere",
        className
      )}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: Omit<DialogPrimitive.Description.Props, "className"> & {
  className?: string;
}) {
  return (
    <DialogPrimitive.Description
      {...props}
      className={cn("bf:my-3 bf:text-muted", className)}
    />
  );
}

// Center without transforms so fixed notifications inside a dialog use the viewport.
// The portal and keyboard-focus boundary remain within the Salesforce host.
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
      <DialogPrimitive.Backdrop className="bf:z-[9000] bf:fixed bf:inset-0 bf:bg-black/40" />
      <DialogPrimitive.Popup
        className={cn(
          "bf:z-[9001] bf:fixed bf:inset-0 bf:m-auto bf:h-fit bf:w-[calc(100%-32px)] bf:max-w-md bf:rounded-lg bf:border bf:border-border bf:bg-background bf:p-[1.5rem] bf:shadow-lg",
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
          className="bf:absolute bf:top-3.5 bf:right-3.5"
          aria-label={closeLabel}
        >
          <X size={16} aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
