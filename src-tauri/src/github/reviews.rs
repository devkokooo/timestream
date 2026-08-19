use crate::error::Result;
use crate::github::{created_at, get_json, login, request};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewComment {
    pub id: u64,
    pub path: String,
    pub line: Option<u32>,
    pub original_line: Option<u32>,
    pub side: Option<String>,
    pub body: String,
    pub user_login: String,
    pub diff_hunk: Option<String>,
    pub in_reply_to_id: Option<u64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullCommit {
    pub sha: String,
    pub short_id: String,
    pub summary: String,
    pub author: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullReview {
    pub id: u64,
    pub user_login: String,
    pub body: String,
    pub state: String,
    pub submitted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitReview {
    pub body: String,
    pub event: String,
    pub comments: Vec<PendingReviewComment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingReviewComment {
    pub path: String,
    pub body: String,
    pub line: u32,
    pub side: String,
}

pub async fn list_review_comments(
    owner: &str,
    repo: &str,
    number: u64,
) -> Result<Vec<ReviewComment>> {
    let raw: Vec<Value> =
        get_json(&format!("/repos/{owner}/{repo}/pulls/{number}/comments")).await?;
    Ok(raw.iter().map(map_review_comment).collect())
}

fn map_review_comment(v: &Value) -> ReviewComment {
    ReviewComment {
        id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
        path: v
            .get("path")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        line: v.get("line").and_then(|x| x.as_u64()).map(|n| n as u32),
        original_line: v
            .get("original_line")
            .and_then(|x| x.as_u64())
            .map(|n| n as u32),
        side: v
            .get("side")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        body: v
            .get("body")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        user_login: v.get("user").map(login).unwrap_or_default(),
        diff_hunk: v
            .get("diff_hunk")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        in_reply_to_id: v.get("in_reply_to_id").and_then(|x| x.as_u64()),
        created_at: created_at(v),
    }
}

fn map_pull_commit(v: &Value) -> PullCommit {
    let commit = v.get("commit").cloned().unwrap_or(json!({}));
    let message = commit.get("message").and_then(|x| x.as_str()).unwrap_or("");
    let summary = message.lines().next().unwrap_or("").to_string();
    let sha = v
        .get("sha")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let author = v
        .get("author")
        .map(login)
        .filter(|s| !s.is_empty())
        .or_else(|| {
            commit
                .get("author")
                .and_then(|a| a.get("name"))
                .and_then(|n| n.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_default();
    let created = commit
        .get("author")
        .and_then(|a| a.get("date"))
        .and_then(|d| d.as_str())
        .or_else(|| {
            commit
                .get("committer")
                .and_then(|a| a.get("date"))
                .and_then(|d| d.as_str())
        })
        .unwrap_or("")
        .to_string();
    let email = commit
        .get("author")
        .and_then(|a| a.get("email"))
        .and_then(|e| e.as_str())
        .or_else(|| {
            commit
                .get("committer")
                .and_then(|a| a.get("email"))
                .and_then(|e| e.as_str())
        })
        .unwrap_or("")
        .to_string();
    PullCommit {
        sha: sha.clone(),
        short_id: sha.chars().take(7).collect(),
        summary,
        author,
        email,
        created_at: created,
    }
}

fn map_review(v: &Value) -> PullReview {
    PullReview {
        id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
        user_login: v.get("user").map(login).unwrap_or_default(),
        body: v
            .get("body")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        state: v
            .get("state")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        submitted_at: v
            .get("submitted_at")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
    }
}

pub async fn list_pull_commits(owner: &str, repo: &str, number: u64) -> Result<Vec<PullCommit>> {
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/pulls/{number}/commits?per_page=100"
    ))
    .await?;
    Ok(raw.iter().map(map_pull_commit).collect())
}

pub async fn list_reviews(owner: &str, repo: &str, number: u64) -> Result<Vec<PullReview>> {
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/pulls/{number}/reviews?per_page=100"
    ))
    .await?;
    Ok(raw
        .iter()
        .map(map_review)
        .filter(|r| r.state != "PENDING")
        .collect())
}

pub async fn submit_review(
    owner: &str,
    repo: &str,
    number: u64,
    input: SubmitReview,
) -> Result<()> {
    let event = match input.event.as_str() {
        "APPROVE" | "REQUEST_CHANGES" | "COMMENT" => input.event.as_str(),
        _ => "COMMENT",
    };
    let comments: Vec<Value> = input
        .comments
        .iter()
        .map(|c| {
            json!({
                "path": c.path,
                "body": c.body,
                "line": c.line,
                "side": if c.side.is_empty() { "RIGHT" } else { c.side.as_str() },
            })
        })
        .collect();
    request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/pulls/{number}/reviews"),
        Some(json!({
            "body": input.body,
            "event": event,
            "comments": comments,
        })),
    )
    .await?;
    Ok(())
}

pub async fn reply_review_comment(
    owner: &str,
    repo: &str,
    number: u64,
    comment_id: u64,
    body: &str,
) -> Result<ReviewComment> {
    let res = request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies"),
        Some(json!({ "body": body })),
    )
    .await?;
    let v: Value = res.json().await?;
    Ok(map_review_comment(&v))
}

#[tauri::command]
pub async fn github_list_review_comments(
    owner: String,
    repo: String,
    number: u64,
) -> Result<Vec<ReviewComment>> {
    list_review_comments(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_list_pull_commits(
    owner: String,
    repo: String,
    number: u64,
) -> Result<Vec<PullCommit>> {
    list_pull_commits(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_list_reviews(
    owner: String,
    repo: String,
    number: u64,
) -> Result<Vec<PullReview>> {
    list_reviews(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_submit_review(
    owner: String,
    repo: String,
    number: u64,
    input: SubmitReview,
) -> Result<()> {
    submit_review(&owner, &repo, number, input).await
}

#[tauri::command]
pub async fn github_reply_review_comment(
    owner: String,
    repo: String,
    number: u64,
    comment_id: u64,
    body: String,
) -> Result<ReviewComment> {
    reply_review_comment(&owner, &repo, number, comment_id, &body).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_pull_commit_and_review() {
        let commit = map_pull_commit(&json!({
            "sha": "abcdef1234567890",
            "author": { "login": "analyst" },
            "commit": {
                "message": "Fix river\n\nKeep it gold.",
                "author": { "name": "Analyst", "email": "analyst@tva.local", "date": "2026-08-16T13:00:00Z" }
            }
        }));
        assert_eq!(commit.short_id, "abcdef1");
        assert_eq!(commit.summary, "Fix river");
        assert_eq!(commit.author, "analyst");
        assert_eq!(commit.email, "analyst@tva.local");
        assert_eq!(commit.created_at, "2026-08-16T13:00:00Z");

        let review = map_review(&json!({
            "id": 9,
            "user": { "login": "reviewer" },
            "body": "Looks clear.",
            "state": "APPROVED",
            "submitted_at": "2026-08-16T14:00:00Z"
        }));
        assert_eq!(review.state, "APPROVED");
        assert_eq!(review.submitted_at, "2026-08-16T14:00:00Z");
    }
}
