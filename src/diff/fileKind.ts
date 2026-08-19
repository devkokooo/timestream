import { fileBaseName } from "@/diff/diffView";
import { languageFromPath } from "@/diff/syntaxLang";

/** Well-known names whose icon should not follow the extension (package.json is npm, not JSON). */
const FILENAME_KINDS: Record<string, string> = {
  "package.json": "npm",
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm",
  ".npmrc": "npm",
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "bunfig.toml": "bun",
  "pnpm-lock.yaml": "pnpm",
  "pnpm-workspace.yaml": "pnpm",
  "yarn.lock": "yarn",
  ".yarnrc": "yarn",
  ".yarnrc.yml": "yarn",
  dockerfile: "docker",
  containerfile: "docker",
  makefile: "make",
  gnumakefile: "make",
  justfile: "make",
  "cmakelists.txt": "cmake",
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  ".gitkeep": "git",
  ".dockerignore": "docker",
  ".eslintignore": "eslint",
  ".prettierignore": "prettier",
  ".npmignore": "npm",
  ".editorconfig": "editorconfig",
  "cargo.toml": "rust",
  "cargo.lock": "rust",
  "go.mod": "go",
  "go.sum": "go",
  "tsconfig.json": "typescript",
  "jsconfig.json": "javascript",
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  "vite.config.mjs": "vite",
  "eslint.config.js": "eslint",
  "eslint.config.mjs": "eslint",
  "eslint.config.ts": "eslint",
  ".eslintrc": "eslint",
  ".eslintrc.js": "eslint",
  ".eslintrc.cjs": "eslint",
  ".eslintrc.json": "eslint",
  ".prettierrc": "prettier",
  ".prettierrc.json": "prettier",
  ".prettierrc.js": "prettier",
  "prettier.config.js": "prettier",
  "tailwind.config.js": "tailwind",
  "tailwind.config.ts": "tailwind",
  "next.config.js": "next",
  "next.config.mjs": "next",
  "next.config.ts": "next",
};

/** Last-segment extension → kind. Wins over language remap so `.svg` stays SVG, not XML. */
const EXT_KINDS: Record<string, string> = {
  tsx: "react",
  jsx: "react",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  rs: "rust",
  md: "markdown",
  markdown: "markdown",
  mkd: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "sass",
  sass: "sass",
  less: "less",
  styl: "stylus",
  stylus: "stylus",
  html: "html",
  htm: "html",
  svg: "svg",
  py: "python",
  pyw: "python",
  pyi: "python",
  go: "go",
  json: "json",
  jsonc: "json",
  json5: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sh: "shell",
  bash: "shell",
  zsh: "zsh",
  fish: "fish",
  ps1: "powershell",
  psm1: "powershell",
  vue: "vue",
  svelte: "svelte",
  php: "php",
  phtml: "php",
  rb: "ruby",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  c: "c",
  h: "c",
  cs: "csharp",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  dart: "dart",
  lua: "lua",
  graphql: "graphql",
  gql: "graphql",
  prisma: "prisma",
  astro: "astro",
  zig: "zig",
  ex: "elixir",
  exs: "elixir",
  hs: "haskell",
  scala: "scala",
  sc: "scala",
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",
  nim: "nim",
  fs: "fsharp",
  fsx: "fsharp",
  fsi: "fsharp",
  sol: "solidity",
  tf: "terraform",
  nix: "nix",
  vim: "vim",
  vimrc: "vim",
  java: "java",
  sql: "sql",
  coffee: "coffee",
  cson: "coffee",
  pl: "perl",
  pm: "perl",
  tex: "latex",
  sty: "latex",
  ltx: "latex",
  wasm: "wasm",
  xml: "xml",
  xsd: "xml",
  xslt: "xml",
  xsl: "xml",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  ico: "image",
  bmp: "image",
  avif: "image",
  pdf: "pdf",
  zip: "archive",
  tar: "archive",
  gz: "archive",
  tgz: "archive",
  "7z": "archive",
  rar: "archive",
  txt: "text",
  log: "text",
  r: "r",
  proto: "proto",
  pug: "pug",
  jade: "pug",
  haml: "haml",
  erb: "erb",
  diff: "diff",
  patch: "diff",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
};

/** Shiki / filename language ids that are not a file extension. */
const LANG_KINDS: Record<string, string> = {
  tsx: "react",
  jsx: "react",
  typescript: "typescript",
  javascript: "javascript",
  python: "python",
  markdown: "markdown",
  docker: "docker",
  make: "make",
  cmake: "cmake",
  ruby: "ruby",
  just: "make",
  groovy: "groovy",
  jsonc: "json",
  dotenv: "dotenv",
  elixir: "elixir",
  "objective-c": "objc",
  "objective-cpp": "objcpp",
  solidity: "solidity",
  glsl: "glsl",
  viml: "vim",
  fortran: "fortran",
  jinja: "jinja",
};

export function fileKindFromPath(path: string): string {
  const base = fileBaseName(path).toLowerCase();
  if (!base) return "file";

  const named = FILENAME_KINDS[base];
  if (named) return named;

  const dot = base.lastIndexOf(".");
  if (dot > 0 && dot < base.length - 1) {
    const ext = base.slice(dot + 1);
    const fromExt = EXT_KINDS[ext];
    if (fromExt) return fromExt;
  }

  const lang = languageFromPath(path);
  if (lang) {
    const fromLang = LANG_KINDS[lang];
    if (fromLang) return fromLang;
  }

  return "file";
}

const TEST_INFIX = /\.(test|spec)\.[^.]+$/;
const TEST_SUFFIX = /_test\.(go|rs|py)$/;
const TEST_PY_PREFIX = /^test_.*\.py$/;
const TEST_DIR = /(^|\/)(__tests?__|tests?)(\/|$)/;

export function isTestFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const base = fileBaseName(normalized).toLowerCase();
  if (!base) return false;
  if (TEST_INFIX.test(base) || TEST_SUFFIX.test(base) || TEST_PY_PREFIX.test(base)) return true;
  return TEST_DIR.test(normalized.toLowerCase());
}
