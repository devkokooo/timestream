import { invoke } from "@tauri-apps/api/core";
import type { RepoSummary } from "@/git/types";
import type { BranchInfo } from "./types";

export function getBranches(path: string): Promise<BranchInfo[]> {
  return invoke("get_branches", { path });
}

export function switchBranch(path: string, name: string): Promise<RepoSummary> {
  return invoke("switch_branch", { path, name });
}

export function createLocalBranch(
  path: string,
  name: string,
  checkout = true,
): Promise<RepoSummary> {
  return invoke("create_local_branch", { path, name, checkout });
}

export function renameLocalBranch(path: string, from: string, to: string): Promise<RepoSummary> {
  return invoke("rename_local_branch", { path, from, to });
}

export function deleteLocalBranch(path: string, name: string): Promise<void> {
  return invoke("delete_local_branch", { path, name });
}
