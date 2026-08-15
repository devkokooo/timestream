use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};

const SERVICE: &str = "com.timestream.app";
const TOKEN_ACCOUNT: &str = "github-token";
const GITHUB_CLIENT_ID: &str = match option_env!("TIMESTREAM_GITHUB_CLIENT_ID") {
    Some(id) => id,
    None => "",
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
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
}

/// GitHub `/user` JSON is snake_case; `GithubUser` is camelCase for IPC.
#[derive(Deserialize)]
struct GithubApiUser {
    login: String,
    name: Option<String>,
    avatar_url: String,
}

impl From<GithubApiUser> for GithubUser {
    fn from(user: GithubApiUser) -> Self {
        Self {
            login: user.login,
            name: user.name,
            avatar_url: user.avatar_url,
        }
    }
}

#[allow(dead_code)]
pub fn client_id_configured() -> bool {
    !GITHUB_CLIENT_ID.is_empty()
}

pub fn store_token(token: &str) -> Result<()> {
    entry(TOKEN_ACCOUNT)?
        .set_password(token)
        .map_err(|e| AppError::msg(e.to_string()))
}

pub fn load_token() -> Result<Option<String>> {
    match entry(TOKEN_ACCOUNT)?.get_password() {
        Ok(token) if !token.is_empty() => Ok(Some(token)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

pub fn delete_token() -> Result<()> {
    match entry(TOKEN_ACCOUNT)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

pub fn store_passphrase(key_path: &str, passphrase: &str) -> Result<()> {
    entry(&pass_account(key_path))?
        .set_password(passphrase)
        .map_err(|e| AppError::msg(e.to_string()))
}

pub fn load_passphrase(key_path: &str) -> Result<Option<String>> {
    match entry(&pass_account(key_path))?.get_password() {
        Ok(value) if !value.is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

#[allow(dead_code)]
pub fn delete_passphrase(key_path: &str) -> Result<()> {
    match entry(&pass_account(key_path))?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(AppError::msg(err.to_string())),
    }
}

fn pass_account(key_path: &str) -> String {
    format!("ssh-pass:{}", key_path.replace('\\', "/"))
}

fn entry(account: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, account).map_err(|e| AppError::msg(e.to_string()))
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
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            // Keep in sync with AGENTS.md "GitHub personal access token".
            ("scope", "repo read:org workflow"),
        ])
        .send()
        .await?
        .error_for_status()?
        .json::<DeviceCodeResponse>()
        .await?;
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
            "GitHub OAuth client id is not configured. Use a personal access token instead.",
        ));
    }
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await?
        .error_for_status()?
        .json::<AccessTokenResponse>()
        .await?;
    if let Some(err) = res.error.as_deref() {
        if err == "authorization_pending" || err == "slow_down" {
            return Ok(None);
        }
        return Err(AppError::msg(format!("GitHub login failed: {err}")));
    }
    let Some(token) = res.access_token else {
        return Ok(None);
    };
    store_token(&token)?;
    Ok(Some(whoami_with(&token).await?))
}

pub async fn login_pat(token: &str) -> Result<GithubUser> {
    let token = token.trim();
    if token.is_empty() {
        return Err(AppError::msg("a GitHub token is required"));
    }
    let user = whoami_with(token).await?;
    store_token(token)?;
    Ok(user)
}

pub async fn whoami() -> Result<Option<GithubUser>> {
    let Some(token) = load_token()? else {
        return Ok(None);
    };
    match whoami_with(&token).await {
        Ok(user) => Ok(Some(user)),
        Err(_) => Ok(None),
    }
}

pub async fn whoami_with(token: &str) -> Result<GithubUser> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.github.com/user")
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "timestream")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await?;
    if !res.status().is_success() {
        return Err(AppError::msg(format!(
            "GitHub rejected credentials ({})",
            res.status()
        )));
    }
    let user: GithubApiUser = res.json().await?;
    Ok(user.into())
}

pub fn logout() -> Result<()> {
    delete_token()
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
                "avatar_url": "https://avatars.githubusercontent.com/u/1"
            }"#,
        )
        .unwrap()
        .into();
        assert_eq!(user.login, "octocat");
        assert_eq!(user.name.as_deref(), Some("The Octocat"));
        assert_eq!(user.avatar_url, "https://avatars.githubusercontent.com/u/1");
        let ipc = serde_json::to_value(&user).unwrap();
        assert_eq!(ipc["avatarUrl"], "https://avatars.githubusercontent.com/u/1");
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
    }
}
