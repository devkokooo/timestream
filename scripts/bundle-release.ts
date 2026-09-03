/**
 * Bundle Timestream for the machine this script runs on.
 *
 *   Windows → NSIS installer (.exe)
 *   Linux   → AppImage
 *   macOS   → DMG
 *
 * Cross-compilation is not supported. Cut all three from CI:
 *   .github/workflows/release.yml  (tag `v*` or Run workflow + tag)
 *
 * Usage:
 *   bun scripts/bundle-release.ts
 *   bun scripts/bundle-release.ts --nightly
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
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

type SemVer = { major: number; minor: number; patch: number };

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
  --nightly        Next minor after latest v* tag + commit-hash filename
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
  let nightly = false;
  let target: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--skip-tests") {
      skipTests = true;
    } else if (arg === "--nightly") {
      nightly = true;
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

  return { outDir, skipTests, nightly, target };
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

function parseSemVer(raw: string): SemVer | null {
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function bumpMinor(version: string): string {
  const parsed = parseSemVer(version);
  if (!parsed) throw new Error(`Not a plain semver X.Y.Z: ${version}`);
  return formatSemVer({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
}

function gitCapture(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed${err ? `: ${err}` : ""}`);
  }
  return (result.stdout || "").trim();
}

/** Highest plain semver among local tags matching `v*`, or null if none. */
function latestReleaseVersion(): string | null {
  const listed = gitCapture(["tag", "--list", "v*"]);
  if (!listed) return null;

  let best: SemVer | null = null;
  for (const line of listed.split("\n")) {
    const tag = line.trim();
    if (!tag.startsWith("v")) continue;
    const parsed = parseSemVer(tag.slice(1));
    if (!parsed) continue;
    if (!best || compareSemVer(parsed, best) > 0) best = parsed;
  }
  return best ? formatSemVer(best) : null;
}

function shortSha(): string {
  const sha = gitCapture(["rev-parse", "--short=7", "HEAD"]);
  if (!/^[0-9a-f]{7}$/i.test(sha)) {
    throw new Error(`Unexpected short SHA from git: ${sha}`);
  }
  return sha.toLowerCase();
}

function nightlyBaseVersion(synced: string): string {
  const latest = latestReleaseVersion();
  if (!latest) return synced;
  return bumpMinor(latest);
}

function withNightlySuffix(name: string, sha: string): string {
  const i = name.lastIndexOf(".");
  const suffix = `${sha}-nightly`;
  if (i <= 0) return `${name}-${suffix}`;
  return `${name.slice(0, i)}-${suffix}${name.slice(i)}`;
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
const { outDir, skipTests, nightly, target } = parseArgs(process.argv.slice(2));
const syncedVersion = readSyncedVersion();
const version = nightly ? nightlyBaseVersion(syncedVersion) : syncedVersion;
const commitSha = nightly ? shortSha() : null;
const spec = BUNDLES[platform];

const label = nightly ? `nightly ${version}+${commitSha}` : version;
console.log(
  `Timestream ${label} — bundling ${spec.flag} on ${platform}${target ? ` (${target})` : ""}`,
);

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

let nightlyConfigPath: string | undefined;
if (nightly && version !== syncedVersion) {
  // File path avoids Windows shell mangling of inline JSON --config.
  nightlyConfigPath = join(tmpdir(), `timestream-nightly-${commitSha}.json`);
  writeFileSync(nightlyConfigPath, `${JSON.stringify({ version })}\n`, "utf8");
  tauriArgs.push("--config", nightlyConfigPath);
}

try {
  run(process.execPath, tauriArgs);
} finally {
  if (nightlyConfigPath && existsSync(nightlyConfigPath)) {
    unlinkSync(nightlyConfigPath);
  }
}

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
  const outName =
    nightly && commitSha ? withNightlySuffix(basename(src), commitSha) : basename(src);
  const dest = join(outDir, outName);
  copyFileSync(src, dest);
  const digest = sha256(dest);
  checksums.push(`${digest}  ${outName}`);
  console.log(`copied ${outName}`);
}

writeFileSync(join(outDir, "SHA256SUMS"), `${checksums.join("\n")}\n`, "utf8");

console.log(`\n${nightly ? "Nightly" : "Release"} artifacts in ${outDir}`);
for (const line of checksums) console.log(`  ${line}`);
console.log(
  `\nThis host produced ${platform} only. Linux AppImage and macOS DMG are built by .github/workflows/release.yml.`,
);
