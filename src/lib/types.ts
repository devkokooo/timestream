export type RefKind = "branch" | "tag" | "head";
export type EdgeKind = "firstParent" | "merge";
export type ThreatLevel = "low" | "moderate" | "severe";

export interface RefLabel {
  name: string;
  kind: RefKind;
}

export interface TimelineNode {
  id: string;
  shortId: string;
  parents: string[];
  summary: string;
  author: string;
  email: string;
  timestamp: number;
  column: number;
  row: number;
  refs: RefLabel[];
  isHead: boolean;
}

export interface TimelineEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  fromColumn: number;
  toColumn: number;
  fromRow: number;
  toRow: number;
}

export interface VariantDossier {
  name: string;
  tip: string;
  isSacred: boolean;
  isHead: boolean;
  exclusiveCommits: number;
  divergeRow: number | null;
  commitsApart: number;
  threat: ThreatLevel;
}

export interface Timeline {
  nodes: TimelineNode[];
  edges: TimelineEdge[];
  sacredBranch: string | null;
  head: string | null;
  dossiers: VariantDossier[];
}

export interface RepoSummary {
  path: string;
  name: string;
  head: string | null;
  branch: string | null;
}

export type FileAction = "modified" | "added" | "deleted" | "moved";
export type DiffMode = "split" | "inline";
export type DiffLineKind = "context" | "addition" | "deletion" | "meta";

export interface FileChange {
  path: string;
  oldPath: string | null;
  status: string;
}

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

export interface StatusPayload {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
}

export interface CommitDetail {
  id: string;
  shortId: string;
  summary: string;
  body: string;
  author: string;
  email: string;
  timestamp: number;
  parents: string[];
  files: FileChange[];
}

export interface BranchInfo {
  name: string;
  tip: string;
  isHead: boolean;
}
