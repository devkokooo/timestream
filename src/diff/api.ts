import { invoke } from "@tauri-apps/api/core";
import type { FileDiff, RangeCompare } from "./types";

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
