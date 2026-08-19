import type { FileChange } from "@/git/types";

export type RefKind = "branch" | "tag" | "head" | "remote";
export type EdgeKind = "firstParent" | "merge";
export type ThreatLevel = "low" | "moderate" | "severe";
export type RailTab = "variants" | "history" | "tags";

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
  isUpstream: boolean;
}

export interface Timeline {
  nodes: TimelineNode[];
  edges: TimelineEdge[];
  sacredBranch: string | null;
  head: string | null;
  dossiers: VariantDossier[];
}

export interface CommitDetail {
  id: string;
  shortId: string;
  summary: string;
  body: string;
  author: string;
  email: string;
  timestamp: number;
  committer: string;
  committerEmail: string;
  committerTimestamp: number;
  signed: boolean;
  signatureKind: string | null;
  parents: string[];
  files: FileChange[];
}
