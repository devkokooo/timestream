use crate::error::Result;
use crate::github::get_json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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

pub async fn list_notifications() -> Result<Vec<NotificationItem>> {
    let raw: Vec<Value> = get_json("/notifications?per_page=30").await?;
    Ok(raw
        .iter()
        .map(|v| {
            let subject = v.get("subject").cloned().unwrap_or(json!({}));
            let repo = v.get("repository").cloned().unwrap_or(json!({}));
            NotificationItem {
                id: v
                    .get("id")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
                reason: v
                    .get("reason")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
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

#[tauri::command]
pub async fn github_list_notifications() -> Result<Vec<NotificationItem>> {
    list_notifications().await
}
