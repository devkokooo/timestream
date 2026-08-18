import path from "node:path";
import { fileURLToPath } from "node:url";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const mock = (name) => path.resolve(root, "src/mocks", name);

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL,
  output: "static",
  adapter: netlify(),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@tauri-apps/api/core": mock("core.ts"),
        "@tauri-apps/api/event": mock("event.ts"),
        "@tauri-apps/plugin-dialog": mock("dialog.ts"),
        "@tauri-apps/plugin-opener": mock("opener.ts"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      fs: {
        allow: [path.resolve(root, "..")],
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "clsx", "@tanstack/react-virtual"],
    },
  },
  server: {
    port: 4321,
  },
});
