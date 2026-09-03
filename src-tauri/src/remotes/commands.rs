use super::{auth_for, AheadBehind, GitAuth, RemoteInfo};
use crate::error::Result;
use crate::git::{open_repo, RepoSummary};
use crate::settings::{self, load_app_settings, save_app_settings};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAuthArgs {
    pub path: String,
    pub remote: Option<String>,
    pub key_path: Option<String>,
    pub passphrase: Option<String>,
    pub remember_key: Option<bool>,
    pub remember_default: Option<bool>,
    pub remember_passphrase: Option<bool>,
}

pub fn git_auth(
    app: &AppHandle,
    path: &Path,
    remote: &str,
    key_path: Option<&str>,
    passphrase: Option<&str>,
) -> Result<GitAuth> {
    let settings = load_app_settings(app)?;
    let remotes = super::list_remotes(path)?;
    let info = remotes
        .into_iter()
        .find(|r| r.name == remote)
        .ok_or_else(|| crate::error::AppError::msg(format!("unknown remote '{remote}'")))?;
    auth_for(&settings, path, &info, key_path, passphrase)
}

fn apply_remember(app: &AppHandle, args: &RemoteAuthArgs, remote: &str) -> Result<()> {
    if args.key_path.is_none() {
        return Ok(());
    }
    let key = args.key_path.as_deref().unwrap();
    let mut settings = load_app_settings(app)?;
    if args.remember_key.unwrap_or(false) {
        settings::bind_ssh_key(&mut settings, &args.path, remote, key);
    }
    if args.remember_default.unwrap_or(false) {
        settings.ssh.default_key = Some(key.to_string());
    }
    if args.remember_key.unwrap_or(false) || args.remember_default.unwrap_or(false) {
        save_app_settings(app, &settings)?;
    }
    if args.remember_passphrase.unwrap_or(false) {
        if let Some(pass) = args.passphrase.as_deref().filter(|p| !p.is_empty()) {
            crate::ssh::store_passphrase(key, pass)?;
        }
    }
    Ok(())
}

fn emit_clone_log(app: &AppHandle, line: &str) {
    let _ = app.emit("clone-log", line);
}

#[tauri::command]
pub fn list_remotes(path: String) -> Result<Vec<RemoteInfo>> {
    super::list_remotes(&PathBuf::from(path))
}

#[tauri::command]
pub fn github_origin(path: String) -> Result<Option<RemoteInfo>> {
    super::github_origin(&PathBuf::from(path))
}

#[tauri::command]
pub fn ahead_behind(path: String) -> Result<AheadBehind> {
    super::ahead_behind(&PathBuf::from(path))
}

#[tauri::command]
pub fn fetch_remote(app: AppHandle, args: RemoteAuthArgs) -> Result<AheadBehind> {
    let path = PathBuf::from(&args.path);
    let remote = args.remote.clone().unwrap_or_else(|| "origin".into());
    apply_remember(&app, &args, &remote)?;
    let auth = git_auth(
        &app,
        &path,
        &remote,
        args.key_path.as_deref(),
        args.passphrase.as_deref(),
    )?;
    super::fetch(&path, &remote, &auth)
}

#[tauri::command]
pub fn push_branch(
    app: AppHandle,
    args: RemoteAuthArgs,
    branch: Option<String>,
    include_tags: Option<bool>,
) -> Result<AheadBehind> {
    let path = PathBuf::from(&args.path);
    let remote = args.remote.clone().unwrap_or_else(|| "origin".into());
    apply_remember(&app, &args, &remote)?;
    let auth = git_auth(
        &app,
        &path,
        &remote,
        args.key_path.as_deref(),
        args.passphrase.as_deref(),
    )?;
    super::push_branch(
        &path,
        &remote,
        branch.as_deref(),
        include_tags.unwrap_or(false),
        &auth,
    )
}

#[tauri::command]
pub fn pull_ff_only(
    app: AppHandle,
    args: RemoteAuthArgs,
    branch: Option<String>,
) -> Result<AheadBehind> {
    let path = PathBuf::from(&args.path);
    let remote = args.remote.clone().unwrap_or_else(|| "origin".into());
    apply_remember(&app, &args, &remote)?;
    let auth = git_auth(
        &app,
        &path,
        &remote,
        args.key_path.as_deref(),
        args.passphrase.as_deref(),
    )?;
    match branch.as_deref() {
        Some(name) if !name.is_empty() => super::pull_ff_branch(&path, &remote, Some(name), &auth),
        _ => super::pull_ff_only(&path, &remote, &auth),
    }
}

#[tauri::command]
pub fn clone_repository(
    app: AppHandle,
    url: String,
    dest: String,
    key_path: Option<String>,
    passphrase: Option<String>,
    remember_key: Option<bool>,
    remember_default: Option<bool>,
    remember_passphrase: Option<bool>,
) -> Result<RepoSummary> {
    let dest_path = PathBuf::from(&dest);
    let parsed = super::parse_remote_url(&url);
    emit_clone_log(&app, &format!("Cloning into '{}'...", dest_path.display()));
    if parsed.transport == "ssh" {
        let host = parsed.host.as_deref().unwrap_or("github.com");
        emit_clone_log(&app, &format!("Starting SSH session to {host}..."));
    }
    let dummy = RemoteInfo {
        name: "origin".into(),
        url: url.clone(),
        transport: parsed.transport.clone(),
        host: parsed.host.clone(),
        owner: parsed.owner.clone(),
        name_on_host: parsed.name.clone(),
    };
    let settings = load_app_settings(&app)?;
    let auth = match auth_for(
        &settings,
        &dest_path,
        &dummy,
        key_path.as_deref(),
        passphrase.as_deref(),
    ) {
        Ok(auth) => auth,
        Err(err) => {
            emit_clone_log(&app, &format!("error: {err}"));
            return Err(err);
        }
    };
    if let Err(err) = super::clone_repository(&url, &dest_path, &auth, |line| {
        emit_clone_log(&app, line);
    }) {
        emit_clone_log(&app, &format!("error: {err}"));
        return Err(err);
    }
    emit_clone_log(&app, "Clone complete.");
    apply_remember(
        &app,
        &RemoteAuthArgs {
            path: dest.clone(),
            remote: Some("origin".into()),
            key_path,
            passphrase,
            remember_key,
            remember_default,
            remember_passphrase,
        },
        "origin",
    )?;
    open_repo(&dest_path)
}

#[tauri::command]
pub fn push_tag(app: AppHandle, args: RemoteAuthArgs, tag: String) -> Result<()> {
    let path = PathBuf::from(&args.path);
    let remote = args.remote.clone().unwrap_or_else(|| "origin".into());
    apply_remember(&app, &args, &remote)?;
    let auth = git_auth(
        &app,
        &path,
        &remote,
        args.key_path.as_deref(),
        args.passphrase.as_deref(),
    )?;
    super::push_tag(&path, &remote, &tag, &auth)
}

#[tauri::command]
pub fn delete_remote_tag(app: AppHandle, args: RemoteAuthArgs, tag: String) -> Result<()> {
    let path = PathBuf::from(&args.path);
    let remote = args.remote.clone().unwrap_or_else(|| "origin".into());
    apply_remember(&app, &args, &remote)?;
    let auth = git_auth(
        &app,
        &path,
        &remote,
        args.key_path.as_deref(),
        args.passphrase.as_deref(),
    )?;
    super::delete_remote_tag(&path, &remote, &tag, &auth)
}

#[tauri::command]
pub fn checkout_pull_request(
    app: AppHandle,
    args: RemoteAuthArgs,
    number: u64,
) -> Result<RepoSummary> {
    let path = PathBuf::from(&args.path);
    let remote = args.remote.clone().unwrap_or_else(|| "origin".into());
    apply_remember(&app, &args, &remote)?;
    let auth = git_auth(
        &app,
        &path,
        &remote,
        args.key_path.as_deref(),
        args.passphrase.as_deref(),
    )?;
    let branch = format!("pr-{number}");
    super::fetch_refspec(
        &path,
        &remote,
        &format!("refs/pull/{number}/head:refs/heads/{branch}"),
        &auth,
    )?;
    crate::branches::checkout_branch(&path, &branch)
}
