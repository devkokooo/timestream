import { invoke } from "@tauri-apps/api/core";
import type { PullReview, ReviewComment, SubmitReview } from "./types";

export function githubListReviewComments(
  owner: string,
  repo: string,
  number: number,
): Promise<ReviewComment[]> {
  return invoke("github_list_review_comments", { owner, repo, number });
}

export function githubListReviews(
  owner: string,
  repo: string,
  number: number,
): Promise<PullReview[]> {
  return invoke("github_list_reviews", { owner, repo, number });
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
