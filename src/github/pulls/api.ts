import { invoke } from "@tauri-apps/api/core";
import type { CreatePullRequest, PullCommit, PullCounts, PullRequestSummary } from "./types";

export function githubListPulls(
  owner: string,
  repo: string,
  filter: string,
): Promise<PullRequestSummary[]> {
  return invoke("github_list_pulls", { owner, repo, filter });
}

export function githubListPullCounts(owner: string, repo: string): Promise<PullCounts> {
  return invoke("github_list_pull_counts", { owner, repo });
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

export function githubListPullCommits(
  owner: string,
  repo: string,
  number: number,
): Promise<PullCommit[]> {
  return invoke("github_list_pull_commits", { owner, repo, number });
}
