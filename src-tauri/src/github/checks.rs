use crate::error::Result;
use crate::github::{get_json, request};
use serde::{Deserialize, Serialize};
use serde_json::Value;

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

pub async fn list_check_runs(owner: &str, repo: &str, sha: &str) -> Result<Vec<CheckRunSummary>> {
    let raw: Value = get_json(&format!("/repos/{owner}/{repo}/commits/{sha}/check-runs")).await?;
    let runs = raw
        .get("check_runs")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(runs
        .iter()
        .map(|v| CheckRunSummary {
            id: v.get("id").and_then(|x| x.as_u64()).unwrap_or(0),
            name: v
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            status: v
                .get("status")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
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
    if runs
        .iter()
        .any(|r| r.conclusion.as_deref() == Some("failure"))
    {
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

#[tauri::command]
pub async fn github_list_checks(
    owner: String,
    repo: String,
    sha: String,
) -> Result<Vec<CheckRunSummary>> {
    list_check_runs(&owner, &repo, &sha).await
}

#[tauri::command]
pub async fn github_rerun_job(owner: String, repo: String, job_id: u64) -> Result<()> {
    rerun_job(&owner, &repo, job_id).await
}
