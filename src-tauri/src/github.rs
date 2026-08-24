use crate::error::{AppError, Result};
pub mod auth;
pub mod checks;
pub mod error;
pub mod issues;
pub mod notifications;
pub mod pulls;
pub mod releases;
pub mod reviews;
pub mod search;

use error as github_error;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const UA: &str = "timestream";

#[allow(unused_imports)]
pub use checks::{combined_status, list_check_runs, rerun_job, CheckRunSummary};
#[allow(unused_imports)]
pub use issues::{
    add_issue_comment, create_issue, list_issue_comments, list_issues, update_issue, CreateIssue,
    IssueComment, IssueSummary,
};
#[allow(unused_imports)]
pub use notifications::{list_notifications, NotificationItem};
#[allow(unused_imports)]
pub use pulls::{
    create_pull, get_pull, list_pull_counts, list_pulls, merge_pull, update_pull,
    CreatePullRequest, PullCounts, PullRequestSummary,
};
#[allow(unused_imports)]
pub use releases::{create_release, list_releases, update_release, CreateRelease, ReleaseSummary};
#[allow(unused_imports)]
pub use reviews::{
    list_pull_commits, list_review_comments, list_reviews, reply_review_comment, submit_review,
    PendingReviewComment, PullCommit, PullReview, ReviewComment, SubmitReview,
};
#[allow(unused_imports)]
pub use search::{list_accessible_repos, RepoSearchHit};

#[allow(unused_imports)]
pub use auth::DeviceLoginBegin;
pub use auth::{
    github_login_begin, github_login_pat, github_login_poll, github_logout, github_whoami,
};
pub use checks::{github_list_checks, github_rerun_job};
pub use issues::{
    github_add_issue_comment, github_create_issue, github_list_issue_comments, github_list_issues,
    github_update_issue,
};
pub use notifications::github_list_notifications;
pub use pulls::{
    github_create_pull, github_get_pull, github_list_pull_counts, github_list_pulls,
    github_merge_pull, github_update_pull,
};
pub use releases::{github_create_release, github_list_releases, github_update_release};
pub use reviews::{
    github_list_pull_commits, github_list_review_comments, github_list_reviews,
    github_reply_review_comment, github_submit_review,
};
pub use search::github_search_repos;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoFeatures {
    pub has_issues: bool,
    pub has_pull_requests: bool,
    pub archived: bool,
    pub html_url: String,
}

pub(crate) async fn token() -> Result<String> {
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
    req.send().await.map_err(github_error::transport_error)
}

fn api_error(status: reqwest::StatusCode, text: String) -> AppError {
    github_error::api_error(status, text)
}

pub(crate) async fn request(
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

pub(crate) async fn get_json<T: for<'de> Deserialize<'de>>(path: &str) -> Result<T> {
    Ok(request(reqwest::Method::GET, path, None)
        .await?
        .json()
        .await?)
}

fn graphql_errors(body: &Value) -> Option<String> {
    let errors = body.get("errors")?.as_array()?;
    if errors.is_empty() {
        return None;
    }
    let msg = errors
        .iter()
        .filter_map(|err| err.get("message").and_then(|m| m.as_str()))
        .collect::<Vec<_>>()
        .join("; ");
    Some(msg)
}

pub(crate) fn graphql_data(body: Value) -> Result<Value> {
    if let Some(msg) = graphql_errors(&body) {
        return Err(github_error::graphql_error(&msg));
    }
    body.get("data")
        .cloned()
        .ok_or_else(|| AppError::msg("GITHUB_DISPATCH: empty GraphQL data"))
}

pub(crate) async fn graphql(query: &str, variables: Value) -> Result<Value> {
    let res = request(
        reqwest::Method::POST,
        "/graphql",
        Some(json!({ "query": query, "variables": variables })),
    )
    .await?;
    graphql_data(res.json().await?)
}

pub(crate) fn login(v: &Value) -> String {
    v.get("login")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

pub(crate) fn labels(v: &Value) -> Vec<String> {
    v.get("labels")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|l| {
                    l.get("name")
                        .and_then(|n| n.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn created_at(v: &Value) -> String {
    v.get("created_at")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

fn map_repo_features(v: &Value) -> RepoFeatures {
    let archived = v.get("archived").and_then(|x| x.as_bool()).unwrap_or(false);
    let disabled = v.get("disabled").and_then(|x| x.as_bool()).unwrap_or(false);
    let sealed = archived || disabled;
    RepoFeatures {
        has_issues: !sealed
            && v.get("has_issues")
                .and_then(|x| x.as_bool())
                .unwrap_or(true),
        has_pull_requests: !sealed
            && v.get("has_pull_requests")
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

#[tauri::command]
pub async fn github_repo_features(owner: String, repo: String) -> Result<RepoFeatures> {
    repo_features(&owner, &repo).await
}

#[cfg(test)]
mod tests {
    use super::*;

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
