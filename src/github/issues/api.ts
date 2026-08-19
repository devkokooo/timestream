import { invoke } from "@tauri-apps/api/core";
import type { CreateIssue, IssueComment, IssueSummary } from "./types";

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
