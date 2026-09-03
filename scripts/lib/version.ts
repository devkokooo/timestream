/**
 * Synced Timestream version helpers for release bump + bundle scripts.
 *
 * Canonical product files: package.json, tauri.conf.json, Cargo.toml.
 * Also kept in lockstep: Cargo.lock (timestream), site CTA, gallery fixtures.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

export type SemVer = { major: number; minor: number; patch: number };

export function parseSemVer(raw: string): SemVer | null {
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function requireSemVer(raw: string): SemVer {
  const parsed = parseSemVer(raw);
  if (!parsed) throw new Error(`Not a plain semver X.Y.Z: ${raw}`);
  return parsed;
}

export function bumpMajor(version: string): string {
  const v = requireSemVer(version);
  return formatSemVer({ major: v.major + 1, minor: 0, patch: 0 });
}

export function bumpMinor(version: string): string {
  const v = requireSemVer(version);
  return formatSemVer({ major: v.major, minor: v.minor + 1, patch: 0 });
}

export function bumpPatch(version: string): string {
  const v = requireSemVer(version);
  return formatSemVer({ major: v.major, minor: v.minor, patch: v.patch + 1 });
}

function readJsonVersion(path: string): string {
  const data = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
  if (!data.version) throw new Error(`Missing version in ${path}`);
  return data.version;
}

function readCargoPackageVersion(path: string): string {
  const match = readFileSync(path, "utf8").match(/^version\s*=\s*"([^"]+)"/m);
  if (!match?.[1]) throw new Error(`Missing package version in ${path}`);
  return match[1];
}

/** Read and assert the three product version files agree. */
export function readSyncedVersion(): string {
  const tauriPath = join(root, "src-tauri", "tauri.conf.json");
  const pkgPath = join(root, "package.json");
  const cargoPath = join(root, "src-tauri", "Cargo.toml");

  const tauri = readJsonVersion(tauriPath);
  const pkg = readJsonVersion(pkgPath);
  const cargo = readCargoPackageVersion(cargoPath);

  if (tauri !== pkg || tauri !== cargo) {
    throw new Error(
      `Version mismatch: tauri.conf.json=${tauri} package.json=${pkg} Cargo.toml=${cargo}`,
    );
  }
  return tauri;
}

function writeJsonVersion(path: string, version: string): void {
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  data.version = version;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeCargoTomlVersion(path: string, version: string): void {
  const text = readFileSync(path, "utf8");
  if (/^version\s*=\s*"[^"]+"/m.exec(text)?.[0] === `version = "${version}"`) return;
  const next = text.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  if (next === text) throw new Error(`Could not update version in ${path}`);
  writeFileSync(path, next, "utf8");
}

function writeCargoLockTimestream(path: string, version: string): void {
  const text = readFileSync(path, "utf8");
  const re = /(\[\[package\]\]\r?\nname = "timestream"\r?\n)version = "[^"]+"/;
  const match = text.match(re);
  if (!match) throw new Error(`Could not find timestream package in ${path}`);
  if (match[0].endsWith(`version = "${version}"`)) return;
  writeFileSync(path, text.replace(re, `$1version = "${version}"`), "utf8");
}

function writeSiteReleaseTag(path: string, tag: string): void {
  const text = readFileSync(path, "utf8");
  if (text.includes(`export const RELEASE_TAG = "${tag}"`)) return;
  const next = text.replace(
    /export const RELEASE_TAG = "v[^"]+"/,
    `export const RELEASE_TAG = "${tag}"`,
  );
  if (next === text) throw new Error(`Could not update RELEASE_TAG in ${path}`);
  writeFileSync(path, next, "utf8");
}

function writeGalleryAppVersion(path: string, version: string): void {
  const text = readFileSync(path, "utf8");
  const re = /getVersion\(\): Promise<string> \{\r?\n(\s*)return "[^"]+"/;
  const match = text.match(re);
  if (!match) throw new Error(`Could not find getVersion in ${path}`);
  if (match[0].includes(`return "${version}"`)) return;
  writeFileSync(
    path,
    text.replace(re, `getVersion(): Promise<string> {\n$1return "${version}"`),
    "utf8",
  );
}

function writeGalleryReleaseFixture(path: string, to: string): void {
  const text = readFileSync(path, "utf8");
  const toTag = `v${to}`;
  if (text.includes(`tagName: "${toTag}"`) && text.includes(`releases/tag/${toTag}`)) {
    return;
  }
  let next = text.replace(/tagName:\s*"v\d+\.\d+\.\d+"/g, `tagName: "${toTag}"`);
  next = next.replace(/releases\/tag\/v\d+\.\d+\.\d+/g, `releases/tag/${toTag}`);
  if (next === text) {
    throw new Error(`Could not update release fixture tags in ${path}`);
  }
  writeFileSync(path, next, "utf8");
}

function writeSealDeskLabel(path: string, to: string): void {
  const text = readFileSync(path, "utf8");
  const label = `Cull seal · v${to}`;
  if (text.includes(label)) return;
  const next = text.replace(/Cull seal · v\d+\.\d+\.\d+/, label);
  if (next === text) throw new Error(`Could not update Cull seal label in ${path}`);
  writeFileSync(path, next, "utf8");
}

export type VersionWriteResult = {
  from: string;
  to: string;
  files: string[];
};

/** Rewrite every synced version field to `next` (plain X.Y.Z). */
export function writeSyncedVersion(next: string): VersionWriteResult {
  requireSemVer(next);
  const from = readSyncedVersion();
  const tag = `v${next}`;
  const files: string[] = [];

  const targets: Array<{ rel: string; write: (abs: string) => void }> = [
    { rel: "package.json", write: (p) => writeJsonVersion(p, next) },
    { rel: "site/package.json", write: (p) => writeJsonVersion(p, next) },
    { rel: "src-tauri/tauri.conf.json", write: (p) => writeJsonVersion(p, next) },
    { rel: "src-tauri/Cargo.toml", write: (p) => writeCargoTomlVersion(p, next) },
    { rel: "src-tauri/Cargo.lock", write: (p) => writeCargoLockTimestream(p, next) },
    { rel: "site/src/lib/site.ts", write: (p) => writeSiteReleaseTag(p, tag) },
    { rel: "src/gallery/mocks/app.ts", write: (p) => writeGalleryAppVersion(p, next) },
    {
      rel: "src/gallery/fixtures.ts",
      write: (p) => writeGalleryReleaseFixture(p, next),
    },
    {
      rel: "src/gallery/exhibits/SealDesk.tsx",
      write: (p) => writeSealDeskLabel(p, next),
    },
  ];

  for (const { rel, write } of targets) {
    const abs = join(root, ...rel.split("/"));
    write(abs);
    files.push(rel);
  }

  const synced = readSyncedVersion();
  if (synced !== next) {
    throw new Error(`Post-write sync check failed: expected ${next}, got ${synced}`);
  }

  return { from, to: next, files };
}
