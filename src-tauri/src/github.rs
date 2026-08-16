use crate::auth;
use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const UA: &str = "timestream";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestSummary {
    pub number: u64,
    pub title: String,
    pub body: String,
    pub state: String,
    pub draft: bool,
    pub html_url: String,
    pub head_ref: String,
    pub head_sha: String,
    pub base_ref: String,
    pub base_sha: String,
    pub user_login: String,
    pub mergeable: Option<bool>,
    pub labels: Vec<String>,
    pub requested_reviewers: Vec<String>,
    pub ci_status: Option<String>,
    pub review_decision: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueSummary {
    pub number: u64,
    pub title: String,
    pub body: String,
    pub state: String,
    pub html_url: String,
    pub user_login: String,
    pub labels: Vec<String>,
    pub assignees: Vec<String>,
    pub milestone: Option<String>,
    pub pull_request: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueComment {
    pub id: u64,
    pub user_login: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseSummary {
    pub id: u64,
    pub tag_name: String,
    pub name: String,
    pub body: String,
    pub draft: bool,
    pub prerelease: bool,
    pub html_url: String,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckRunSummary {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub html_url: Option<String>,
    pub head_sha: String,
}

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
pub struct NotificationItem {
    pub id: String,
    pub reason: String,
    pub title: String,
    pub repo: String,
    pub kind: String,
    pub unread: bool,
    pub updated_at: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePullRequest {
    pub title: String,
    pub body: String,
    pub head: String,
    pub base: String,
    pub draft: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIssue {
    pub title: String,
    pub body: String,
    pub labels: Vec<String>,
    pub assignees: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRelease {
    pub tag_name: String,
    pub name: String,
    pub body: String,
    pub draft: bool,
    pub prerelease: bool,
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

async fn token() -> Result<String> {
    auth::valid_token()
        .await?
        .ok_or_else(|| AppError::msg("GITHUB_AUTH_REQUIRED"))
}

async fn send_request(
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
    token: &str,
) -> Result<reqwest::Response> {
    let client = reqwest::Client::new();
    let mut req = client
        .request(method, format!("https://api.github.com{path}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", UA)
        .header("Authorization", format!("Bearer {token}"))
        .header("X-GitHub-Api-Version", "2022-11-28");
    if let Some(body) = body {
        req = req.json(&body);
    }
    Ok(req.send().await?)
}

fn api_error(status: reqwest::StatusCode, text: String) -> AppError {
    AppError::msg(format!("GitHub API {status}: {text}"))
}

async fn request(
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> Result<reqwest::Response> {
    let token = token().await?;
    let res = send_request(method.clone(), path, body.clone(), &token).await?;
    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        if let Ok(Some(next)) = auth::refresh_access_token().await {
            let retry = send_request(method, path, body, &next).await?;
            if !retry.status().is_success() {
                let status = retry.status();
                let text = retry.text().await.unwrap_or_default();
                return Err(api_error(status, text));
            }
            return Ok(retry);
        }
    }
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(api_error(status, text));
    }
    Ok(res)
}

async fn get_json<T: for<'de> Deserialize<'de>>(path: &str) -> Result<T> {
    Ok(request(reqwest::Method::GET, path, None).await?.json().await?)
}

fn login(v: &Value) -> String {
    v.get("login").and_then(|x| x.as_str()).unwrap_or("").to_string()
}

fn labels(v: &Value) -> Vec<String> {
    v.get("labels")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|l| l.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn map_pr(v: &Value) -> PullRequestSummary {
    let head = v.get("head").cloned().unwrap_or(json!({}));
    let base = v.get("base").cloned().unwrap_or(json!({}));
    PullRequestSummary {
        number: v.get("number").and_then(|x| x.as_u64()).unwrap_or(0),
        title: v.get("title").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        state: v.get("state").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        draft: v.get("draft").and_then(|x| x.as_bool()).unwrap_or(false),
        html_url: v.get("html_url").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        head_ref: head.get("ref").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        head_sha: head.get("sha").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        base_ref: base.get("ref").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        base_sha: base.get("sha").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        user_login: v.get("user").map(login).unwrap_or_default(),
        mergeable: v.get("mergeable").and_then(|x| x.as_bool()),
        labels: labels(v),
        requested_reviewers: v
            .get("requested_reviewers")
            .and_then(|x| x.as_array())
            .map(|arr| arr.iter().map(login).collect())
            .unwrap_or_default(),
        ci_status: None,
        review_decision: None,
        created_at: created_at(v),
    }
}

fn created_at(v: &Value) -> String {
    v.get("created_at")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoFeatures {
    pub has_issues: bool,
    pub has_pull_requests: bool,
    pub archived: bool,
    pub html_url: String,
}

fn map_repo_features(v: &Value) -> RepoFeatures {
    let archived = v.get("archived").and_then(|x| x.as_bool()).unwrap_or(false);
    let disabled = v.get("disabled").and_then(|x| x.as_bool()).unwrap_or(false);
    let sealed = archived || disabled;
    RepoFeatures {
        has_issues: !sealed && v.get("has_issues").and_then(|x| x.as_bool()).unwrap_or(true),
        has_pull_requests: !sealed
            && v
                .get("has_pull_requests")
                .and_then(|x| x.as_bool())
                .unwrap_or(true),
        archived,
        html_url: v
            .get("html_url")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
    }
}

pub async fn repo_features(owner: &str, repo: &str) -> Result<RepoFeatures> {
    let raw: Value = get_json(&format!("/repos/{owner}/{repo}")).await?;
    Ok(map_repo_features(&raw))
}

fn map_issue(v: &Value) -> IssueSummary {
    IssueSummary {
        number: v.get("number").and_then(|x| x.as_u64()).unwrap_or(0),
        title: v.get("title").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        state: v.get("state").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        html_url: v.get("html_url").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        user_login: v.get("user").map(login).unwrap_or_default(),
        labels: labels(v),
        assignees: v
            .get("assignees")
            .and_then(|x| x.as_array())
            .map(|arr| arr.iter().map(login).collect())
            .unwrap_or_default(),
        milestone: v
            .get("milestone")
            .and_then(|m| m.get("title"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string()),
        pull_request: v.get("pull_request").is_some(),
    }
}

pub async fn list_pulls(owner: &str, repo: &str, filter: &str) -> Result<Vec<PullRequestSummary>> {
    let state = if filter == "closed" { "closed" } else { "open" };
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/pulls?state={state}&per_page=50&sort=updated"
    ))
    .await?;
    let me = auth::whoami().await.ok().flatten();
    let mut out: Vec<_> = raw.iter().map(map_pr).collect();
    if filter == "mine" {
        if let Some(user) = me.as_ref() {
            out.retain(|p| p.user_login == user.login);
        }
    } else if filter == "review" {
        if let Some(user) = me.as_ref() {
            out.retain(|p| p.requested_reviewers.iter().any(|r| r == &user.login));
        }
    } else if filter == "draft" {
        out.retain(|p| p.draft);
    }
    Ok(out)
}

pub async fn get_pull(owner: &str, repo: &str, number: u64) -> Result<PullRequestSummary> {
    let raw: Value = get_json(&format!("/repos/{owner}/{repo}/pulls/{number}")).await?;
    let mut pr = map_pr(&raw);
    if let Ok(status) = combined_status(owner, repo, &pr.head_sha).await {
        pr.ci_status = Some(status);
    }
    Ok(pr)
}

pub async fn create_pull(
    owner: &str,
    repo: &str,
    input: CreatePullRequest,
) -> Result<PullRequestSummary> {
    let res = request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/pulls"),
        Some(json!({
            "title": input.title,
            "body": input.body,
            "head": input.head,
            "base": input.base,
            "draft": input.draft,
        })),
    )
    .await?;
    Ok(map_pr(&res.json().await?))
}

pub async fn update_pull(
    owner: &str,
    repo: &str,
    number: u64,
    patch: Value,
) -> Result<PullRequestSummary> {
    let res = request(
        reqwest::Method::PATCH,
        &format!("/repos/{owner}/{repo}/pulls/{number}"),
        Some(patch),
    )
    .await?;
    Ok(map_pr(&res.json().await?))
}

pub async fn merge_pull(
    owner: &str,
    repo: &str,
    number: u64,
    method: &str,
) -> Result<PullRequestSummary> {
    let merge_method = match method {
        "squash" | "rebase" | "merge" => method,
        _ => "merge",
    };
    request(
        reqwest::Method::PUT,
        &format!("/repos/{owner}/{repo}/pulls/{number}/merge"),
        Some(json!({ "merge_method": merge_method })),
    )
    .await?;
    get_pull(owner, repo, number).await
}

pub async fn list_issues(owner: &str, repo: &str, filter: &str) -> Result<Vec<IssueSummary>> {
    let state = if filter == "closed" { "closed" } else { "open" };
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/issues?state={state}&per_page=50&sort=updated"
    ))
    .await?;
    let me = auth::whoami().await.ok().flatten();
    let mut out: Vec<_> = raw.iter().map(map_issue).filter(|i| !i.pull_request).collect();
    if filter == "assigned" {
        if let Some(user) = me.as_ref() {
            out.retain(|i| i.assignees.iter().any(|a| a == &user.login));
        }
    }
    Ok(out)
}

pub async fn create_issue(owner: &str, repo: &str, input: CreateIssue) -> Result<IssueSummary> {
    let res = request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/issues"),
        Some(json!({
            "title": input.title,
            "body": input.body,
            "labels": input.labels,
            "assignees": input.assignees,
        })),
    )
    .await?;
    Ok(map_issue(&res.json().await?))
}

pub async fn update_issue(
    owner: &str,
    repo: &str,
    number: u64,
    patch: Value,
) -> Result<IssueSummary> {
    let res = request(
        reqwest::Method::PATCH,
        &format!("/repos/{owner}/{repo}/issues/{number}"),
        Some(patch),
    )
    .await?;
    Ok(map_issue(&res.json().await?))
}

pub async fn list_issue_comments(
    owner: &str,
    repo: &str,
    number: u64,
) -> Result<Vec<IssueComment>> {
    let raw: Vec<Value> =
        get_json(&format!("/repos/{owner}/{repo}/issues/{number}/comments")).await?;
    Ok(raw
        .iter()
        .map(|v| IssueComment {
            id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
            user_login: v.get("user").map(login).unwrap_or_default(),
            body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            created_at: created_at(v),
        })
        .collect())
}

pub async fn add_issue_comment(
    owner: &str,
    repo: &str,
    number: u64,
    body: &str,
) -> Result<IssueComment> {
    let res = request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/issues/{number}/comments"),
        Some(json!({ "body": body })),
    )
    .await?;
    let v: Value = res.json().await?;
    Ok(IssueComment {
        id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
        user_login: v.get("user").map(login).unwrap_or_default(),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        created_at: created_at(&v),
    })
}

pub async fn list_releases(owner: &str, repo: &str) -> Result<Vec<ReleaseSummary>> {
    let raw: Vec<Value> = get_json(&format!("/repos/{owner}/{repo}/releases?per_page=30")).await?;
    Ok(raw.iter().map(map_release).collect())
}

fn map_release(v: &Value) -> ReleaseSummary {
    ReleaseSummary {
        id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
        tag_name: v.get("tag_name").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        name: v
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        draft: v.get("draft").and_then(|x| x.as_bool()).unwrap_or(false),
        prerelease: v.get("prerelease").and_then(|x| x.as_bool()).unwrap_or(false),
        html_url: v.get("html_url").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        published_at: v
            .get("published_at")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
    }
}

pub async fn create_release(
    owner: &str,
    repo: &str,
    input: CreateRelease,
) -> Result<ReleaseSummary> {
    let res = request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/releases"),
        Some(json!({
            "tag_name": input.tag_name,
            "name": input.name,
            "body": input.body,
            "draft": input.draft,
            "prerelease": input.prerelease,
        })),
    )
    .await?;
    Ok(map_release(&res.json().await?))
}

pub async fn update_release(
    owner: &str,
    repo: &str,
    id: u64,
    patch: Value,
) -> Result<ReleaseSummary> {
    let res = request(
        reqwest::Method::PATCH,
        &format!("/repos/{owner}/{repo}/releases/{id}"),
        Some(patch),
    )
    .await?;
    Ok(map_release(&res.json().await?))
}

pub async fn list_check_runs(
    owner: &str,
    repo: &str,
    sha: &str,
) -> Result<Vec<CheckRunSummary>> {
    let raw: Value = get_json(&format!(
        "/repos/{owner}/{repo}/commits/{sha}/check-runs"
    ))
    .await?;
    let runs = raw
        .get("check_runs")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(runs
        .iter()
        .map(|v| CheckRunSummary {
            id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
            name: v.get("name").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            status: v.get("status").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            conclusion: v
                .get("conclusion")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            html_url: v
                .get("html_url")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            head_sha: v
                .get("head_sha")
                .and_then(|x| x.as_str())
                .unwrap_or(sha)
                .to_string(),
        })
        .collect())
}

pub async fn combined_status(owner: &str, repo: &str, sha: &str) -> Result<String> {
    let runs = list_check_runs(owner, repo, sha).await?;
    if runs.is_empty() {
        return Ok("neutral".into());
    }
    if runs.iter().any(|r| r.conclusion.as_deref() == Some("failure")) {
        return Ok("failure".into());
    }
    if runs.iter().any(|r| r.status != "completed") {
        return Ok("pending".into());
    }
    if runs.iter().all(|r| {
        matches!(
            r.conclusion.as_deref(),
            Some("success") | Some("neutral") | Some("skipped")
        )
    }) {
        return Ok("success".into());
    }
    Ok("neutral".into())
}

pub async fn rerun_job(owner: &str, repo: &str, job_id: u64) -> Result<()> {
    request(
        reqwest::Method::POST,
        &format!("/repos/{owner}/{repo}/actions/jobs/{job_id}/rerun"),
        None,
    )
    .await?;
    Ok(())
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
        path: v.get("path").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        line: v.get("line").and_then(|x| x.as_u64()).map(|n| n as u32),
        original_line: v
            .get("original_line")
            .and_then(|x| x.as_u64())
            .map(|n| n as u32),
        side: v.get("side").and_then(|x| x.as_str()).map(|s| s.to_string()),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
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
    let message = commit
        .get("message")
        .and_then(|x| x.as_str())
        .unwrap_or("");
    let summary = message.lines().next().unwrap_or("").to_string();
    let sha = v.get("sha").and_then(|x| x.as_str()).unwrap_or("").to_string();
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
    PullCommit {
        sha: sha.clone(),
        short_id: sha.chars().take(7).collect(),
        summary,
        author,
        created_at: created,
    }
}

fn map_review(v: &Value) -> PullReview {
    PullReview {
        id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
        user_login: v.get("user").map(login).unwrap_or_default(),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        state: v.get("state").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        submitted_at: v
            .get("submitted_at")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
    }
}

pub async fn list_pull_commits(
    owner: &str,
    repo: &str,
    number: u64,
) -> Result<Vec<PullCommit>> {
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/pulls/{number}/commits?per_page=100"
    ))
    .await?;
    Ok(raw.iter().map(map_pull_commit).collect())
}

pub async fn list_reviews(owner: &str, repo: &str, number: u64) -> Result<Vec<PullReview>> {
    let raw: Vec<Value> =
        get_json(&format!("/repos/{owner}/{repo}/pulls/{number}/reviews?per_page=100")).await?;
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

pub async fn list_notifications() -> Result<Vec<NotificationItem>> {
    let raw: Vec<Value> = get_json("/notifications?per_page=30").await?;
    Ok(raw
        .iter()
        .map(|v| {
            let subject = v.get("subject").cloned().unwrap_or(json!({}));
            let repo = v.get("repository").cloned().unwrap_or(json!({}));
            NotificationItem {
                id: v.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                reason: v.get("reason").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                title: subject
                    .get("title")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
                repo: repo
                    .get("full_name")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
                kind: subject
                    .get("type")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
                unread: v.get("unread").and_then(|x| x.as_bool()).unwrap_or(false),
                updated_at: v
                    .get("updated_at")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
                url: subject
                    .get("url")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
            }
        })
        .collect())
}

pub async fn list_accessible_repos(query: &str) -> Result<Vec<RepoSearchHit>> {
    let q = if query.trim().is_empty() {
        "user:@me".into()
    } else {
        format!("{} in:name", query.trim())
    };
    let encoded = urlencoding_lite(&q);
    let raw: Value = get_json(&format!("/search/repositories?q={encoded}&per_page=20")).await?;
    let items = raw
        .get("items")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(items
        .iter()
        .map(|v| RepoSearchHit {
            full_name: v
                .get("full_name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            description: v
                .get("description")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            ssh_url: v
                .get("ssh_url")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            clone_url: v
                .get("clone_url")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            private: v.get("private").and_then(|x| x.as_bool()).unwrap_or(false),
        })
        .collect())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSearchHit {
    pub full_name: String,
    pub description: Option<String>,
    pub ssh_url: String,
    pub clone_url: String,
    pub private: bool,
}

fn urlencoding_lite(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_pull_request_payload() {
        let v = json!({
            "number": 12,
            "title": "Fix river",
            "body": "notes",
            "state": "open",
            "draft": true,
            "html_url": "https://github.com/acme/app/pull/12",
            "created_at": "2026-08-16T12:00:00Z",
            "user": { "login": "analyst" },
            "head": { "ref": "var-1", "sha": "abc" },
            "base": { "ref": "main", "sha": "def" },
            "labels": [{ "name": "bug" }],
            "requested_reviewers": [{ "login": "reviewer" }],
            "mergeable": true
        });
        let pr = map_pr(&v);
        assert_eq!(pr.number, 12);
        assert!(pr.draft);
        assert_eq!(pr.head_ref, "var-1");
        assert_eq!(pr.base_sha, "def");
        assert_eq!(pr.created_at, "2026-08-16T12:00:00Z");
        assert_eq!(pr.labels, vec!["bug"]);
    }

    #[test]
    fn maps_pull_commit_and_review() {
        let commit = map_pull_commit(&json!({
            "sha": "abcdef1234567890",
            "author": { "login": "analyst" },
            "commit": {
                "message": "Fix river\n\nKeep it gold.",
                "author": { "name": "Analyst", "date": "2026-08-16T13:00:00Z" }
            }
        }));
        assert_eq!(commit.short_id, "abcdef1");
        assert_eq!(commit.summary, "Fix river");
        assert_eq!(commit.author, "analyst");
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

    #[test]
    fn maps_issue_skips_pull_flag() {
        let v = json!({
            "number": 4,
            "title": "Incident",
            "body": "",
            "state": "open",
            "html_url": "https://github.com/acme/app/issues/4",
            "user": { "login": "analyst" },
            "labels": [],
            "assignees": [],
            "pull_request": { "url": "x" }
        });
        assert!(map_issue(&v).pull_request);
    }

    #[test]
    fn maps_repo_features_and_defaults_pulls_on() {
        let features = map_repo_features(&json!({
            "has_issues": false,
            "archived": false,
            "html_url": "https://github.com/acme/app"
        }));
        assert!(!features.has_issues);
        assert!(features.has_pull_requests);
        assert!(!features.archived);
        assert_eq!(features.html_url, "https://github.com/acme/app");
    }

    #[test]
    fn archived_repo_seals_issues_and_pulls() {
        let features = map_repo_features(&json!({
            "has_issues": true,
            "has_pull_requests": true,
            "archived": true,
            "html_url": "https://github.com/acme/app"
        }));
        assert!(!features.has_issues);
        assert!(!features.has_pull_requests);
        assert!(features.archived);
    }
}
