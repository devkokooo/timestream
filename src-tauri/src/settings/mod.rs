use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const SETTINGS_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub version: u32,
    #[serde(default)]
    pub github: GithubSettings,
    #[serde(default)]
    pub ssh: SshSettings,
    #[serde(default)]
    pub timeline: TimelineSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GithubSettings {
    #[serde(default = "default_clone_protocol", alias = "clone_protocol")]
    pub clone_protocol: String,
}

fn default_clone_protocol() -> String {
    "https".into()
}

impl Default for GithubSettings {
    fn default() -> Self {
        Self {
            clone_protocol: default_clone_protocol(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SshSettings {
    #[serde(default = "default_true", alias = "agent_autostart")]
    pub agent_autostart: bool,
    #[serde(default, alias = "default_key")]
    pub default_key: Option<String>,
    #[serde(default)]
    pub bindings: Vec<SshBinding>,
    #[serde(default)]
    pub identities: Vec<SshIdentity>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SshBinding {
    pub repo: String,
    pub remote: String,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SshIdentity {
    pub path: String,
    #[serde(default)]
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true", alias = "show_upstream_refs")]
    pub show_upstream_refs: bool,
}

impl Default for TimelineSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            show_upstream_refs: true,
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            github: GithubSettings::default(),
            ssh: SshSettings {
                agent_autostart: true,
                ..SshSettings::default()
            },
            timeline: TimelineSettings::default(),
        }
    }
}

impl AppSettings {
    pub fn migrate(mut self) -> Self {
        if self.version < 1 {
            self.version = 1;
        }
        if self.github.clone_protocol.is_empty() {
            self.github.clone_protocol = default_clone_protocol();
        }
        self.version = SETTINGS_VERSION;
        self
    }

    pub fn resolve_ssh_key(&self, repo: &str, remote: &str) -> Option<String> {
        let repo_norm = normalize_path(repo);
        self.ssh
            .bindings
            .iter()
            .find(|b| normalize_path(&b.repo) == repo_norm && b.remote == remote)
            .map(|b| b.key.clone())
            .or_else(|| self.ssh.default_key.clone())
    }
}

pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

pub fn looks_like_secret(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    for needle in [
        "token",
        "passphrase",
        "password",
        "client_secret",
        "gho_",
        "ghp_",
        "github_pat_",
        "-----begin",
    ] {
        if lower.contains(needle) {
            return true;
        }
    }
    false
}

pub fn settings_file(config_dir: &Path) -> PathBuf {
    config_dir.join("settings.toml")
}

pub fn load_from_path(path: &Path) -> Result<AppSettings> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let text = fs::read_to_string(path)?;
    if looks_like_secret(&text) {
        return Err(AppError::msg(
            "settings.toml must not contain tokens, passphrases, or private keys",
        ));
    }
    let parsed: AppSettings = toml::from_str(&text)?;
    Ok(parsed.migrate())
}

pub fn save_to_path(path: &Path, settings: &AppSettings) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut doc = if path.exists() {
        fs::read_to_string(path)?
            .parse::<toml_edit::DocumentMut>()
            .map_err(|e| AppError::msg(e.to_string()))?
    } else {
        toml_edit::DocumentMut::new()
    };
    apply_known(&mut doc, settings);
    let rendered = doc.to_string();
    if looks_like_secret(&rendered) {
        return Err(AppError::msg(
            "refusing to write secrets into settings.toml",
        ));
    }
    fs::write(path, rendered)?;
    Ok(())
}

fn apply_known(doc: &mut toml_edit::DocumentMut, settings: &AppSettings) {
    doc["version"] = toml_edit::value(settings.version as i64);
    doc["github"]["clone_protocol"] = toml_edit::value(settings.github.clone_protocol.as_str());
    doc["ssh"]["agent_autostart"] = toml_edit::value(settings.ssh.agent_autostart);
    match &settings.ssh.default_key {
        Some(key) => doc["ssh"]["default_key"] = toml_edit::value(key.as_str()),
        None => {
            if let Some(ssh) = doc.get_mut("ssh").and_then(|i| i.as_table_mut()) {
                ssh.remove("default_key");
            }
        }
    }
    doc["ssh"]["bindings"] = bindings_array(&settings.ssh.bindings);
    doc["ssh"]["identities"] = identities_array(&settings.ssh.identities);
    doc["timeline"]["enabled"] = toml_edit::value(settings.timeline.enabled);
    doc["timeline"]["show_upstream_refs"] = toml_edit::value(settings.timeline.show_upstream_refs);
}

fn bindings_array(bindings: &[SshBinding]) -> toml_edit::Item {
    let mut arr = toml_edit::ArrayOfTables::new();
    for b in bindings {
        let mut table = toml_edit::Table::new();
        table["repo"] = toml_edit::value(b.repo.as_str());
        table["remote"] = toml_edit::value(b.remote.as_str());
        table["key"] = toml_edit::value(b.key.as_str());
        arr.push(table);
    }
    toml_edit::Item::ArrayOfTables(arr)
}

fn identities_array(identities: &[SshIdentity]) -> toml_edit::Item {
    let mut arr = toml_edit::ArrayOfTables::new();
    for id in identities {
        let mut table = toml_edit::Table::new();
        table["path"] = toml_edit::value(id.path.as_str());
        table["label"] = toml_edit::value(id.label.as_str());
        arr.push(table);
    }
    toml_edit::Item::ArrayOfTables(arr)
}

pub fn config_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::msg(e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn settings_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(settings_file(&config_dir(app)?))
}

pub fn load_app_settings(app: &AppHandle) -> Result<AppSettings> {
    load_from_path(&settings_path(app)?)
}

pub fn save_app_settings(app: &AppHandle, settings: &AppSettings) -> Result<()> {
    save_to_path(&settings_path(app)?, settings)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings> {
    load_app_settings(&app)
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings> {
    let migrated = settings.migrate();
    save_app_settings(&app, &migrated)?;
    Ok(migrated)
}

#[tauri::command]
pub fn settings_toml_path(app: AppHandle) -> Result<String> {
    Ok(settings_path(&app)?.to_string_lossy().replace('\\', "/"))
}

pub fn bind_ssh_key(settings: &mut AppSettings, repo: &str, remote: &str, key: &str) {
    if let Some(existing) = settings
        .ssh
        .bindings
        .iter_mut()
        .find(|b| normalize_path(&b.repo) == normalize_path(repo) && b.remote == remote)
    {
        existing.key = key.to_string();
        return;
    }
    settings.ssh.bindings.push(SshBinding {
        repo: repo.replace('\\', "/"),
        remote: remote.to_string(),
        key: key.to_string(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn default_has_schema_version() {
        let s = AppSettings::default();
        assert_eq!(s.version, SETTINGS_VERSION);
        assert!(s.timeline.enabled);
        assert!(s.timeline.show_upstream_refs);
        assert_eq!(s.github.clone_protocol, "https");
    }

    #[test]
    fn missing_timeline_enabled_defaults_on() {
        let raw = r#"
version = 1
[timeline]
show_upstream_refs = false
"#;
        let parsed: AppSettings = toml::from_str(raw).unwrap();
        let migrated = parsed.migrate();
        assert!(migrated.timeline.enabled);
        assert!(!migrated.timeline.show_upstream_refs);
    }

    #[test]
    fn migrate_bumps_old_version() {
        let raw = r#"
version = 0
[github]
clone_protocol = "ssh"
"#;
        let parsed: AppSettings = toml::from_str(raw).unwrap();
        let migrated = parsed.migrate();
        assert_eq!(migrated.version, SETTINGS_VERSION);
        assert_eq!(migrated.github.clone_protocol, "ssh");
    }

    #[test]
    fn rejects_secrets_on_load() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.toml");
        fs::write(&path, "version = 1\ntoken = \"ghp_secret\"\n").unwrap();
        assert!(load_from_path(&path).is_err());
    }

    #[test]
    fn round_trip_preserves_unknown_keys() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.toml");
        fs::write(
            &path,
            r#"
version = 1
experimental_flag = true

[github]
clone_protocol = "https"
custom_note = "keep me"

[ssh]
agent_autostart = true
"#,
        )
        .unwrap();
        let mut settings = load_from_path(&path).unwrap();
        settings.github.clone_protocol = "ssh".into();
        save_to_path(&path, &settings).unwrap();
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.contains("experimental_flag = true"));
        assert!(text.contains("custom_note"));
        assert!(text.contains("clone_protocol = \"ssh\""));
        assert!(!looks_like_secret(&text));
    }

    #[test]
    fn serialized_settings_never_include_secrets() {
        let settings = AppSettings::default();
        let text = toml::to_string(&settings).unwrap();
        assert!(!looks_like_secret(&text));
        assert!(!text.to_ascii_lowercase().contains("token"));
        assert!(!text.to_ascii_lowercase().contains("passphrase"));
    }

    #[test]
    fn resolve_prefers_repo_binding() {
        let mut settings = AppSettings::default();
        settings.ssh.default_key = Some("/home/.ssh/id_default".into());
        bind_ssh_key(&mut settings, r"C:\work\repo", "origin", "/home/.ssh/work");
        assert_eq!(
            settings
                .resolve_ssh_key("C:/work/repo", "origin")
                .as_deref(),
            Some("/home/.ssh/work")
        );
        assert_eq!(
            settings.resolve_ssh_key("C:/other", "origin").as_deref(),
            Some("/home/.ssh/id_default")
        );
    }
}
