import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Salesforce injects the runtime SDK environment when serving this UI Bundle.
export default defineConfig({
  root: "embedding",
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(
      new URL(
        "./salesforce/force-app/main/default/uiBundles/betterFiles/dist",
        import.meta.url
      )
    ),
    emptyOutDir: true
  }
});
