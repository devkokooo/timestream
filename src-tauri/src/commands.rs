use crate::auth::{self, DeviceLoginBegin, GithubUser};
use crate::error::Result;
use crate::git::{
    checkout_branch, commit_changes, create_branch, create_tag, delete_tag, list_branches,
    load_commit, load_file_diff, load_status, load_timeline_opts, load_worktree_diff, open_repo,
    stage_path, unstage_path, BranchInfo, CommitDetail, FileDiff, RepoSummary, StatusPayload,
};
use crate::github::{
    self, CheckRunSummary, CreateIssue, CreatePullRequest, CreateRelease, IssueComment,
    IssueSummary, NotificationItem, PullRequestSummary, ReleaseSummary, RepoSearchHit,
    ReviewComment, SubmitReview,
};
use crate::graph::Timeline;
use crate::remotes::{self, AheadBehind, GitAuth, RemoteInfo};
use crate::settings::{self, AppSettings};
use crate::ssh::{self, SshAgentStatus, SshKeyInfo};
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

fn config_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| crate::error::AppError::msg(e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(settings::settings_file(&config_dir(app)?))
}

fn load_app_settings(app: &AppHandle) -> Result<AppSettings> {
    settings::load_from_path(&settings_path(app)?)
}

fn save_app_settings(app: &AppHandle, settings: &AppSettings) -> Result<()> {
    settings::save_to_path(&settings_path(app)?, settings)
}

fn git_auth(
    app: &AppHandle,
    path: &Path,
    remote: &str,
    key_path: Option<&str>,
    passphrase: Option<&str>,
) -> Result<GitAuth> {
    let settings = load_app_settings(app)?;
    let remotes = remotes::list_remotes(path)?;
    let info = remotes
        .into_iter()
        .find(|r| r.name == remote)
        .ok_or_else(|| crate::error::AppError::msg(format!("unknown remote '{remote}'")))?;
    remotes::auth_for(&settings, path, &info, key_path, passphrase)
}

#[tauri::command]
pub fn open_repository(path: String) -> Result<RepoSummary> {
    open_repo(&PathBuf::from(path))
}

#[tauri::command]
pub fn get_timeline(app: AppHandle, path: String) -> Result<Timeline> {
    let show = load_app_settings(&app)
        .map(|s| s.timeline.show_upstream_refs)
        .unwrap_or(true);
    load_timeline_opts(&PathBuf::from(path), show)
}

#[tauri::command]
pub fn get_status(path: String) -> Result<StatusPayload> {
    load_status(&PathBuf::from(path))
}

#[tauri::command]
pub fn get_commit(path: String, sha: String) -> Result<CommitDetail> {
    load_commit(&PathBuf::from(path), &sha)
}

#[tauri::command]
pub fn get_file_diff(path: String, sha: String, rel: String) -> Result<FileDiff> {
    load_file_diff(&PathBuf::from(path), &sha, &rel)
}

#[tauri::command]
pub fn get_worktree_diff(path: String, rel: String, staged: bool) -> Result<FileDiff> {
    load_worktree_diff(&PathBuf::from(path), &rel, staged)
}

#[tauri::command]
pub fn get_branches(path: String) -> Result<Vec<BranchInfo>> {
    list_branches(&PathBuf::from(path))
}

#[tauri::command]
pub fn switch_branch(path: String, name: String) -> Result<RepoSummary> {
    checkout_branch(&PathBuf::from(path), &name)
}

#[tauri::command]
pub fn create_local_branch(path: String, name: String) -> Result<RepoSummary> {
    create_branch(&PathBuf::from(path), &name)
}

#[tauri::command]
pub fn stage_file(path: String, rel: String) -> Result<StatusPayload> {
    stage_path(&PathBuf::from(path), &rel)
}

#[tauri::command]
pub fn unstage_file(path: String, rel: String) -> Result<StatusPayload> {
    unstage_path(&PathBuf::from(path), &rel)
}

#[tauri::command]
pub fn file_commit(path: String, message: String) -> Result<String> {
    commit_changes(&PathBuf::from(path), &message)
}

#[tauri::command]
pub fn create_local_tag(
    path: String,
    name: String,
    sha: String,
    message: Option<String>,
) -> Result<()> {
    create_tag(&PathBuf::from(path), &name, &sha, message.as_deref())
}

#[tauri::command]
pub fn delete_local_tag(path: String, name: String) -> Result<()> {
    delete_tag(&PathBuf::from(path), &name)
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

#[tauri::command]
pub async fn github_login_begin() -> Result<DeviceLoginBegin> {
    auth::login_begin().await
}

#[tauri::command]
pub async fn github_login_poll(device_code: String) -> Result<Option<GithubUser>> {
    auth::login_poll(&device_code).await
}

#[tauri::command]
pub async fn github_login_pat(token: String) -> Result<GithubUser> {
    auth::login_pat(&token).await
}

#[tauri::command]
pub async fn github_whoami() -> Result<Option<GithubUser>> {
    auth::whoami().await
}

#[tauri::command]
pub fn github_logout() -> Result<()> {
    auth::logout()
}

#[tauri::command]
pub fn list_remotes(path: String) -> Result<Vec<RemoteInfo>> {
    remotes::list_remotes(&PathBuf::from(path))
}

#[tauri::command]
pub fn github_origin(path: String) -> Result<Option<RemoteInfo>> {
    remotes::github_origin(&PathBuf::from(path))
}

#[tauri::command]
pub fn ahead_behind(path: String) -> Result<AheadBehind> {
    remotes::ahead_behind(&PathBuf::from(path))
}

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
            auth::store_passphrase(key, pass)?;
        }
    }
    Ok(())
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
    remotes::fetch(&path, &remote, &auth)
}

#[tauri::command]
pub fn push_branch(app: AppHandle, args: RemoteAuthArgs, branch: Option<String>) -> Result<AheadBehind> {
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
    remotes::push_branch(&path, &remote, branch.as_deref(), &auth)
}

#[tauri::command]
pub fn pull_ff_only(app: AppHandle, args: RemoteAuthArgs) -> Result<AheadBehind> {
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
    remotes::pull_ff_only(&path, &remote, &auth)
}

fn emit_clone_log(app: &AppHandle, line: &str) {
    let _ = app.emit("clone-log", line);
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
    let parsed = remotes::parse_remote_url(&url);
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
    let auth = match remotes::auth_for(
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
    if let Err(err) = remotes::clone_repository(&url, &dest_path, &auth, |line| {
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
    remotes::push_tag(&path, &remote, &tag, &auth)
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
    remotes::delete_remote_tag(&path, &remote, &tag, &auth)
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
    remotes::fetch_refspec(
        &path,
        &remote,
        &format!("refs/pull/{number}/head:refs/heads/{branch}"),
        &auth,
    )?;
    checkout_branch(&path, &branch)
}

#[tauri::command]
pub fn list_ssh_keys() -> Result<Vec<SshKeyInfo>> {
    ssh::list_keys()
}

#[tauri::command]
pub fn ssh_agent_status() -> Result<SshAgentStatus> {
    Ok(ssh::agent_status())
}

#[tauri::command]
pub fn ssh_agent_ensure() -> Result<SshAgentStatus> {
    ssh::ensure_agent()
}

#[tauri::command]
pub fn ssh_add_key(path: String, passphrase: Option<String>) -> Result<SshAgentStatus> {
    ssh::add_key(&path, passphrase.as_deref())
}

#[tauri::command]
pub async fn github_list_pulls(
    owner: String,
    repo: String,
    filter: String,
) -> Result<Vec<PullRequestSummary>> {
    github::list_pulls(&owner, &repo, &filter).await
}

#[tauri::command]
pub async fn github_get_pull(
    owner: String,
    repo: String,
    number: u64,
) -> Result<PullRequestSummary> {
    github::get_pull(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_create_pull(
    owner: String,
    repo: String,
    input: CreatePullRequest,
) -> Result<PullRequestSummary> {
    github::create_pull(&owner, &repo, input).await
}

#[tauri::command]
pub async fn github_update_pull(
    owner: String,
    repo: String,
    number: u64,
    patch: Value,
) -> Result<PullRequestSummary> {
    github::update_pull(&owner, &repo, number, patch).await
}

#[tauri::command]
pub async fn github_merge_pull(
    owner: String,
    repo: String,
    number: u64,
    method: String,
) -> Result<PullRequestSummary> {
    github::merge_pull(&owner, &repo, number, &method).await
}

#[tauri::command]
pub async fn github_list_issues(
    owner: String,
    repo: String,
    filter: String,
) -> Result<Vec<IssueSummary>> {
    github::list_issues(&owner, &repo, &filter).await
}

#[tauri::command]
pub async fn github_create_issue(
    owner: String,
    repo: String,
    input: CreateIssue,
) -> Result<IssueSummary> {
    github::create_issue(&owner, &repo, input).await
}

#[tauri::command]
pub async fn github_update_issue(
    owner: String,
    repo: String,
    number: u64,
    patch: Value,
) -> Result<IssueSummary> {
    github::update_issue(&owner, &repo, number, patch).await
}

#[tauri::command]
pub async fn github_list_issue_comments(
    owner: String,
    repo: String,
    number: u64,
) -> Result<Vec<IssueComment>> {
    github::list_issue_comments(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_add_issue_comment(
    owner: String,
    repo: String,
    number: u64,
    body: String,
) -> Result<IssueComment> {
    github::add_issue_comment(&owner, &repo, number, &body).await
}

#[tauri::command]
pub async fn github_list_releases(owner: String, repo: String) -> Result<Vec<ReleaseSummary>> {
    github::list_releases(&owner, &repo).await
}

#[tauri::command]
pub async fn github_create_release(
    owner: String,
    repo: String,
    input: CreateRelease,
) -> Result<ReleaseSummary> {
    github::create_release(&owner, &repo, input).await
}

#[tauri::command]
pub async fn github_update_release(
    owner: String,
    repo: String,
    id: u64,
    patch: Value,
) -> Result<ReleaseSummary> {
    github::update_release(&owner, &repo, id, patch).await
}

#[tauri::command]
pub async fn github_list_checks(
    owner: String,
    repo: String,
    sha: String,
) -> Result<Vec<CheckRunSummary>> {
    github::list_check_runs(&owner, &repo, &sha).await
}

#[tauri::command]
pub async fn github_rerun_job(owner: String, repo: String, job_id: u64) -> Result<()> {
    github::rerun_job(&owner, &repo, job_id).await
}

#[tauri::command]
pub async fn github_list_review_comments(
    owner: String,
    repo: String,
    number: u64,
) -> Result<Vec<ReviewComment>> {
    github::list_review_comments(&owner, &repo, number).await
}

#[tauri::command]
pub async fn github_submit_review(
    owner: String,
    repo: String,
    number: u64,
    input: SubmitReview,
) -> Result<()> {
    github::submit_review(&owner, &repo, number, input).await
}

#[tauri::command]
pub async fn github_reply_review_comment(
    owner: String,
    repo: String,
    number: u64,
    comment_id: u64,
    body: String,
) -> Result<ReviewComment> {
    github::reply_review_comment(&owner, &repo, number, comment_id, &body).await
}

#[tauri::command]
pub async fn github_list_notifications() -> Result<Vec<NotificationItem>> {
    github::list_notifications().await
}

#[tauri::command]
pub async fn github_search_repos(query: String) -> Result<Vec<RepoSearchHit>> {
    github::list_accessible_repos(&query).await
}

