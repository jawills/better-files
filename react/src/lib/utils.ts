import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  prefix: "bf",
  extend: { theme: { text: ["card-title", "heading"] } }
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
