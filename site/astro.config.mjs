import path from "node:path";
import { fileURLToPath } from "node:url";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const appSrc = path.resolve(root, "..", "src");
const mock = (name) => path.resolve(root, "src/mocks", name);

/** Packages the marketing site installs, but parent `src/` also imports. */
const siteDeps = [
  "react",
  "react-dom",
  "clsx",
  "react-icons",
  "shiki",
  "@tanstack/react-virtual",
];

function inside(file, dir) {
  const rel = path.relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Resolve those deps from `site/node_modules` when the importer is `../src`. */
function resolveAppSrcSiteDeps() {
  return {
    name: "resolve-app-src-site-deps",
    enforce: "pre",
    async resolveId(id, importer, options) {
      if (!importer || !inside(importer, appSrc)) return;
      if (!siteDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))) return;
      return this.resolve(id, path.join(root, "package.json"), { ...options, skipSelf: true });
    },
  };
}

export default defineConfig({
  site:
    process.env.PUBLIC_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "https://timestream.vc",
  // Match Netlify's directory URLs so sitemap/links never 301 to a trailing slash.
  trailingSlash: "always",
  output: "static",
  adapter: netlify(),
  integrations: [react()],
  // Prefetch on hover/viewport so MPA clicks feel instant (also default with ClientRouter).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  build: {
    // Eliminates the render-blocking `/_astro/*.css` round-trip Lighthouse flags (~350ms).
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [resolveAppSrcSiteDeps(), tailwindcss()],
    build: {
      // Keep fonts as separate files — never base64 them into the critical CSS/HTML.
      assetsInlineLimit: 0,
    },
    resolve: {
      alias: [
        // Slim tour icon map — full desktop catalog is ~100 KiB unused on the site.
        {
          find: "@/ui/FileKindIcon",
          replacement: path.resolve(root, "src/ui/FileKindIcon.tsx"),
        },
        { find: "@", replacement: appSrc },
        { find: "@tauri-apps/api/core", replacement: mock("core.ts") },
        { find: "@tauri-apps/api/event", replacement: mock("event.ts") },
        { find: "@tauri-apps/plugin-dialog", replacement: mock("dialog.ts") },
        { find: "@tauri-apps/plugin-opener", replacement: mock("opener.ts") },
      ],
      dedupe: ["react", "react-dom", "clsx", "react-icons", "@tanstack/react-virtual"],
    },
    server: {
      fs: {
        allow: [path.resolve(root, "..")],
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "clsx", "@tanstack/react-virtual", "shiki"],
    },
  },
  server: {
    port: 4321,
  },
});
