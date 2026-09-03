import { invoke } from "@tauri-apps/api/core";
import type { FileDiff, FileSides, PierreFileContents, RangeCompare } from "./types";

export function getFileDiff(path: string, sha: string, rel: string): Promise<FileDiff> {
  return invoke("get_file_diff", { path, sha, rel });
}

export function getWorktreeDiff(
  path: string,
  rel: string,
  staged: boolean,
): Promise<FileDiff> {
  return invoke("get_worktree_diff", { path, rel, staged });
}

export function compareRange(path: string, base: string, head: string): Promise<RangeCompare> {
  return invoke("compare_range", { path, base, head });
}

export function getRangeFileDiff(
  path: string,
  base: string,
  head: string,
  rel: string,
): Promise<FileDiff> {
  return invoke("get_range_file_diff", { path, base, head, rel });
}

export function getFileSides(path: string, sha: string, rel: string): Promise<FileSides> {
  return invoke("get_file_sides", { path, sha, rel });
}

export function getWorktreeFileSides(
  path: string,
  rel: string,
  staged: boolean,
): Promise<FileSides> {
  return invoke("get_worktree_file_sides", { path, rel, staged });
}

export function getRangeFileSides(
  path: string,
  base: string,
  head: string,
  rel: string,
): Promise<FileSides> {
  return invoke("get_range_file_sides", { path, base, head, rel });
}

/** Map Timestream FileSides into Pierre file contents for loadDiffFiles. */
export function fileSidesToPierre(sides: FileSides): {
  oldFile: PierreFileContents | null;
  newFile: PierreFileContents | null;
} {
  if (sides.binary) return { oldFile: null, newFile: null };
  const newName = sides.path;
  const oldName = sides.oldPath ?? sides.path;
  return {
    oldFile:
      sides.oldContents != null
        ? {
            name: oldName,
            contents: sides.oldContents,
            cacheKey: `old:${oldName}:${hashLen(sides.oldContents)}`,
          }
        : null,
    newFile:
      sides.newContents != null
        ? {
            name: newName,
            contents: sides.newContents,
            cacheKey: `new:${newName}:${hashLen(sides.newContents)}`,
          }
        : null,
  };
}

function hashLen(text: string): string {
  let h = text.length;
  for (let i = 0; i < Math.min(text.length, 64); i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${h >>> 0}`;
}
