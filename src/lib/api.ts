import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  BranchInfo,
  CommitDetail,
  FileDiff,
  RepoSummary,
  StatusPayload,
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

export function stageFile(path: string, rel: string): Promise<StatusPayload> {
  return invoke("stage_file", { path, rel });
}

export function unstageFile(path: string, rel: string): Promise<StatusPayload> {
  return invoke("unstage_file", { path, rel });
}

export function fileCommit(path: string, message: string): Promise<string> {
  return invoke("file_commit", { path, message });
}
