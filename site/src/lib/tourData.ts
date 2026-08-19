import type { ForgeUser } from "../../../src/auth/types";
import type { FileChange } from "../../../src/git/types";
import type { FileDiff, RangeCompare } from "../../../src/diff/types";
import type { IssueComment } from "../../../src/github/issues/types";
import type { PullCommit, PullRequestSummary } from "../../../src/github/pulls/types";
import type { PullReview } from "../../../src/github/reviews/types";
import type { AheadBehind } from "../../../src/remotes/types";
import type { SshAgentStatus, SshKeyInfo } from "../../../src/ssh/types";
import type { CommitDetail, Timeline } from "../../../src/timeline/types";
import type { StatusPayload } from "../../../src/worktree/types";

export const AUTHOR = "devkokooo";
export const AUTHOR_EMAIL = "devkoko.vt@gmail.com";
export const TOUR_USER: ForgeUser = {
  login: AUTHOR,
  name: "DevKoko",
  avatarUrl: "https://avatars.githubusercontent.com/u/210086900?v=4",
  email: AUTHOR_EMAIL,
  emails: [AUTHOR_EMAIL],
};
export const REMOTE = "git@github.com:devkokooo/timestream.git";
export const SACRED = "sacred";
export const HEAD_VARIANT = "BIGFEAT/github-integration";
export const REPO_PATH = "/archives/timestream";

export interface TourCommit {
  sha: string;
  summary: string;
  author: string;
}

/** Newest last — left-to-right on the LINEAR specimen. */
export const COMMITS: TourCommit[] = [
  { sha: "2b27faa", summary: "create UI visual testing gallery", author: AUTHOR },
  { sha: "385ea91", summary: "feat(github): add sign out button", author: AUTHOR },
  { sha: "31bcb10", summary: "feat(github): handle integration errors elegantly", author: AUTHOR },
  { sha: "201a2c2", summary: "feat(git-branch): create, edit, delete local branches (#6)", author: AUTHOR },
  { sha: "ab33665", summary: "ui(design): add temp logo", author: AUTHOR },
  { sha: "edca083", summary: "ui(design): replace old logo with new one", author: AUTHOR },
];

export const REVIEW_FILES: FileChange[] = [
  { path: "src-tauri/src/timeline/graph.rs", oldPath: null, status: "modified" },
  { path: "src/timeline/SacredTimeline.tsx", oldPath: null, status: "modified" },
  { path: "src/timeline/newRail.ts", oldPath: null, status: "added" },
  {
    path: "src/ui/styles/chronomonitor.css",
    oldPath: "src/ui/styles/monitor.css",
    status: "moved",
  },
  { path: "notes.txt", oldPath: null, status: "untracked" },
];

export const INITIAL_STATUS: StatusPayload = {
  staged: [REVIEW_FILES[0]],
  unstaged: [REVIEW_FILES[1], REVIEW_FILES[2], REVIEW_FILES[3]],
  untracked: [REVIEW_FILES[4]],
};

export const SYNC: AheadBehind = {
  ahead: 1,
  behind: 0,
  upstream: "origin/sacred",
};

type HunkKind = "context" | "addition" | "deletion";

function hunk(
  oldStart: number,
  newStart: number,
  scope: string,
  rows: Array<readonly [HunkKind, string]>,
): FileDiff["hunks"][number] {
  let oldNo = oldStart;
  let newNo = newStart;
  const lines = rows.map(([kind, body]) => {
    const mark = kind === "addition" ? "+" : kind === "deletion" ? "-" : " ";
    const line = {
      kind,
      oldNo: kind === "addition" ? null : oldNo,
      newNo: kind === "deletion" ? null : newNo,
      text: `${mark}${body}`,
    };
    if (kind !== "addition") oldNo += 1;
    if (kind !== "deletion") newNo += 1;
    return line;
  });
  const oldLines = oldNo - oldStart;
  const newLines = newNo - newStart;
  const oldSpan = oldStart === 0 && oldLines === 0 ? "0,0" : `${oldStart},${oldLines}`;
  return {
    oldStart,
    oldLines,
    newStart,
    newLines,
    header: `@@ -${oldSpan} +${newStart},${newLines} @@ ${scope}`,
    lines,
  };
}

const DIFF_BY_PATH: Record<string, FileDiff["hunks"]> = {
  "src-tauri/src/timeline/graph.rs": [
    hunk(292, 292, "fn assign_lanes", [
      ["context", "fn assign_lanes("],
      ["context", "    oldest_first: &[String],"],
      ["context", "    by_id: &HashMap<String, RawCommit>,"],
      ["deletion", "    gap: i32,"],
      ["addition", "    refs: &[RawRef],"],
      ["addition", "    sacred_tip: Option<&str>,"],
      ["context", ") -> HashMap<String, usize> {"],
      ["context", "    let mut tips = Vec::new();"],
      ["deletion", "    let column = 0;"],
      ["addition", "    let mut seen = HashSet::new();"],
      ["addition", "    if let Some(tip) = sacred_tip {"],
      ["addition", "        tips.push(tip.to_string());"],
      ["addition", "    }"],
      ["context", "    column_of"],
      ["context", "}"],
    ]),
  ],
  "src/timeline/SacredTimeline.tsx": [
    hunk(486, 486, "tagged ? (", [
      ["context", "              {tagged ? ("],
      ["context", "                <polygon"],
      ["deletion", "                  fill={stroke}"],
      ["addition", "                  points={diamondPoints(node.x, node.y, markR)}"],
      ["addition", "                  fill=\"url(#nexus-tag)\""],
      ["context", "                  stroke={stroke}"],
      ["context", "                />"],
      ["context", "              ) : ("],
      ["deletion", "                <rect x={node.x} y={node.y} />"],
      ["addition", "                <circle cx={node.x} cy={node.y} r={markR} />"],
      ["context", "              )}"],
    ]),
  ],
  "src/timeline/newRail.ts": [
    hunk(0, 1, "", [
      ["addition", "export function railOffset(lane: number, sacred: number): number {"],
      ["addition", "  if (lane === sacred) return 0;"],
      ["addition", "  const spur = lane - sacred;"],
      ["addition", "  return Math.sign(spur) * (Math.abs(spur) * 28 + 12);"],
      ["addition", "}"],
      ["addition", ""],
      ["addition", "export function railTone(lane: number, sacred: number): string {"],
      ["addition", "  return lane === sacred ? \"#E8B86D\" : \"#E85D04\";"],
      ["addition", "}"],
    ]),
  ],
  "src/ui/styles/chronomonitor.css": [
    hunk(1, 1, ".monitor-svg", [
      ["deletion", ".monitor-svg {"],
      ["addition", ".chronomonitor-svg {"],
      ["context", "  display: block;"],
      ["context", "  width: 100%;"],
      ["context", "  height: 100%;"],
      ["deletion", "  cursor: default;"],
      ["addition", "  cursor: grab;"],
      ["context", "}"],
      ["context", ""],
      ["deletion", ".monitor-svg:active {"],
      ["addition", ".chronomonitor-svg:active {"],
      ["context", "  cursor: grabbing;"],
      ["context", "}"],
    ]),
  ],
  "notes.txt": [
    hunk(0, 1, "", [
      ["addition", "VARIANT DESK — filed 18 Aug"],
      ["addition", ""],
      ["addition", "Keep the sacred river centered."],
      ["addition", "Spurs go above / below; do not stack on the trunk."],
      ["addition", "No force-push. Local amend of unpublished HEAD only."],
    ]),
  ],
  "src/github/HqMode.tsx": [
    hunk(326, 326, "async function reload", [
      ["context", "  async function reload() {"],
      ["context", "    if (!props.signedIn || !props.owner || !props.repoName) return;"],
      ["deletion", "    const next = await githubListPulls(props.owner, props.repoName, filter);"],
      ["deletion", "    setPrs(next);"],
      ["addition", "    const [next, nextCounts] = await Promise.all(["],
      ["addition", "      githubListPulls(props.owner, props.repoName, filter),"],
      ["addition", "      githubListPullCounts(props.owner, props.repoName),"],
      ["addition", "    ]);"],
      ["addition", "    setPrs(next);"],
      ["addition", "    if (nextCounts) setCounts(nextCounts);"],
      ["context", "  }"],
    ]),
  ],
  "src-tauri/src/github/pulls.rs": [
    hunk(473, 473, "pub async fn list_pulls", [
      ["context", "pub async fn list_pulls(owner: &str, repo: &str, filter: &str) -> Result<Vec<PullRequestSummary>> {"],
      ["deletion", "    let raw: Vec<Value> = get_json(&format!(\"/repos/{owner}/{repo}/pulls\")).await?;"],
      ["deletion", "    Ok(raw.iter().map(map_pr).collect())"],
      ["addition", "    let state = if filter == \"closed\" { \"closed\" } else { \"open\" };"],
      ["addition", "    let raw: Vec<Value> = get_json(&format!("],
      ["addition", "        \"/repos/{owner}/{repo}/pulls?state={state}&per_page=50\""],
      ["addition", "    ))"],
      ["addition", "    .await?;"],
      ["addition", "    Ok(raw.iter().map(map_pr).collect())"],
      ["context", "}"],
    ]),
  ],
  "src-tauri/src/github/auth.rs": [
    hunk(0, 1, "", [
      ["addition", "pub async fn login_begin() -> Result<DeviceLoginBegin> {"],
      ["addition", "    let text = post_oauth_form("],
      ["addition", "        \"https://github.com/login/device/code\","],
      ["addition", "        &[(\"client_id\", GITHUB_CLIENT_ID)],"],
      ["addition", "    )"],
      ["addition", "    .await?;"],
      ["addition", "    let res: DeviceCodeResponse = serde_json::from_str(&text)?;"],
      ["addition", "    Ok(DeviceLoginBegin {"],
      ["addition", "        user_code: res.user_code,"],
      ["addition", "        verification_uri: res.verification_uri,"],
      ["addition", "        device_code: res.device_code,"],
      ["addition", "        client_id_configured: true,"],
      ["addition", "    })"],
      ["addition", "}"],
    ]),
  ],
};

export function fileDiffFor(path: string, status = "modified"): FileDiff {
  const file =
    REVIEW_FILES.find((item) => item.path === path) ??
    PR2_FILES.find((item) => item.path === path) ??
    null;
  return {
    path,
    oldPath: file?.oldPath ?? null,
    status: status === "modified" ? (file?.status ?? status) : status,
    binary: false,
    hunks: DIFF_BY_PATH[path] ?? [],
  };
}

export const SSH_KEYS: SshKeyInfo[] = [
  {
    path: "/home/analyst/.ssh/id_ed25519",
    publicPath: "/home/analyst/.ssh/id_ed25519.pub",
    comment: "devkokooo@timestream",
    fingerprint: "SHA256:timestreamed25519",
  },
  {
    path: "/home/analyst/.ssh/id_ed25519_github",
    publicPath: "/home/analyst/.ssh/id_ed25519_github.pub",
    comment: "github.com",
    fingerprint: "SHA256:timestreamgithub",
  },
];

export const AGENT_UP: SshAgentStatus = {
  running: true,
  serviceDisabled: false,
  hint: null,
  loadedFingerprints: [SSH_KEYS[0].fingerprint],
};

export const PR2: PullRequestSummary = {
  number: 2,
  title: "github integration",
  body: "there's a lot of changes to git management, commit review, PRs and issues\n\nand if you can see this from github, it means github integration for PRs work in timestream\n\nmaybe I should split this feature into multiple parts, will make it easier to handle",
  state: "closed",
  draft: false,
  htmlUrl: "https://github.com/devkokooo/timestream/pull/2",
  headRef: HEAD_VARIANT,
  headSha: "03d9763e04436992a5bd13f3ddffd0e5b8e4f4ee",
  baseRef: SACRED,
  baseSha: "b5d6f691f2f999b43bf549eb0b20858f3a8ff041",
  userLogin: AUTHOR,
  mergeable: null,
  labels: [],
  requestedReviewers: [],
  ciStatus: "success",
  reviewDecision: null,
  createdAt: "2026-08-16T04:42:16Z",
};

export const PR2_COMMITS: PullCommit[] = [
  {
    sha: "c16db281cf28b358244b8c0a14790747e545ed81",
    shortId: "c16db28",
    summary: "first pass - github integration",
    author: AUTHOR,
    email: "devkoko.vt@gmail.com",
    createdAt: "2026-08-15T18:38:01Z",
  },
  {
    sha: "0d09542a0d09542a0d09542a0d09542a0d09542a",
    shortId: "0d09542",
    summary: "add github integration with PR support",
    author: AUTHOR,
    email: "devkoko.vt@gmail.com",
    createdAt: "2026-08-15T22:10:00Z",
  },
  {
    sha: "03d9763e04436992a5bd13f3ddffd0e5b8e4f4ee",
    shortId: "03d9763",
    summary: "make issues UI pretty, add timestream attribution on github",
    author: AUTHOR,
    email: "devkoko.vt@gmail.com",
    createdAt: "2026-08-16T06:08:00Z",
  },
];

export const PR2_COMMENTS: IssueComment[] = [
  {
    id: 5306043936,
    userLogin: AUTHOR,
    body: "should attribute to timestream now when I comment on PR",
    createdAt: "2026-08-16T06:06:54Z",
  },
];

export const PR2_REVIEWS: PullReview[] = [
  {
    id: 4945417358,
    userLogin: AUTHOR,
    body: "wow I can comment from timestream",
    state: "COMMENTED",
    submittedAt: "2026-08-16T04:46:29Z",
  },
  {
    id: 4945419744,
    userLogin: AUTHOR,
    body: "another note, fixing some UI issues",
    state: "COMMENTED",
    submittedAt: "2026-08-16T04:48:26Z",
  },
  {
    id: 4945434759,
    userLogin: AUTHOR,
    body: "wow I can see comments from timestream now",
    state: "COMMENTED",
    submittedAt: "2026-08-16T04:56:17Z",
  },
  {
    id: 4945549104,
    userLogin: AUTHOR,
    body: "test",
    state: "COMMENTED",
    submittedAt: "2026-08-16T06:04:30Z",
  },
];

export const PR2_FILES: FileChange[] = [
  { path: "src/github/HqMode.tsx", oldPath: null, status: "modified" },
  { path: "src-tauri/src/github/pulls.rs", oldPath: null, status: "modified" },
  { path: "src-tauri/src/github/auth.rs", oldPath: null, status: "added" },
];

const TS_AUG_15 = Date.parse("2026-08-15T18:38:01Z") / 1000;
const TS_AUG_15_LATE = Date.parse("2026-08-15T22:10:00Z") / 1000;
const TS_AUG_16 = Date.parse("2026-08-16T06:08:00Z") / 1000;

export const PR2_RANGE: RangeCompare = {
  base: SACRED,
  head: HEAD_VARIANT,
  mergeBase: PR2.baseSha,
  ahead: 3,
  behind: 0,
  commits: [
    {
      id: PR2_COMMITS[0].sha,
      shortId: PR2_COMMITS[0].shortId,
      summary: PR2_COMMITS[0].summary,
      author: AUTHOR,
      email: "devkoko.vt@gmail.com",
      timestamp: TS_AUG_15,
    },
    {
      id: PR2_COMMITS[1].sha,
      shortId: PR2_COMMITS[1].shortId,
      summary: PR2_COMMITS[1].summary,
      author: AUTHOR,
      email: "devkoko.vt@gmail.com",
      timestamp: TS_AUG_15_LATE,
    },
    {
      id: PR2_COMMITS[2].sha,
      shortId: PR2_COMMITS[2].shortId,
      summary: PR2_COMMITS[2].summary,
      author: AUTHOR,
      email: "devkoko.vt@gmail.com",
      timestamp: TS_AUG_16,
    },
  ],
  files: PR2_FILES,
};

export const PR2_TIMELINE: Timeline = {
  sacredBranch: SACRED,
  head: PR2.headSha,
  nodes: [],
  edges: [],
  dossiers: [
    {
      name: SACRED,
      tip: PR2.baseSha,
      isSacred: true,
      isHead: false,
      exclusiveCommits: 0,
      divergeRow: null,
      commitsApart: 0,
      threat: "low",
      isUpstream: false,
    },
    {
      name: HEAD_VARIANT,
      tip: PR2.headSha,
      isSacred: false,
      isHead: true,
      exclusiveCommits: 3,
      divergeRow: 0,
      commitsApart: 3,
      threat: "low",
      isUpstream: false,
    },
  ],
};

function filesForCommit(sha: string): FileChange[] {
  if (sha === PR2_COMMITS[0].sha) return [PR2_FILES[2]];
  if (sha === PR2_COMMITS[1].sha) return [PR2_FILES[1]];
  if (sha === PR2_COMMITS[2].sha) return [PR2_FILES[0]];
  return PR2_FILES;
}

export function tourCommitDetail(sha: string): CommitDetail {
  const commit = PR2_RANGE.commits.find((item) => item.id === sha) ?? PR2_RANGE.commits[0];
  return {
    id: commit.id,
    shortId: commit.shortId,
    summary: commit.summary,
    body: "GitHub PRs, issues, and filing — visible from HQ.",
    author: commit.author,
    email: commit.email,
    timestamp: commit.timestamp,
    committer: commit.author,
    committerEmail: commit.email,
    committerTimestamp: commit.timestamp,
    signed: true,
    signatureKind: "ssh",
    parents: [],
    files: filesForCommit(commit.id),
  };
}
