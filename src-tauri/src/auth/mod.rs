use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

const SERVICE: &str = "com.timestream.app";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForgeUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub emails: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionWrite {
    pub access: String,
    pub refresh: Option<String>,
    pub expires_at: Option<u64>,
}

fn session_cell() -> &'static Mutex<Option<SessionWrite>> {
    static SESSION: OnceLock<Mutex<Option<SessionWrite>>> = OnceLock::new();
    SESSION.get_or_init(|| Mutex::new(None))
}

fn session_lock() -> std::sync::MutexGuard<'static, Option<SessionWrite>> {
    session_cell()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn remember_session(session: SessionWrite) {
    *session_lock() = Some(session);
}

pub(crate) fn cached_session() -> Option<SessionWrite> {
    session_lock().clone()
}

pub(crate) fn clear_session_cache() {
    *session_lock() = None;
}

fn entry(account: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, account).map_err(|e| AppError::msg(e.to_string()))
}

pub(crate) fn store_secret(account: &str, value: &str) -> Result<()> {
    entry(account)?
        .set_password(value)
        .map_err(|e| AppError::msg(e.to_string()))
}

pub(crate) fn load_secret(account: &str) -> Result<Option<String>> {
    match entry(account)?.get_password() {
        Ok(value) if !value.is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

pub(crate) fn delete_secret(account: &str) -> Result<()> {
    match entry(account)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CredentialHost {
    GitHub,
    Unknown,
}

fn credential_host(host: &str) -> CredentialHost {
    match host
        .trim()
        .trim_end_matches('.')
        .to_ascii_lowercase()
        .as_str()
    {
        "github.com" | "gist.github.com" => CredentialHost::GitHub,
        _ => CredentialHost::Unknown,
    }
}

pub async fn credential_for(host: &str) -> Result<Option<String>> {
    match credential_host(host) {
        CredentialHost::GitHub => crate::github::auth::valid_token().await,
        CredentialHost::Unknown => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_for_github_hosts_uses_github_arm() {
        for host in ["github.com", "gist.github.com", "GitHub.COM", "github.com."] {
            assert_eq!(credential_host(host), CredentialHost::GitHub, "{host}");
        }
    }

    #[test]
    fn credential_for_ignores_unknown_hosts() {
        for host in ["gitlab.com", "", "github.example.com"] {
            assert_eq!(credential_host(host), CredentialHost::Unknown, "{host}");
        }
    }

    #[test]
    fn keyring_default_store_is_not_entry_only() {
        use keyring::credential::CredentialPersistence;
        let persistence = keyring::default::default_credential_builder().persistence();
        assert!(
            !matches!(persistence, CredentialPersistence::EntryOnly),
            "keyring fell back to the mock store; enable platform-native features"
        );
    }

    #[test]
    fn session_cache_roundtrip() {
        clear_session_cache();
        remember_session(SessionWrite {
            access: "ghu_cache".into(),
            refresh: Some("ghr_r".into()),
            expires_at: Some(29_800),
        });
        let cached = cached_session().unwrap();
        assert_eq!(cached.access, "ghu_cache");
        assert_eq!(cached.expires_at, Some(29_800));
        clear_session_cache();
        assert!(cached_session().is_none());
    }
}
