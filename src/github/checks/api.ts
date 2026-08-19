import { invoke } from "@tauri-apps/api/core";
import type { CheckRunSummary } from "./types";

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
