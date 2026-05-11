import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { silentManePlugin } from "./src/server/dev-plugin";

const docsDir = process.env.SILENT_MANE_DOCS ?? path.resolve(process.cwd(), "docs");

export default defineConfig({
  plugins: [react(), silentManePlugin(docsDir)],
  root: ".",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [".", docsDir] },
  },
});
