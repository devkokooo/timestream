import { invoke } from "@tauri-apps/api/core";
import type { NotificationItem, RepoFeatures, RepoSearchHit } from "./types";

export function githubRepoFeatures(owner: string, repo: string): Promise<RepoFeatures> {
  return invoke("github_repo_features", { owner, repo });
}

export function githubListNotifications(): Promise<NotificationItem[]> {
  return invoke("github_list_notifications");
}

export function githubSearchRepos(query: string): Promise<RepoSearchHit[]> {
  return invoke("github_search_repos", { query });
}
