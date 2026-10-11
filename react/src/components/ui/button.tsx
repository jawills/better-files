import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "bf:inline-flex bf:items-center bf:justify-center bf:gap-2 bf:rounded-button bf:whitespace-nowrap bf:disabled:pointer-events-none bf:disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bf:border bf:border-brand bf:bg-brand bf:text-white bf:hover:bg-primary",
        outline:
          "bf:border bf:border-border bf:bg-background bf:text-primary bf:hover:bg-accent",
        link: "bf:text-primary bf:hover:underline"
      },
      size: { default: "bf:h-control bf:px-3", icon: "bf:size-control" }
    },
    defaultVariants: { variant: "outline", size: "default" }
  }
);

// shadcn/ui Base UI Button, styled for Salesforce.
export function Button({
  className,
  variant,
  size,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof buttonVariants> & { className?: string }) {
  return (
    <ButtonPrimitive
      className={cn(
        size === "icon" ? "bf-button-icon" : "bf-button",
        buttonVariants({ variant, size }),
        className
      )}
      {...props}
    />
  );
}
