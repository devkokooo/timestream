export type RefKind = "branch" | "tag" | "head" | "remote";
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
  isUpstream: boolean;
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
  committer: string;
  committerEmail: string;
  committerTimestamp: number;
  signed: boolean;
  signatureKind: string | null;
  parents: string[];
  files: FileChange[];
}

export interface BranchInfo {
  name: string;
  tip: string;
  isHead: boolean;
}

export type DocketTab = "case" | "requests" | "incidents" | "canon";
export type RailTab = "variants" | "history" | "tags";

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface DeviceLoginBegin {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
  clientIdConfigured: boolean;
}

export interface RemoteInfo {
  name: string;
  url: string;
  transport: string;
  host: string | null;
  owner: string | null;
  nameOnHost: string | null;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
  upstream: string | null;
}

export interface RemoteAuthArgs {
  path: string;
  remote?: string;
  keyPath?: string;
  passphrase?: string;
  rememberKey?: boolean;
  rememberDefault?: boolean;
  rememberPassphrase?: boolean;
}

export interface SshKeyInfo {
  path: string;
  publicPath: string;
  comment: string;
  fingerprint: string;
}

export interface SshAgentStatus {
  running: boolean;
  serviceDisabled: boolean;
  hint: string | null;
  loadedFingerprints: string[];
}

export interface SshBinding {
  repo: string;
  remote: string;
  key: string;
}

export interface SshIdentity {
  path: string;
  label: string;
}

export interface AppSettings {
  version: number;
  github: {
    cloneProtocol: string;
  };
  ssh: {
    agentAutostart: boolean;
    defaultKey: string | null;
    bindings: SshBinding[];
    identities: SshIdentity[];
  };
  timeline: {
    enabled: boolean;
    showUpstreamRefs: boolean;
  };
}

export interface PullRequestSummary {
  number: number;
  title: string;
  body: string;
  state: string;
  draft: boolean;
  htmlUrl: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  userLogin: string;
  mergeable: boolean | null;
  labels: string[];
  requestedReviewers: string[];
  ciStatus: string | null;
  reviewDecision: string | null;
}

export interface IssueSummary {
  number: number;
  title: string;
  body: string;
  state: string;
  htmlUrl: string;
  userLogin: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  pullRequest: boolean;
}

export interface IssueComment {
  id: number;
  userLogin: string;
  body: string;
  createdAt: string;
}

export interface ReleaseSummary {
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  htmlUrl: string;
  publishedAt: string | null;
}

export interface CheckRunSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  headSha: string;
}

export interface ReviewComment {
  id: number;
  path: string;
  line: number | null;
  originalLine: number | null;
  side: string | null;
  body: string;
  userLogin: string;
  diffHunk: string | null;
  inReplyToId: number | null;
}

export interface NotificationItem {
  id: string;
  reason: string;
  title: string;
  repo: string;
  kind: string;
  unread: boolean;
  updatedAt: string;
  url: string | null;
}

export interface RepoSearchHit {
  fullName: string;
  description: string | null;
  sshUrl: string;
  cloneUrl: string;
  private: boolean;
}

export interface CreatePullRequest {
  title: string;
  body: string;
  head: string;
  base: string;
  draft: boolean;
}

export interface CreateIssue {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}

export interface CreateRelease {
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
}

export interface PendingReviewComment {
  path: string;
  body: string;
  line: number;
  side: string;
}

export interface SubmitReview {
  body: string;
  event: string;
  comments: PendingReviewComment[];
}

export interface PrStack {
  base: string;
  items: PullRequestSummary[];
}
