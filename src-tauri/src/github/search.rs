use crate::error::Result;
use crate::github::get_json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSearchHit {
    pub full_name: String,
    pub description: Option<String>,
    pub ssh_url: String,
    pub clone_url: String,
    pub private: bool,
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

#[tauri::command]
pub async fn github_search_repos(query: String) -> Result<Vec<RepoSearchHit>> {
    list_accessible_repos(&query).await
}
