import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const mock = (name: string) => path.resolve(root, "src/gallery/mocks", name);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "gallery-index",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/" || req.url === "/index.html") {
            req.url = "/gallery.html";
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@tauri-apps/api/core": mock("core.ts"),
      "@tauri-apps/api/event": mock("event.ts"),
      "@tauri-apps/api/window": mock("window.ts"),
      "@tauri-apps/api/webviewWindow": mock("webviewWindow.ts"),
      "@tauri-apps/plugin-opener": mock("opener.ts"),
      "@tauri-apps/plugin-dialog": mock("dialog.ts"),
    },
  },
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    open: "/gallery.html",
  },
  build: {
    outDir: "dist-gallery",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(root, "gallery.html"),
    },
  },
});
