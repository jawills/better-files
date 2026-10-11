import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { salesforceDev } from "./dev/salesforce.ts";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), salesforceDev()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build:
    mode === "salesforce"
      ? {
          outDir:
            "salesforce/force-app/main/default/staticresources/betterFilesReact",
          emptyOutDir: true,
          lib: {
            entry: "src/spike.tsx",
            name: "BetterFilesReact",
            formats: ["iife"],
            fileName: () => "better-files.js",
            cssFileName: "better-files"
          }
        }
      : { outDir: "dist" },
  define:
    mode === "salesforce"
      ? { "process.env.NODE_ENV": JSON.stringify("production") }
      : {}
}));
