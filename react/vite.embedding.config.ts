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
    sourcemap: true,
    // Preloading is optional; avoid Vite's unmapped fetch polyfill in the bundle.
    modulePreload: { polyfill: false },
    outDir: fileURLToPath(
      new URL(
        "../force-app/main/default/uiBundles/betterFiles/dist",
        import.meta.url
      )
    ),
    emptyOutDir: true
  }
});
