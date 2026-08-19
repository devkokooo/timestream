use crate::error::{AppError, Result};
use crate::github::{created_at, get_json, graphql, labels, login, request};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
pub struct CreatePullRequest {
    pub title: String,
    pub body: String,
    pub head: String,
    pub base: String,
    pub draft: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullCounts {
    pub open: u64,
    pub closed: u64,
}

fn pull_id_from_repo(data: &Value) -> Option<String> {
    data.pointer("/repository/pullRequest/id")
        .and_then(|v| v.as_str())
        .filter(|id| !id.is_empty())
        .map(|id| id.to_string())
}

fn pull_id_mutation(name: &str) -> String {
    format!(
        "mutation($id: ID!) {{ {name}(input: {{ pullRequestId: $id }}) {{ pullRequest {{ number }} }} }}"
    )
}

fn draft_mutation(draft: bool) -> &'static str {
    if draft {
        "convertPullRequestToDraft"
    } else {
        "markPullRequestReadyForReview"
    }
}

fn state_mutation(open: bool) -> &'static str {
    if open {
        "reopenPullRequest"
    } else {
        "closePullRequest"
    }
}

fn merge_method_enum(method: &str) -> &'static str {
    match method {
        "squash" => "SQUASH",
        "rebase" => "REBASE",
        _ => "MERGE",
    }
}

const PULL_ID_QUERY: &str = "query($owner: String!, $name: String!, $number: Int!) { \
    repository(owner: $owner, name: $name) { pullRequest(number: $number) { id } } }";

const MERGE_MUTATION: &str = "mutation($id: ID!, $method: PullRequestMergeMethod) { \
    mergePullRequest(input: { pullRequestId: $id, mergeMethod: $method }) { \
        pullRequest { number } } }";

const PULL_COUNTS_QUERY: &str = "query($owner: String!, $name: String!) { \
    repository(owner: $owner, name: $name) { \
        open: pullRequests(states: OPEN) { totalCount } \
        closed: pullRequests(states: [CLOSED, MERGED]) { totalCount } \
    } }";

async fn pull_node_id(owner: &str, repo: &str, number: u64) -> Result<String> {
    let data = graphql(
        PULL_ID_QUERY,
        json!({ "owner": owner, "name": repo, "number": number }),
    )
    .await?;
    pull_id_from_repo(&data)
        .ok_or_else(|| AppError::msg("GITHUB_NOT_FOUND: pull request not found"))
}

async fn mutate_pull(
    owner: &str,
    repo: &str,
    number: u64,
    query: &str,
    extra: Value,
) -> Result<()> {
    let id = pull_node_id(owner, repo, number).await?;
    let mut variables = extra;
    if let Some(obj) = variables.as_object_mut() {
        obj.insert("id".into(), json!(id));
    }
    graphql(query, variables).await?;
    Ok(())
}

fn map_pr(v: &Value) -> PullRequestSummary {
    let head = v.get("head").cloned().unwrap_or(json!({}));
    let base = v.get("base").cloned().unwrap_or(json!({}));
    PullRequestSummary {
        number: v.get("number").and_then(|x| x.as_u64()).unwrap_or(0),
        title: v
            .get("title")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
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
        draft: v.get("draft").and_then(|x| x.as_bool()).unwrap_or(false),
        html_url: v
            .get("html_url")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        head_ref: head
            .get("ref")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        head_sha: head
            .get("sha")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        base_ref: base
            .get("ref")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        base_sha: base
            .get("sha")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
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

fn map_pull_counts(data: &Value) -> PullCounts {
    let repo = data.get("repository");
    PullCounts {
        open: repo
            .and_then(|r| r.pointer("/open/totalCount"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
        closed: repo
            .and_then(|r| r.pointer("/closed/totalCount"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
    }
}

pub async fn list_pull_counts(owner: &str, repo: &str) -> Result<PullCounts> {
    let data = graphql(PULL_COUNTS_QUERY, json!({ "owner": owner, "name": repo })).await?;
    Ok(map_pull_counts(&data))
}

pub async fn list_pulls(owner: &str, repo: &str, filter: &str) -> Result<Vec<PullRequestSummary>> {
    let state = if filter == "closed" { "closed" } else { "open" };
    let raw: Vec<Value> = get_json(&format!(
        "/repos/{owner}/{repo}/pulls?state={state}&per_page=50&sort=updated"
    ))
    .await?;
    let me = crate::github::auth::whoami().await.ok().flatten();
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
    if let Ok(status) = crate::github::checks::combined_status(owner, repo, &pr.head_sha).await {
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

fn take_draft(patch: &mut Value) -> Option<bool> {
    patch
        .as_object_mut()
        .and_then(|obj| obj.remove("draft"))
        .and_then(|v| v.as_bool())
}

fn take_state(patch: &mut Value) -> Option<String> {
    patch
        .as_object_mut()
        .and_then(|obj| obj.remove("state"))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
}

fn pull_patch_has_fields(patch: &Value) -> bool {
    patch.as_object().is_some_and(|obj| !obj.is_empty())
}

pub async fn update_pull(
    owner: &str,
    repo: &str,
    number: u64,
    mut patch: Value,
) -> Result<PullRequestSummary> {
    // REST ready_for_review / convert_to_draft fail for GitHub App tokens.
    if let Some(draft) = take_draft(&mut patch) {
        mutate_pull(
            owner,
            repo,
            number,
            &pull_id_mutation(draft_mutation(draft)),
            json!({}),
        )
        .await?;
    }
    if let Some(state) = take_state(&mut patch) {
        mutate_pull(
            owner,
            repo,
            number,
            &pull_id_mutation(state_mutation(state == "open")),
            json!({}),
        )
        .await?;
    }
    if pull_patch_has_fields(&patch) {
        let res = request(
            reqwest::Method::PATCH,
            &format!("/repos/{owner}/{repo}/pulls/{number}"),
            Some(patch),
        )
        .await?;
        return Ok(map_pr(&res.json().await?));
    }
    get_pull(owner, repo, number).await
}

pub async fn merge_pull(
    owner: &str,
    repo: &str,
    number: u64,
    method: &str,
) -> Result<PullRequestSummary> {
    mutate_pull(
        owner,
        repo,
        number,
        MERGE_MUTATION,
        json!({ "method": merge_method_enum(method) }),
    )
    .await?;
    get_pull(owner, repo, number).await
}

#[tauri::command]
pub async fn github_list_pulls(
    owner: String,
    repo: String,
    filter: String,
) -> Result<Vec<PullRequestSummary>> {
    list_pulls(&owner, &repo, &filter).await
}

#[tauri::command]
pub async fn github_list_pull_counts(owner: String, repo: String) -> Result<PullCounts> {
    list_pull_counts(&owner, &repo).await
}

#[tauri::command]
pub async fn github_get_pull(
    owner: String,
    repo: String,
    number: u64,
) -> Result<PullRequestSummary> {
    get_pull(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_create_pull(
    owner: String,
    repo: String,
    input: CreatePullRequest,
) -> Result<PullRequestSummary> {
    create_pull(&owner, &repo, input).await
}

#[tauri::command]
pub async fn github_update_pull(
    owner: String,
    repo: String,
    number: u64,
    patch: Value,
) -> Result<PullRequestSummary> {
    update_pull(&owner, &repo, number, patch).await
}

#[tauri::command]
pub async fn github_merge_pull(
    owner: String,
    repo: String,
    number: u64,
    method: String,
) -> Result<PullRequestSummary> {
    merge_pull(&owner, &repo, number, &method).await
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
    fn pull_mutations_use_graphql() {
        let mut patch = json!({ "draft": true, "state": "closed" });
        assert_eq!(take_draft(&mut patch), Some(true));
        assert_eq!(take_state(&mut patch).as_deref(), Some("closed"));
        assert!(!pull_patch_has_fields(&patch));
        assert_eq!(draft_mutation(true), "convertPullRequestToDraft");
        assert_eq!(draft_mutation(false), "markPullRequestReadyForReview");
        assert_eq!(state_mutation(false), "closePullRequest");
        assert_eq!(state_mutation(true), "reopenPullRequest");
        assert_eq!(merge_method_enum("squash"), "SQUASH");
        assert_eq!(merge_method_enum("rebase"), "REBASE");
        assert_eq!(merge_method_enum("merge"), "MERGE");
        assert!(pull_id_mutation("markPullRequestReadyForReview")
            .contains("markPullRequestReadyForReview"));

        let data = json!({ "repository": { "pullRequest": { "id": "PR_kwDO" } } });
        assert_eq!(pull_id_from_repo(&data).as_deref(), Some("PR_kwDO"));
        let denied = crate::github::graphql_data(json!({
            "errors": [{ "message": "Resource not accessible by integration" }]
        }));
        assert_eq!(
            denied.unwrap_err().to_string(),
            "GITHUB_FORBIDDEN: Resource not accessible by integration"
        );
    }

    #[test]
    fn maps_pull_counts_from_graphql() {
        let counts = map_pull_counts(&json!({
            "repository": {
                "open": { "totalCount": 12 },
                "closed": { "totalCount": 340 }
            }
        }));
        assert_eq!(counts.open, 12);
        assert_eq!(counts.closed, 340);
        assert_eq!(map_pull_counts(&json!({})).open, 0);
    }
}
