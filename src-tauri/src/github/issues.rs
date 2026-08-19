use crate::error::Result;
use crate::github::{created_at, get_json, labels, login, request};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
    pub created_at: String,
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
pub struct CreateIssue {
    pub title: String,
    pub body: String,
    pub labels: Vec<String>,
    pub assignees: Vec<String>,
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
        created_at: created_at(v),
    }
}

pub async fn list_issues(owner: &str, repo: &str, filter: &str) -> Result<Vec<IssueSummary>> {
    let state = if filter == "closed" { "closed" } else { "open" };
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/issues?state={state}&per_page=50&sort=updated"
    ))
    .await?;
    let me = crate::github::auth::whoami().await.ok().flatten();
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

#[tauri::command]
pub async fn github_list_issues(
    owner: String,
    repo: String,
    filter: String,
) -> Result<Vec<IssueSummary>> {
    list_issues(&owner, &repo, &filter).await
}

#[tauri::command]
pub async fn github_create_issue(
    owner: String,
    repo: String,
    input: CreateIssue,
) -> Result<IssueSummary> {
    create_issue(&owner, &repo, input).await
}

#[tauri::command]
pub async fn github_update_issue(
    owner: String,
    repo: String,
    number: u64,
    patch: Value,
) -> Result<IssueSummary> {
    update_issue(&owner, &repo, number, patch).await
}

#[tauri::command]
pub async fn github_list_issue_comments(
    owner: String,
    repo: String,
    number: u64,
) -> Result<Vec<IssueComment>> {
    list_issue_comments(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_add_issue_comment(
    owner: String,
    repo: String,
    number: u64,
    body: String,
) -> Result<IssueComment> {
    add_issue_comment(&owner, &repo, number, &body).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
            "created_at": "2026-08-16T10:00:00Z",
            "pull_request": { "url": "x" }
        });
        let issue = map_issue(&v);
        assert!(issue.pull_request);
        assert_eq!(issue.created_at, "2026-08-16T10:00:00Z");
    }
}
