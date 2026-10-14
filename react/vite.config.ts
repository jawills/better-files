import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { salesforceDev } from "./dev/salesforce.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), salesforceDev()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "dist" }
});
