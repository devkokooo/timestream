import { invoke } from "@tauri-apps/api/core";
import type { CreateRelease, ReleaseSummary } from "./types";

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
