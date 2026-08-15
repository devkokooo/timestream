import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AheadBehind,
  AppSettings,
  BranchInfo,
  CheckRunSummary,
  CommitDetail,
  CreateIssue,
  CreatePullRequest,
  CreateRelease,
  DeviceLoginBegin,
  FileDiff,
  GithubUser,
  IssueComment,
  IssueSummary,
  NotificationItem,
  PullRequestSummary,
  ReleaseSummary,
  RemoteAuthArgs,
  RemoteInfo,
  RepoSearchHit,
  RepoSummary,
  ReviewComment,
  SshAgentStatus,
  SshKeyInfo,
  StatusPayload,
  SubmitReview,
  Timeline,
} from "./types";

export async function pickRepository(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Submit a working tree for review",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export async function pickCloneDestination(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Clone destination",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export async function pickSshKey(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    title: "Select an SSH private key",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export function openRepository(path: string): Promise<RepoSummary> {
  return invoke("open_repository", { path });
}

export function getTimeline(path: string): Promise<Timeline> {
  return invoke("get_timeline", { path });
}

export function getStatus(path: string): Promise<StatusPayload> {
  return invoke("get_status", { path });
}

export function getCommit(path: string, sha: string): Promise<CommitDetail> {
  return invoke("get_commit", { path, sha });
}

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

export function getBranches(path: string): Promise<BranchInfo[]> {
  return invoke("get_branches", { path });
}

export function switchBranch(path: string, name: string): Promise<RepoSummary> {
  return invoke("switch_branch", { path, name });
}

export function createLocalBranch(path: string, name: string): Promise<RepoSummary> {
  return invoke("create_local_branch", { path, name });
}

export function stageFile(path: string, rel: string): Promise<StatusPayload> {
  return invoke("stage_file", { path, rel });
}

export function unstageFile(path: string, rel: string): Promise<StatusPayload> {
  return invoke("unstage_file", { path, rel });
}

export function fileCommit(path: string, message: string): Promise<string> {
  return invoke("file_commit", { path, message });
}

export function createLocalTag(
  path: string,
  name: string,
  sha: string,
  message?: string,
): Promise<void> {
  return invoke("create_local_tag", { path, name, sha, message: message ?? null });
}

export function deleteLocalTag(path: string, name: string): Promise<void> {
  return invoke("delete_local_tag", { path, name });
}

export function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export function setSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke("set_settings", { settings });
}

export function settingsTomlPath(): Promise<string> {
  return invoke("settings_toml_path");
}

export function githubLoginBegin(): Promise<DeviceLoginBegin> {
  return invoke("github_login_begin");
}

export function githubLoginPoll(deviceCode: string): Promise<GithubUser | null> {
  return invoke("github_login_poll", { deviceCode });
}

export function githubLoginPat(token: string): Promise<GithubUser> {
  return invoke("github_login_pat", { token });
}

export function githubWhoami(): Promise<GithubUser | null> {
  return invoke("github_whoami");
}

export function githubLogout(): Promise<void> {
  return invoke("github_logout");
}

export function listRemotes(path: string): Promise<RemoteInfo[]> {
  return invoke("list_remotes", { path });
}

export function githubOrigin(path: string): Promise<RemoteInfo | null> {
  return invoke("github_origin", { path });
}

export function aheadBehind(path: string): Promise<AheadBehind> {
  return invoke("ahead_behind", { path });
}

export function fetchRemote(args: RemoteAuthArgs): Promise<AheadBehind> {
  return invoke("fetch_remote", { args });
}

export function pushBranch(args: RemoteAuthArgs, branch?: string): Promise<AheadBehind> {
  return invoke("push_branch", { args, branch: branch ?? null });
}

export function pullFfOnly(args: RemoteAuthArgs): Promise<AheadBehind> {
  return invoke("pull_ff_only", { args });
}

export function cloneRepository(
  url: string,
  dest: string,
  keyPath?: string,
  passphrase?: string,
): Promise<RepoSummary> {
  return invoke("clone_repository", {
    url,
    dest,
    keyPath: keyPath ?? null,
    passphrase: passphrase ?? null,
  });
}

export function pushTag(args: RemoteAuthArgs, tag: string): Promise<void> {
  return invoke("push_tag", { args, tag });
}

export function deleteRemoteTag(args: RemoteAuthArgs, tag: string): Promise<void> {
  return invoke("delete_remote_tag", { args, tag });
}

export function checkoutPullRequest(args: RemoteAuthArgs, number: number): Promise<RepoSummary> {
  return invoke("checkout_pull_request", { args, number });
}

export function listSshKeys(): Promise<SshKeyInfo[]> {
  return invoke("list_ssh_keys");
}

export function sshAgentStatus(): Promise<SshAgentStatus> {
  return invoke("ssh_agent_status");
}

export function sshAgentEnsure(): Promise<SshAgentStatus> {
  return invoke("ssh_agent_ensure");
}

export function sshAddKey(path: string, passphrase?: string): Promise<SshAgentStatus> {
  return invoke("ssh_add_key", { path, passphrase: passphrase ?? null });
}

export function githubListPulls(
  owner: string,
  repo: string,
  filter: string,
): Promise<PullRequestSummary[]> {
  return invoke("github_list_pulls", { owner, repo, filter });
}

export function githubGetPull(
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestSummary> {
  return invoke("github_get_pull", { owner, repo, number });
}

export function githubCreatePull(
  owner: string,
  repo: string,
  input: CreatePullRequest,
): Promise<PullRequestSummary> {
  return invoke("github_create_pull", { owner, repo, input });
}

export function githubUpdatePull(
  owner: string,
  repo: string,
  number: number,
  patch: Record<string, unknown>,
): Promise<PullRequestSummary> {
  return invoke("github_update_pull", { owner, repo, number, patch });
}

export function githubMergePull(
  owner: string,
  repo: string,
  number: number,
  method: string,
): Promise<PullRequestSummary> {
  return invoke("github_merge_pull", { owner, repo, number, method });
}

export function githubListIssues(
  owner: string,
  repo: string,
  filter: string,
): Promise<IssueSummary[]> {
  return invoke("github_list_issues", { owner, repo, filter });
}

export function githubCreateIssue(
  owner: string,
  repo: string,
  input: CreateIssue,
): Promise<IssueSummary> {
  return invoke("github_create_issue", { owner, repo, input });
}

export function githubUpdateIssue(
  owner: string,
  repo: string,
  number: number,
  patch: Record<string, unknown>,
): Promise<IssueSummary> {
  return invoke("github_update_issue", { owner, repo, number, patch });
}

export function githubListIssueComments(
  owner: string,
  repo: string,
  number: number,
): Promise<IssueComment[]> {
  return invoke("github_list_issue_comments", { owner, repo, number });
}

export function githubAddIssueComment(
  owner: string,
  repo: string,
  number: number,
  body: string,
): Promise<IssueComment> {
  return invoke("github_add_issue_comment", { owner, repo, number, body });
}

export function githubListReleases(owner: string, repo: string): Promise<ReleaseSummary[]> {
  return invoke("github_list_releases", { owner, repo });
}

export function githubCreateRelease(
  owner: string,
  repo: string,
  input: CreateRelease,
): Promise<ReleaseSummary> {
  return invoke("github_create_release", { owner, repo, input });
}

export function githubUpdateRelease(
  owner: string,
  repo: string,
  id: number,
  patch: Record<string, unknown>,
): Promise<ReleaseSummary> {
  return invoke("github_update_release", { owner, repo, id, patch });
}

export function githubListChecks(
  owner: string,
  repo: string,
  sha: string,
): Promise<CheckRunSummary[]> {
  return invoke("github_list_checks", { owner, repo, sha });
}

export function githubRerunJob(owner: string, repo: string, jobId: number): Promise<void> {
  return invoke("github_rerun_job", { owner, repo, jobId });
}

export function githubListReviewComments(
  owner: string,
  repo: string,
  number: number,
): Promise<ReviewComment[]> {
  return invoke("github_list_review_comments", { owner, repo, number });
}

export function githubSubmitReview(
  owner: string,
  repo: string,
  number: number,
  input: SubmitReview,
): Promise<void> {
  return invoke("github_submit_review", { owner, repo, number, input });
}

export function githubReplyReviewComment(
  owner: string,
  repo: string,
  number: number,
  commentId: number,
  body: string,
): Promise<ReviewComment> {
  return invoke("github_reply_review_comment", {
    owner,
    repo,
    number,
    commentId,
    body,
  });
}

export function githubListNotifications(): Promise<NotificationItem[]> {
  return invoke("github_list_notifications");
}

export function githubSearchRepos(query: string): Promise<RepoSearchHit[]> {
  return invoke("github_search_repos", { query });
}

export function isSshIdentityError(err: unknown): boolean {
  return String(err).includes("SSH_IDENTITY_REQUIRED");
}

export function isPassphraseError(err: unknown): boolean {
  return String(err).includes("SSH_PASSPHRASE_REQUIRED");
}

export function isDivergedError(err: unknown): boolean {
  return String(err).includes("VARIANT_DIVERGED");
}

export function isAuthError(err: unknown): boolean {
  return String(err).includes("GITHUB_AUTH_REQUIRED");
}
