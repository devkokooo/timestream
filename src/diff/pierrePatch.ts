import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import { hunkKey } from "@/diff/diffView";
import type { DiffHunk, DiffLine, FileDiff } from "@/diff/types";

/** True when every line already carries a unified-diff origin prefix (fixtures / tour). */
export function linesIncludeOrigins(lines: DiffLine[]): boolean {
  return lines.every((line) => {
    if (line.kind === "addition") return line.text.startsWith("+");
    if (line.kind === "deletion") return line.text.startsWith("-");
    if (line.kind === "context") return line.text.startsWith(" ");
    if (line.kind === "meta") return line.text.startsWith("\\");
    return true;
  });
}

function patchLine(line: DiffLine, hasOrigins: boolean): string {
  if (line.kind === "meta") {
    if (hasOrigins && line.text.startsWith("\\")) return line.text;
    return line.text.startsWith("\\") ? line.text : `\\ ${line.text}`;
  }
  const origin = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
  if (hasOrigins) return line.text;
  return `${origin}${line.text}`;
}

function hunkToPatch(hunk: DiffHunk, hasOrigins: boolean): string {
  const lines = hunk.lines.map((line) => patchLine(line, hasOrigins));
  return [hunk.header, ...lines].join("\n");
}

function filePairPaths(diff: FileDiff): { oldPath: string; newPath: string } {
  const status = diff.status;
  if (status === "added" || status === "untracked") {
    return { oldPath: "/dev/null", newPath: `b/${diff.path}` };
  }
  if (status === "deleted") {
    return { oldPath: `a/${diff.oldPath ?? diff.path}`, newPath: "/dev/null" };
  }
  const old = diff.oldPath && diff.oldPath !== diff.path ? diff.oldPath : diff.path;
  return { oldPath: `a/${old}`, newPath: `b/${diff.path}` };
}

export function filterHunks(diff: FileDiff, omitHunkKeys?: ReadonlySet<string>): DiffHunk[] {
  if (!omitHunkKeys || omitHunkKeys.size === 0) return diff.hunks;
  return diff.hunks.filter((hunk) => !omitHunkKeys.has(hunkKey(hunk)));
}

/** Serialize a Timestream FileDiff to a unified patch string. */
export function fileDiffToUnifiedPatch(
  diff: FileDiff,
  opts?: { omitHunkKeys?: ReadonlySet<string> },
): string {
  const hunks = filterHunks(diff, opts?.omitHunkKeys);
  if (hunks.length === 0) return "";

  const hasOrigins = hunks.every((hunk) => linesIncludeOrigins(hunk.lines));
  const { oldPath, newPath } = filePairPaths(diff);
  const body = hunks.map((hunk) => hunkToPatch(hunk, hasOrigins)).join("\n");
  return [`--- ${oldPath}`, `+++ ${newPath}`, body].join("\n") + "\n";
}

/** Parse Timestream FileDiff into Pierre FileDiffMetadata (stable for one call). */
export function toPierreFileDiff(
  diff: FileDiff,
  opts?: { omitHunkKeys?: ReadonlySet<string>; cacheKeyPrefix?: string },
): FileDiffMetadata | null {
  const patch = fileDiffToUnifiedPatch(diff, opts);
  if (!patch) return null;
  const prefix = opts?.cacheKeyPrefix ?? `ts:${diff.path}`;
  const patches = parsePatchFiles(patch, prefix, true);
  const file = patches[0]?.files[0];
  if (!file) return null;
  // Pierre may keep git a/b prefixes on names; Timestream paths do not.
  // Shallow-copy so we never mutate Pierre's parsed object in place.
  return {
    ...file,
    name: stripGitPathPrefix(file.name) || diff.path,
    prevName: file.prevName ? stripGitPathPrefix(file.prevName) : file.prevName,
  };
}

function stripGitPathPrefix(path: string): string {
  if (path === "/dev/null") return path;
  if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
  return path;
}
