import type { FileChange } from "@/git/types";

export type FileAction = "modified" | "added" | "deleted" | "moved";
export type DiffMode = "split" | "inline";
export type DiffLineKind = "context" | "addition" | "deletion" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath: string | null;
  status: string;
  binary: boolean;
  hunks: DiffHunk[];
}

export interface FileSides {
  path: string;
  oldPath: string | null;
  status: string;
  binary: boolean;
  oldContents: string | null;
  newContents: string | null;
}

/** Shape accepted by Pierre `loadDiffFiles` — kept local so site/api never import `@pierre/diffs`. */
export interface PierreFileContents {
  name: string;
  contents: string;
  cacheKey?: string;
}

export interface RangeCommit {
  id: string;
  shortId: string;
  summary: string;
  author: string;
  email: string;
  timestamp: number;
}

export interface RangeCompare {
  base: string;
  head: string;
  mergeBase: string | null;
  ahead: number;
  behind: number;
  commits: RangeCommit[];
  files: FileChange[];
}
