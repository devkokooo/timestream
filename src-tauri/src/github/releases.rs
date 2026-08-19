use crate::error::Result;
use crate::github::{get_json, request};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
pub struct CreateRelease {
    pub tag_name: String,
    pub name: String,
    pub body: String,
    pub draft: bool,
    pub prerelease: bool,
}

fn map_release(v: &Value) -> ReleaseSummary {
    ReleaseSummary {
        id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
        tag_name: v
            .get("tag_name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        name: v
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        body: v
            .get("body")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        draft: v.get("draft").and_then(|x| x.as_bool()).unwrap_or(false),
        prerelease: v
            .get("prerelease")
            .and_then(|x| x.as_bool())
            .unwrap_or(false),
        html_url: v
            .get("html_url")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        published_at: v
            .get("published_at")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
    }
}

pub async fn list_releases(owner: &str, repo: &str) -> Result<Vec<ReleaseSummary>> {
    let raw: Vec<Value> = get_json(&format!("/repos/{owner}/{repo}/releases?per_page=30")).await?;
    Ok(raw.iter().map(map_release).collect())
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

#[tauri::command]
pub async fn github_list_releases(owner: String, repo: String) -> Result<Vec<ReleaseSummary>> {
    list_releases(&owner, &repo).await
}

#[tauri::command]
pub async fn github_create_release(
    owner: String,
    repo: String,
    input: CreateRelease,
) -> Result<ReleaseSummary> {
    create_release(&owner, &repo, input).await
}

#[tauri::command]
pub async fn github_update_release(
    owner: String,
    repo: String,
    id: u64,
    patch: Value,
) -> Result<ReleaseSummary> {
    update_release(&owner, &repo, id, patch).await
}
