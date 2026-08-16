use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const SERVICE: &str = "com.timestream.app";
const TOKEN_ACCOUNT: &str = "github-token";
const REFRESH_ACCOUNT: &str = "github-refresh";
const EXPIRES_ACCOUNT: &str = "github-token-expires";
const EXPIRY_SKEW_SECS: u64 = 60;
const UA: &str = "timestream";
const GITHUB_CLIENT_ID: &str = match option_env!("TIMESTREAM_GITHUB_CLIENT_ID") {
    Some(id) => id,
    None => "Iv23li60zI49wsjeVxBJ",
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceLoginBegin {
    pub user_code: String,
    pub verification_uri: String,
    pub device_code: String,
    pub interval: u64,
    pub expires_in: u64,
    pub client_id_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub emails: Vec<String>,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    #[allow(dead_code)]
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

/// GitHub `/user` JSON is snake_case; `GithubUser` is camelCase for IPC.
#[derive(Deserialize)]
struct GithubApiUser {
    login: String,
    name: Option<String>,
    avatar_url: String,
    #[serde(default)]
    email: Option<String>,
}

#[derive(Deserialize)]
struct GithubApiEmail {
    email: String,
}

impl From<GithubApiUser> for GithubUser {
    fn from(user: GithubApiUser) -> Self {
        github_user_from_api(user, &[])
    }
}

fn merge_identity_emails(primary: Option<&str>, extra: &[String]) -> (Option<String>, Vec<String>) {
    let mut emails = Vec::new();
    let mut push = |raw: &str| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return;
        }
        if !emails.iter().any(|e: &String| e.eq_ignore_ascii_case(trimmed)) {
            emails.push(trimmed.to_string());
        }
    };
    if let Some(primary) = primary {
        push(primary);
    }
    for email in extra {
        push(email);
    }
    (emails.first().cloned(), emails)
}

fn github_user_from_api(user: GithubApiUser, extra: &[String]) -> GithubUser {
    let (email, emails) = merge_identity_emails(user.email.as_deref(), extra);
    GithubUser {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        email,
        emails,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SessionWrite {
    access: String,
    refresh: Option<String>,
    expires_at: Option<u64>,
}

#[allow(dead_code)]
pub fn client_id_configured() -> bool {
    !GITHUB_CLIENT_ID.is_empty()
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

fn remember_session(session: SessionWrite) {
    *session_lock() = Some(session);
}

fn cached_session() -> Option<SessionWrite> {
    session_lock().clone()
}

fn clear_session_cache() {
    *session_lock() = None;
}

pub fn store_token(token: &str) -> Result<()> {
    store_secret(TOKEN_ACCOUNT, token)
}

pub fn load_token() -> Result<Option<String>> {
    if let Some(session) = cached_session() {
        return Ok(Some(session.access));
    }
    let Some(access) = load_secret(TOKEN_ACCOUNT)? else {
        return Ok(None);
    };
    remember_session(SessionWrite {
        access: access.clone(),
        refresh: load_secret(REFRESH_ACCOUNT)?,
        expires_at: load_secret(EXPIRES_ACCOUNT)?.and_then(|raw| raw.parse().ok()),
    });
    Ok(Some(access))
}

pub fn delete_token() -> Result<()> {
    delete_secret(TOKEN_ACCOUNT)
}

pub fn store_passphrase(key_path: &str, passphrase: &str) -> Result<()> {
    store_secret(&pass_account(key_path), passphrase)
}

pub fn load_passphrase(key_path: &str) -> Result<Option<String>> {
    load_secret(&pass_account(key_path))
}

#[allow(dead_code)]
pub fn delete_passphrase(key_path: &str) -> Result<()> {
    delete_secret(&pass_account(key_path))
}

fn pass_account(key_path: &str) -> String {
    format!("ssh-pass:{}", key_path.replace('\\', "/"))
}

fn entry(account: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, account).map_err(|e| AppError::msg(e.to_string()))
}

fn store_secret(account: &str, value: &str) -> Result<()> {
    entry(account)?
        .set_password(value)
        .map_err(|e| AppError::msg(e.to_string()))
}

fn load_secret(account: &str) -> Result<Option<String>> {
    match entry(account)?.get_password() {
        Ok(value) if !value.is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

fn delete_secret(account: &str) -> Result<()> {
    match entry(account)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn session_from_app_token(
    access: &str,
    refresh: Option<&str>,
    expires_in: Option<u64>,
    now: u64,
) -> SessionWrite {
    SessionWrite {
        access: access.to_string(),
        refresh: refresh
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        expires_at: expires_in.filter(|secs| *secs > 0).map(|secs| now.saturating_add(secs)),
    }
}

fn session_from_pat(token: &str) -> SessionWrite {
    SessionWrite {
        access: token.to_string(),
        refresh: None,
        expires_at: None,
    }
}

fn token_is_expired(expires_at: Option<u64>, now: u64, skew: u64) -> bool {
    match expires_at {
        Some(at) => now.saturating_add(skew) >= at,
        None => false,
    }
}

fn persist_session(session: &SessionWrite) -> Result<()> {
    remember_session(session.clone());
    store_token(&session.access)?;
    match session.refresh.as_deref() {
        Some(refresh) => store_secret(REFRESH_ACCOUNT, refresh)?,
        None => delete_secret(REFRESH_ACCOUNT)?,
    }
    match session.expires_at {
        Some(at) => store_secret(EXPIRES_ACCOUNT, &at.to_string())?,
        None => delete_secret(EXPIRES_ACCOUNT)?,
    }
    Ok(())
}

fn stored_expires_at() -> Result<Option<u64>> {
    if let Some(session) = cached_session() {
        return Ok(session.expires_at);
    }
    let Some(raw) = load_secret(EXPIRES_ACCOUNT)? else {
        return Ok(None);
    };
    Ok(raw.parse().ok())
}

fn token_expires_soon() -> Result<bool> {
    Ok(token_is_expired(
        stored_expires_at()?,
        now_unix(),
        EXPIRY_SKEW_SECS,
    ))
}

fn explain_oauth_error(error: &str, description: Option<&str>) -> String {
    match error {
        "device_flow_disabled" => {
            "Device Flow is disabled on this GitHub App. In the app settings, enable Device Authorization Grant, save, then try again.".into()
        }
        other => match description.filter(|text| !text.is_empty()) {
            Some(desc) => format!("GitHub login failed: {other} ({desc})"),
            None => format!("GitHub login failed: {other}"),
        },
    }
}

fn oauth_http_error(status: reqwest::StatusCode, text: &str) -> AppError {
    if let Ok(body) = serde_json::from_str::<AccessTokenResponse>(text) {
        if let Some(code) = body.error.as_deref() {
            return AppError::msg(explain_oauth_error(
                code,
                body.error_description.as_deref(),
            ));
        }
    }
    AppError::msg(format!("GitHub login failed ({status}): {text}"))
}

async fn post_oauth_form(url: &str, form: &[(&str, &str)]) -> Result<String> {
    let client = reqwest::Client::new();
    let res = client
        .post(url)
        .header("Accept", "application/json")
        .header("User-Agent", UA)
        .form(form)
        .send()
        .await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(oauth_http_error(status, &text));
    }
    Ok(text)
}

pub async fn login_begin() -> Result<DeviceLoginBegin> {
    if GITHUB_CLIENT_ID.is_empty() {
        return Ok(DeviceLoginBegin {
            user_code: String::new(),
            verification_uri: "https://github.com/login/device".into(),
            device_code: String::new(),
            interval: 5,
            expires_in: 0,
            client_id_configured: false,
        });
    }
    let text = post_oauth_form(
        "https://github.com/login/device/code",
        &[("client_id", GITHUB_CLIENT_ID)],
    )
    .await?;
    let res: DeviceCodeResponse = serde_json::from_str(&text)?;
    Ok(DeviceLoginBegin {
        user_code: res.user_code,
        verification_uri: res.verification_uri,
        device_code: res.device_code,
        interval: res.interval.max(5),
        expires_in: res.expires_in,
        client_id_configured: true,
    })
}

pub async fn login_poll(device_code: &str) -> Result<Option<GithubUser>> {
    if GITHUB_CLIENT_ID.is_empty() {
        return Err(AppError::msg(
            "GitHub App client id is not configured. Use a personal access token instead.",
        ));
    }
    let text = post_oauth_form(
        "https://github.com/login/oauth/access_token",
        &[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ],
    )
    .await?;
    let res: AccessTokenResponse = serde_json::from_str(&text)?;
    if let Some(err) = res.error.as_deref() {
        if err == "authorization_pending" || err == "slow_down" {
            return Ok(None);
        }
        return Err(AppError::msg(format!("GitHub login failed: {err}")));
    }
    let Some(token) = res.access_token.as_deref() else {
        return Ok(None);
    };
    persist_session(&session_from_app_token(
        token,
        res.refresh_token.as_deref(),
        res.expires_in,
        now_unix(),
    ))?;
    Ok(Some(whoami_with(token).await?))
}

pub async fn login_pat(token: &str) -> Result<GithubUser> {
    let token = token.trim();
    if token.is_empty() {
        return Err(AppError::msg("a GitHub token is required"));
    }
    let user = whoami_with(token).await?;
    persist_session(&session_from_pat(token))?;
    Ok(user)
}

pub async fn valid_token() -> Result<Option<String>> {
    let Some(token) = load_token()? else {
        return Ok(None);
    };
    if !token_expires_soon()? {
        return Ok(Some(token));
    }
    match refresh_access_token().await {
        Ok(Some(next)) => Ok(Some(next)),
        Ok(None) | Err(_) => Ok(Some(token)),
    }
}

pub async fn refresh_access_token() -> Result<Option<String>> {
    if GITHUB_CLIENT_ID.is_empty() {
        return Ok(None);
    }
    let Some(refresh) = cached_session()
        .and_then(|session| session.refresh)
        .or(load_secret(REFRESH_ACCOUNT)?)
    else {
        return Ok(None);
    };
    let text = post_oauth_form(
        "https://github.com/login/oauth/access_token",
        &[
            ("client_id", GITHUB_CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh.as_str()),
        ],
    )
    .await?;
    let res: AccessTokenResponse = serde_json::from_str(&text)?;
    if let Some(err) = res.error.as_deref() {
        if err == "bad_refresh_token" {
            delete_secret(REFRESH_ACCOUNT)?;
            delete_secret(EXPIRES_ACCOUNT)?;
        }
        return Err(AppError::msg(format!("GitHub token refresh failed: {err}")));
    }
    let Some(token) = res.access_token.as_deref() else {
        return Ok(None);
    };
    persist_session(&session_from_app_token(
        token,
        res.refresh_token.as_deref().or(Some(refresh.as_str())),
        res.expires_in,
        now_unix(),
    ))?;
    Ok(Some(token.to_string()))
}

pub async fn whoami() -> Result<Option<GithubUser>> {
    let Some(token) = valid_token().await? else {
        return Ok(None);
    };
    match whoami_with(&token).await {
        Ok(user) => Ok(Some(user)),
        Err(_) => match refresh_access_token().await {
            Ok(Some(next)) => match whoami_with(&next).await {
                Ok(user) => Ok(Some(user)),
                Err(_) => Ok(None),
            },
            _ => Ok(None),
        },
    }
}

async fn github_authed_get(
    client: &reqwest::Client,
    token: &str,
    url: &str,
) -> Result<reqwest::Response> {
    Ok(client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", UA)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await?)
}

async fn list_user_emails(client: &reqwest::Client, token: &str) -> Vec<String> {
    let Ok(res) = github_authed_get(client, token, "https://api.github.com/user/emails").await else {
        return Vec::new();
    };
    if !res.status().is_success() {
        return Vec::new();
    }
    let Ok(rows) = res.json::<Vec<GithubApiEmail>>().await else {
        return Vec::new();
    };
    rows.into_iter()
        .map(|row| row.email)
        .filter(|email| !email.is_empty())
        .collect()
}

pub async fn whoami_with(token: &str) -> Result<GithubUser> {
    let client = reqwest::Client::new();
    let res = github_authed_get(&client, token, "https://api.github.com/user").await?;
    if !res.status().is_success() {
        return Err(AppError::msg(format!(
            "GitHub rejected credentials ({})",
            res.status()
        )));
    }
    let user: GithubApiUser = res.json().await?;
    let extra = list_user_emails(&client, token).await;
    Ok(github_user_from_api(user, &extra))
}

pub fn logout() -> Result<()> {
    clear_session_cache();
    delete_token()?;
    delete_secret(REFRESH_ACCOUNT)?;
    delete_secret(EXPIRES_ACCOUNT)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passphrase_account_is_stable() {
        assert_eq!(
            pass_account(r"C:\Users\DevKoko\.ssh\id_ed25519"),
            "ssh-pass:C:/Users/DevKoko/.ssh/id_ed25519"
        );
    }

    #[test]
    fn client_id_flag_matches_env() {
        assert_eq!(client_id_configured(), !GITHUB_CLIENT_ID.is_empty());
    }

    #[test]
    fn github_user_decodes_snake_case_api_json() {
        let user: GithubUser = serde_json::from_str::<GithubApiUser>(
            r#"{
                "login": "octocat",
                "name": "The Octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "email": "octocat@github.com"
            }"#,
        )
        .unwrap()
        .into();
        assert_eq!(user.login, "octocat");
        assert_eq!(user.name.as_deref(), Some("The Octocat"));
        assert_eq!(user.avatar_url, "https://avatars.githubusercontent.com/u/1");
        assert_eq!(user.email.as_deref(), Some("octocat@github.com"));
        assert_eq!(user.emails, vec!["octocat@github.com"]);
        let ipc = serde_json::to_value(&user).unwrap();
        assert_eq!(ipc["avatarUrl"], "https://avatars.githubusercontent.com/u/1");
        assert_eq!(ipc["emails"], serde_json::json!(["octocat@github.com"]));
        assert!(ipc.get("avatar_url").is_none());
    }

    #[test]
    fn github_user_allows_null_name() {
        let user: GithubUser = serde_json::from_str::<GithubApiUser>(
            r#"{"login":"octocat","name":null,"avatar_url":"https://example.com/a.png"}"#,
        )
        .unwrap()
        .into();
        assert!(user.name.is_none());
        assert!(user.email.is_none());
        assert!(user.emails.is_empty());
    }

    #[test]
    fn merge_identity_emails_dedupes_case() {
        let (primary, emails) = merge_identity_emails(
            Some("Analyst@tva.local"),
            &["analyst@tva.local".into(), "noreply@users.noreply.github.com".into()],
        );
        assert_eq!(primary.as_deref(), Some("Analyst@tva.local"));
        assert_eq!(
            emails,
            vec!["Analyst@tva.local", "noreply@users.noreply.github.com"]
        );
    }

    #[test]
    fn access_token_decodes_refresh_and_empty_scope() {
        let res: AccessTokenResponse = serde_json::from_str(
            r#"{
                "access_token": "ghu_access",
                "refresh_token": "ghr_refresh",
                "expires_in": 28800,
                "refresh_token_expires_in": 15897600,
                "scope": "",
                "token_type": "bearer"
            }"#,
        )
        .unwrap();
        assert_eq!(res.access_token.as_deref(), Some("ghu_access"));
        assert_eq!(res.refresh_token.as_deref(), Some("ghr_refresh"));
        assert_eq!(res.expires_in, Some(28800));
        assert_eq!(res.scope.as_deref(), Some(""));
        assert!(res.error.is_none());
    }

    #[test]
    fn access_token_decodes_pending_error() {
        let res: AccessTokenResponse = serde_json::from_str(
            r#"{"error":"authorization_pending","error_description":"waiting"}"#,
        )
        .unwrap();
        assert!(res.access_token.is_none());
        assert_eq!(res.error.as_deref(), Some("authorization_pending"));
    }

    #[test]
    fn app_session_keeps_refresh_and_expiry() {
        let session = session_from_app_token("ghu_a", Some("ghr_r"), Some(28800), 1_000);
        assert_eq!(
            session,
            SessionWrite {
                access: "ghu_a".into(),
                refresh: Some("ghr_r".into()),
                expires_at: Some(29_800),
            }
        );
    }

    #[test]
    fn pat_session_clears_refresh_and_expiry() {
        let session = session_from_pat("ghp_pat");
        assert_eq!(
            session,
            SessionWrite {
                access: "ghp_pat".into(),
                refresh: None,
                expires_at: None,
            }
        );
    }

    #[test]
    fn token_expiry_uses_skew() {
        assert!(!token_is_expired(Some(1_100), 1_000, 60));
        assert!(token_is_expired(Some(1_060), 1_000, 60));
        assert!(!token_is_expired(None, 1_000, 60));
    }

    #[test]
    fn refresh_account_is_distinct() {
        assert_ne!(TOKEN_ACCOUNT, REFRESH_ACCOUNT);
        assert_ne!(TOKEN_ACCOUNT, EXPIRES_ACCOUNT);
        assert_eq!(REFRESH_ACCOUNT, "github-refresh");
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
    fn session_cache_is_used_before_keyring() {
        clear_session_cache();
        remember_session(session_from_app_token(
            "ghu_cache",
            Some("ghr_r"),
            Some(28800),
            1_000,
        ));
        assert_eq!(load_token().unwrap().as_deref(), Some("ghu_cache"));
        assert_eq!(stored_expires_at().unwrap(), Some(29_800));
        clear_session_cache();
    }

    #[test]
    fn device_flow_disabled_explains_the_app_setting() {
        let message = explain_oauth_error(
            "device_flow_disabled",
            Some("Device Flow must be explicitly enabled for this App"),
        );
        assert!(message.contains("Device Authorization Grant"), "{message}");
    }

    #[test]
    fn oauth_http_error_reads_json_body() {
        let err = oauth_http_error(
            reqwest::StatusCode::BAD_REQUEST,
            r#"{"error":"device_flow_disabled","error_description":"Device Flow must be explicitly enabled for this App"}"#,
        );
        assert!(
            err.to_string().contains("Device Authorization Grant"),
            "{err}"
        );
    }
}
