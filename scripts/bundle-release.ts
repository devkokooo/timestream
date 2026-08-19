/**
 * Bundle Timestream for the machine this script runs on.
 *
 *   Windows → NSIS installer (.exe)
 *   Linux   → AppImage
 *   macOS   → DMG
 *
 * Cross-compilation is not supported. Cut all three from CI:
 *   .github/workflows/release.yml  (tag `v*` or workflow_dispatch)
 *
 * Usage:
 *   bun scripts/bundle-release.ts
 *   bun scripts/bundle-release.ts --skip-tests
 *   bun scripts/bundle-release.ts --out ./release
 *   bun scripts/bundle-release.ts --target aarch64-apple-darwin
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));

type Host = "windows" | "linux" | "macos";

type BundleKind = {
  flag: string;
  subdir: string;
  match: (name: string) => boolean;
};

const BUNDLES: Record<Host, BundleKind> = {
  windows: {
    flag: "nsis",
    subdir: "nsis",
    match: (name) => name.endsWith("-setup.exe"),
  },
  linux: {
    flag: "appimage",
    subdir: "appimage",
    match: (name) => name.endsWith(".AppImage"),
  },
  macos: {
    flag: "dmg",
    subdir: "dmg",
    match: (name) => name.endsWith(".dmg"),
  },
};

function host(): Host {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function parseArgs(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Bundle Timestream for this OS (${host()}).

Usage: bun scripts/bundle-release.ts [options]

Options:
  --skip-tests     Skip bun/cargo tests
  --out <dir>      Output directory (default: ./release)
  --target <triple>
                   Rust/Tauri target, e.g. aarch64-apple-darwin
  -h, --help       Show this help
`);
    process.exit(0);
  }

  let outDir = join(root, "release");
  let skipTests = false;
  let target: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--skip-tests") {
      skipTests = true;
    } else if (arg === "--out") {
      const value = argv[++i];
      if (!value) throw new Error("--out requires a directory");
      outDir = resolve(value);
    } else if (arg === "--target") {
      const value = argv[++i];
      if (!value) throw new Error("--target requires a rustc triple");
      target = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { outDir, skipTests, target };
}

function readSyncedVersion(): string {
  const tauri = JSON.parse(
    readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
  ) as { version: string };
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version: string;
  };
  const cargo = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8").match(
    /^version\s*=\s*"([^"]+)"/m,
  )?.[1];

  if (!tauri.version || !pkg.version || !cargo) {
    throw new Error("Could not read version from tauri.conf.json, package.json, or Cargo.toml");
  }
  if (tauri.version !== pkg.version || tauri.version !== cargo) {
    throw new Error(
      `Version mismatch: tauri.conf.json=${tauri.version} package.json=${pkg.version} Cargo.toml=${cargo}`,
    );
  }
  return tauri.version;
}

function run(cmd: string, args: string[]): void {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

function bundleDir(target: string | undefined): string {
  if (target) {
    return join(root, "src-tauri", "target", target, "release", "bundle");
  }
  return join(root, "src-tauri", "target", "release", "bundle");
}

function sha256(path: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

const platform = host();
const { outDir, skipTests, target } = parseArgs(process.argv.slice(2));
const version = readSyncedVersion();
const spec = BUNDLES[platform];

console.log(`Timestream ${version} — bundling ${spec.flag} on ${platform}${target ? ` (${target})` : ""}`);

if (!process.env.TIMESTREAM_GITHUB_CLIENT_ID) {
  console.warn(
    "TIMESTREAM_GITHUB_CLIENT_ID is unset; the compile-time default in auth.rs will be used.",
  );
}

if (!skipTests) {
  run("bun", ["run", "test"]);
  run("cargo", ["test", "--manifest-path", "src-tauri/Cargo.toml"]);
}

const tauriArgs = ["run", "tauri", "build", "--bundles", spec.flag];
if (target) {
  tauriArgs.push("--target", target);
}
run(process.execPath, tauriArgs);

const artifacts = listFiles(join(bundleDir(target), spec.subdir)).filter((path) => {
  const name = basename(path);
  return spec.match(name) && name.includes(version);
});

if (artifacts.length === 0) {
  throw new Error(
    `No ${spec.flag} artifact found under ${join(bundleDir(target), spec.subdir)}`,
  );
}

mkdirSync(outDir, { recursive: true });

const checksums: string[] = [];
for (const src of artifacts) {
  const dest = join(outDir, basename(src));
  copyFileSync(src, dest);
  const digest = sha256(dest);
  checksums.push(`${digest}  ${basename(src)}`);
  console.log(`copied ${basename(src)}`);
}

writeFileSync(join(outDir, "SHA256SUMS"), `${checksums.join("\n")}\n`, "utf8");

console.log(`\nRelease artifacts in ${outDir}`);
for (const line of checksums) console.log(`  ${line}`);
console.log(
  `\nThis host produced ${platform} only. Linux AppImage and macOS DMG are built by .github/workflows/release.yml.`,
);
