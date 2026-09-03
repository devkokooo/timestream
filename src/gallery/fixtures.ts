import { linearTimeline, manyBranchesTimeline, taggedTimeline } from "@/timeline/fixtures";
import { defaultSettings } from "@/settings/settingsRegistry";
import type { AheadBehind, RemoteInfo } from "@/remotes/types";
import type { CheckRunSummary } from "@/github/checks/types";
import type { CommitDetail, Timeline } from "@/timeline/types";
import type { DeviceLoginBegin } from "@/github/auth/types";
import type { FileChange, RepoSummary } from "@/git/types";
import type { FileDiff, RangeCompare } from "@/diff/types";
import type { ForgeUser } from "@/auth/types";
import type { IssueComment, IssueSummary } from "@/github/issues/types";
import type { PullCommit, PullCounts, PullRequestSummary } from "@/github/pulls/types";
import type { PullReview, ReviewComment } from "@/github/reviews/types";
import type { ReleaseSummary } from "@/github/releases/types";
import type { RepoFeatures, RepoSearchHit } from "@/github/types";
import type { SshAgentStatus, SshKeyInfo } from "@/ssh/types";
import type { StatusPayload } from "@/worktree/types";
import type { RecentRepo } from "@/remotes/recentRepos";

const NOW = Math.floor(Date.now() / 1000);
const ISO = new Date().toISOString();

export const ANALYST: ForgeUser = {
  login: "analyst",
  name: "Analyst",
  avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  email: "analyst@tva.local",
  emails: ["analyst@tva.local"],
};

export const REPO: RepoSummary = {
  path: "/archives/timestream",
  name: "timestream",
  head: "d".repeat(40),
  branch: "main",
};

export const ORIGIN: RemoteInfo = {
  name: "origin",
  url: "git@github.com:tva/timestream.git",
  transport: "ssh",
  host: "github.com",
  owner: "tva",
  nameOnHost: "timestream",
};

export const UPSTREAM: RemoteInfo = {
  name: "upstream",
  url: "https://github.com/tva/timestream.git",
  transport: "https",
  host: "github.com",
  owner: "tva",
  nameOnHost: "timestream",
};

export const SYNC: AheadBehind = {
  ahead: 1,
  behind: 2,
  upstream: "origin/main",
};

export const FEATURES: RepoFeatures = {
  hasIssues: true,
  hasPullRequests: true,
  archived: false,
  htmlUrl: "https://github.com/tva/timestream",
};

export function datedTimeline(base: Timeline): Timeline {
  return {
    ...base,
    nodes: base.nodes.map((node, i) => ({
      ...node,
      timestamp: NOW - (base.nodes.length - i) * 86_400,
      email: "analyst@tva.local",
      author: "Analyst",
    })),
  };
}

export const LINEAR = datedTimeline(linearTimeline());
export const MANY_BRANCHES = datedTimeline(manyBranchesTimeline());
export const TAGGED = datedTimeline(taggedTimeline());

export function emptyTimeline(): Timeline {
  return { sacredBranch: "main", head: null, nodes: [], edges: [], dossiers: [] };
}

export const FILES: FileChange[] = [
  { path: "src/lib/graph.rs", oldPath: null, status: "modified" },
  { path: "src/components/SacredTimeline.tsx", oldPath: null, status: "modified" },
  { path: "src/lib/newRail.ts", oldPath: null, status: "added" },
  { path: "README.md", oldPath: null, status: "deleted" },
];

export const STATUS: StatusPayload = {
  staged: [FILES[0]],
  unstaged: [FILES[1]],
  untracked: [{ path: "notes.txt", oldPath: null, status: "untracked" }],
};

export const EMPTY_STATUS: StatusPayload = { staged: [], unstaged: [], untracked: [] };

export const TEXT_DIFF: FileDiff = {
  path: "src/lib/graph.rs",
  oldPath: null,
  status: "modified",
  binary: false,
  hunks: [
    {
      oldStart: 10,
      oldLines: 6,
      newStart: 10,
      newLines: 7,
      header: "@@ -10,6 +10,7 @@ fn assign_lanes",
      lines: [
        { kind: "context", oldNo: 10, newNo: 10, text: " fn assign_lanes(nodes: &[Node]) {" },
        { kind: "deletion", oldNo: 11, newNo: null, text: "-    let gap = 24;" },
        { kind: "addition", oldNo: null, newNo: 11, text: "+    let gap = lane_gap(nodes.len());" },
        { kind: "context", oldNo: 12, newNo: 12, text: "     for node in nodes {" },
        { kind: "addition", oldNo: null, newNo: 13, text: "+        node.column = sacred_or_spur(node);" },
        { kind: "context", oldNo: 13, newNo: 14, text: "     }" },
        { kind: "context", oldNo: 14, newNo: 15, text: " }" },
      ],
    },
  ],
};

export const BINARY_DIFF: FileDiff = {
  path: "icons/icon.png",
  oldPath: null,
  status: "modified",
  binary: true,
  hunks: [],
};

export const EMPTY_DIFF: FileDiff = {
  path: "src/lib/ui.ts",
  oldPath: null,
  status: "modified",
  binary: false,
  hunks: [],
};

export function commitDetail(id: string, files = FILES): CommitDetail {
  const node =
    [...LINEAR.nodes, ...MANY_BRANCHES.nodes, ...TAGGED.nodes].find((n) => n.id === id) ??
    LINEAR.nodes.at(-1)!;
  return {
    id: node.id,
    shortId: node.shortId,
    summary: node.summary,
    body: "Keep the sacred river centered.\n\nReviewed-by: TVA",
    author: node.author,
    email: node.email,
    timestamp: node.timestamp,
    committer: node.author,
    committerEmail: node.email,
    committerTimestamp: node.timestamp,
    signed: true,
    signatureKind: "ssh",
    parents: node.parents,
    files,
  };
}

export const RANGE: RangeCompare = {
  base: "main",
  head: "feature",
  mergeBase: "nexus",
  ahead: 3,
  behind: 0,
  commits: [
    {
      id: "c1",
      shortId: "c1c1c1c",
      summary: "Lay variant fiber",
      author: "Analyst",
      email: "analyst@tva.local",
      timestamp: NOW - 7200,
    },
    {
      id: "c2",
      shortId: "c2c2c2c",
      summary: "Stamp the nexus",
      author: "Analyst",
      email: "analyst@tva.local",
      timestamp: NOW - 3600,
    },
  ],
  files: FILES,
};

export const PULL: PullRequestSummary = {
  number: 12,
  title: "Restore the variant fiber",
  body: "Lane assignment for long-diverged branches.",
  state: "open",
  draft: false,
  htmlUrl: "https://github.com/tva/timestream/pull/12",
  headRef: "feature",
  headSha: "c2",
  baseRef: "main",
  baseSha: "sacred",
  userLogin: "analyst",
  mergeable: true,
  labels: ["variant"],
  requestedReviewers: ["minuteman"],
  ciStatus: "success",
  reviewDecision: "APPROVED",
  createdAt: ISO,
};

export const PULLS: PullRequestSummary[] = [
  PULL,
  {
    ...PULL,
    number: 9,
    title: "Draft: chronomonitor grain",
    draft: true,
    headRef: "grain",
    reviewDecision: null,
    ciStatus: "pending",
  },
];

export const PULL_COUNTS: PullCounts = { open: 2, closed: 4 };

export const ISSUES: IssueSummary[] = [
  {
    number: 4,
    title: "Nexus tooltip collides on crowded tips",
    body: "Labels overlap when three variants share a row.",
    state: "open",
    htmlUrl: "https://github.com/tva/timestream/issues/4",
    userLogin: "minuteman",
    labels: ["bug"],
    assignees: ["analyst"],
    milestone: null,
    pullRequest: false,
    createdAt: ISO,
  },
];

export const ISSUE_COMMENTS: IssueComment[] = [
  {
    id: 1,
    userLogin: "analyst",
    body: "Reproduced on the crowded-tips fixture.",
    createdAt: ISO,
  },
];

export const REVIEWS: PullReview[] = [
  {
    id: 1,
    userLogin: "minuteman",
    body: "Lane gap looks stable.",
    state: "APPROVED",
    submittedAt: ISO,
  },
];

export const REVIEW_COMMENTS: ReviewComment[] = [
  {
    id: 80,
    path: "src/lib/graph.rs",
    line: 11,
    originalLine: 11,
    side: "RIGHT",
    body: "Confirm gap compression on 16 variants.",
    userLogin: "minuteman",
    diffHunk: "@@ -10,6 +10,7 @@",
    inReplyToId: null,
    createdAt: ISO,
  },
];

export const PULL_COMMITS: PullCommit[] = RANGE.commits.map((c) => ({
  sha: c.id,
  shortId: c.shortId,
  summary: c.summary,
  author: c.author,
  email: c.email,
  createdAt: ISO,
}));

export const CHECKS: CheckRunSummary[] = [
  {
    id: 22,
    name: "cargo test",
    status: "completed",
    conclusion: "success",
    htmlUrl: "https://github.com/tva/timestream/actions",
    headSha: "c2",
  },
  {
    id: 23,
    name: "bun test",
    status: "completed",
    conclusion: "failure",
    htmlUrl: "https://github.com/tva/timestream/actions",
    headSha: "c2",
  },
];

export const RELEASES: ReleaseSummary[] = [
  {
    id: 1,
    tagName: "v0.2.1",
    name: "First chronomonitor",
    body: "Sacred Timeline layout and local filing.",
    draft: false,
    prerelease: false,
    htmlUrl: "https://github.com/tva/timestream/releases/tag/v0.2.1",
    publishedAt: ISO,
  },
];

export const SSH_KEYS: SshKeyInfo[] = [
  {
    path: "/home/analyst/.ssh/id_ed25519",
    publicPath: "/home/analyst/.ssh/id_ed25519.pub",
    comment: "analyst@tva",
    fingerprint: "SHA256:specimenfingerprint111",
  },
  {
    path: "/home/analyst/.ssh/id_work",
    publicPath: "/home/analyst/.ssh/id_work.pub",
    comment: "work",
    fingerprint: "SHA256:specimenfingerprint222",
  },
];

export const AGENT_UP: SshAgentStatus = {
  running: true,
  serviceDisabled: false,
  hint: null,
  loadedFingerprints: [SSH_KEYS[0].fingerprint],
};

export const AGENT_DOWN: SshAgentStatus = {
  running: false,
  serviceDisabled: false,
  hint: "Windows OpenSSH agent is not running.",
  loadedFingerprints: [],
};

export const DEVICE_BEGIN: DeviceLoginBegin = {
  userCode: "TVA-7K2P",
  verificationUri: "https://github.com/login/device",
  deviceCode: "specimen-device",
  interval: 1,
  expiresIn: 900,
  clientIdConfigured: true,
};

export const SEARCH_HITS: RepoSearchHit[] = [
  {
    fullName: "tva/timestream",
    description: "Local-first Git client",
    sshUrl: "git@github.com:tva/timestream.git",
    cloneUrl: "https://github.com/tva/timestream.git",
    private: false,
  },
];

export const RECENT: RecentRepo[] = [
  { path: "/archives/timestream", name: "timestream", openedAt: Date.now() - 3_600_000 },
  { path: "/archives/sacred-river", name: "sacred-river", openedAt: Date.now() - 86_400_000 },
];

export const CLONE_LOG = [
  "Resolving git@github.com:tva/timestream.git",
  "Counting objects: 128",
  "Receiving objects: 64%",
];

export function settingsWithKey() {
  const base = defaultSettings();
  return {
    ...base,
    ssh: {
      ...base.ssh,
      defaultKey: SSH_KEYS[0].path,
      identities: [{ path: SSH_KEYS[0].path, label: "analyst@tva" }],
    },
  };
}
