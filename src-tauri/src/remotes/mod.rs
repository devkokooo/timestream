use crate::auth;
use crate::error::{AppError, Result};
use crate::settings::AppSettings;

pub mod commands;
use git2::{
    AutotagOption, Cred, CredentialType, FetchOptions, PushOptions, RemoteCallbacks, Repository,
};
use serde::{Deserialize, Serialize};
use std::cell::{Cell, RefCell};
use std::path::{Path, PathBuf};
use std::rc::Rc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
    pub transport: String,
    pub host: Option<String>,
    pub owner: Option<String>,
    pub name_on_host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AheadBehind {
    pub ahead: usize,
    pub behind: usize,
    pub upstream: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GitAuth {
    pub token: Option<String>,
    pub ssh_key: Option<PathBuf>,
    pub passphrase: Option<String>,
    pub use_agent: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedRemote {
    pub transport: String,
    pub host: Option<String>,
    pub owner: Option<String>,
    pub name: Option<String>,
}

pub fn parse_remote_url(url: &str) -> ParsedRemote {
    let trimmed = url.trim();
    if let Some(rest) = trimmed.strip_prefix("git@") {
        let (host, path) = rest.split_once(':').unwrap_or((rest, ""));
        let (owner, name) = split_owner_repo(path);
        return ParsedRemote {
            transport: "ssh".into(),
            host: Some(host.to_string()),
            owner,
            name,
        };
    }
    if let Some(rest) = trimmed
        .strip_prefix("ssh://")
        .or_else(|| trimmed.strip_prefix("SSH://"))
    {
        let rest = rest.strip_prefix("git@").unwrap_or(rest);
        let (host, path) = rest.split_once('/').unwrap_or((rest, ""));
        let host = host.split('@').next_back().unwrap_or(host);
        let (owner, name) = split_owner_repo(path);
        return ParsedRemote {
            transport: "ssh".into(),
            host: Some(host.to_string()),
            owner,
            name,
        };
    }
    if let Some(rest) = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
    {
        let rest = rest.split('@').next_back().unwrap_or(rest);
        let mut parts = rest.split('/');
        let host = parts.next().map(|s| s.to_string());
        let owner = parts.next().map(|s| s.to_string());
        let name = parts.next().map(strip_git_suffix).filter(|s| !s.is_empty());
        return ParsedRemote {
            transport: "https".into(),
            host,
            owner,
            name,
        };
    }
    ParsedRemote {
        transport: "other".into(),
        host: None,
        owner: None,
        name: None,
    }
}

fn split_owner_repo(path: &str) -> (Option<String>, Option<String>) {
    let path = path.trim_start_matches('/');
    let mut parts = path.split('/');
    let owner = parts.next().filter(|s| !s.is_empty()).map(|s| s.to_string());
    let name = parts.next().map(strip_git_suffix).filter(|s| !s.is_empty());
    (owner, name)
}

fn strip_git_suffix(name: &str) -> String {
    name.trim_end_matches('/').trim_end_matches(".git").to_string()
}

pub fn list_remotes(path: &Path) -> Result<Vec<RemoteInfo>> {
    let repo = Repository::discover(path)?;
    let mut out = Vec::new();
    for name in repo.remotes()?.iter().flatten() {
        let remote = repo.find_remote(name)?;
        let url = remote.url().unwrap_or("").to_string();
        let parsed = parse_remote_url(&url);
        out.push(RemoteInfo {
            name: name.to_string(),
            url,
            transport: parsed.transport,
            host: parsed.host,
            owner: parsed.owner,
            name_on_host: parsed.name,
        });
    }
    Ok(out)
}

pub fn github_origin(path: &Path) -> Result<Option<RemoteInfo>> {
    Ok(list_remotes(path)?
        .into_iter()
        .find(|r| r.name == "origin" && r.host.as_deref() == Some("github.com"))
        .or_else(|| {
            // fall back to any github.com remote
            list_remotes(path)
                .ok()
                .and_then(|all| all.into_iter().find(|r| r.host.as_deref() == Some("github.com")))
        }))
}

pub fn ahead_behind(path: &Path) -> Result<AheadBehind> {
    let repo = Repository::discover(path)?;
    ahead_behind_repo(&repo)
}

fn ahead_behind_repo(repo: &Repository) -> Result<AheadBehind> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => {
            return Ok(AheadBehind {
                ahead: 0,
                behind: 0,
                upstream: None,
            });
        }
    };
    if !head.is_branch() {
        return Ok(AheadBehind {
            ahead: 0,
            behind: 0,
            upstream: None,
        });
    }
    let local = head.target().ok_or_else(|| AppError::msg("HEAD has no target"))?;
    let branch = git2::Branch::wrap(head);
    match branch.upstream() {
        Ok(up) => {
            let upstream_name = up.name()?.map(|s| s.to_string());
            let remote_oid = up.get().target().ok_or_else(|| AppError::msg("upstream has no target"))?;
            let (ahead, behind) = repo.graph_ahead_behind(local, remote_oid)?;
            Ok(AheadBehind {
                ahead,
                behind,
                upstream: upstream_name,
            })
        }
        Err(_) => Ok(AheadBehind {
            ahead: 0,
            behind: 0,
            upstream: None,
        }),
    }
}

pub fn auth_for(
    settings: &AppSettings,
    repo_path: &Path,
    remote: &RemoteInfo,
    key_override: Option<&str>,
    passphrase: Option<&str>,
) -> Result<GitAuth> {
    if remote.transport == "ssh" {
        let key = key_override
            .map(|s| s.to_string())
            .or_else(|| settings.resolve_ssh_key(&repo_path.to_string_lossy(), &remote.name));
        if settings.ssh.agent_autostart {
            let _ = crate::ssh::ensure_agent();
        }
        let Some(key) = key else {
            return Err(AppError::msg("SSH_IDENTITY_REQUIRED"));
        };
        let pass = match passphrase {
            Some(p) if !p.is_empty() => Some(p.to_string()),
            _ => crate::ssh::load_passphrase(&key).ok().flatten(),
        };
        let auth = GitAuth {
            token: None,
            ssh_key: Some(PathBuf::from(&key)),
            passphrase: pass,
            use_agent: true,
        };
        prepare_ssh(&auth)?;
        return Ok(auth);
    }
    Ok(GitAuth {
        token: tauri::async_runtime::block_on(auth::credential_for(
            remote.host.as_deref().unwrap_or(""),
        ))?,
        ssh_key: None,
        passphrase: None,
        use_agent: false,
    })
}

fn prepare_ssh(auth: &GitAuth) -> Result<()> {
    crate::ssh::exec::ensure_registered();
    if let Some(key) = &auth.ssh_key {
        if let Err(err) = crate::ssh::add_key(&key.to_string_lossy(), auth.passphrase.as_deref()) {
            if err.to_string().contains("SSH_PASSPHRASE_REQUIRED") {
                return Err(err);
            }
        }
    }
    Ok(())
}

fn with_ssh<T>(auth: &GitAuth, body: impl FnOnce() -> Result<T>) -> Result<T> {
    let key = auth.ssh_key.clone();
    crate::ssh::exec::with_identity(key.as_deref(), body)
}

fn make_callbacks(auth: &GitAuth) -> RemoteCallbacks<'_> {
    let tried_agent = std::cell::Cell::new(false);
    let tried_key = std::cell::Cell::new(false);
    let tried_https = std::cell::Cell::new(false);
    let mut cbs = RemoteCallbacks::new();
    cbs.credentials(move |_url, username_from_url, allowed| {
        let username = username_from_url.unwrap_or("git");
        if allowed.contains(CredentialType::SSH_KEY) {
            if auth.use_agent && !tried_agent.get() {
                tried_agent.set(true);
                if let Ok(cred) = Cred::ssh_key_from_agent(username) {
                    return Ok(cred);
                }
            }
            if let Some(key) = &auth.ssh_key {
                if !tried_key.get() {
                    tried_key.set(true);
                    let pub_key = {
                        let mut p = key.clone();
                        p.set_extension("pub");
                        p
                    };
                    return Cred::ssh_key(
                        username,
                        pub_key.exists().then_some(pub_key.as_path()),
                        key,
                        auth.passphrase.as_deref(),
                    );
                }
            }
        }
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) && !tried_https.get() {
            tried_https.set(true);
            if let Some(token) = &auth.token {
                return Cred::userpass_plaintext("x-access-token", token);
            }
        }
        Err(git2::Error::from_str("no credentials available"))
    });
    cbs
}

pub fn fetch(path: &Path, remote_name: &str, auth: &GitAuth) -> Result<AheadBehind> {
    let repo = Repository::discover(path)?;
    fetch_repo(&repo, remote_name, auth)?;
    ahead_behind_repo(&repo)
}

fn fetch_repo(repo: &Repository, remote_name: &str, auth: &GitAuth) -> Result<()> {
    with_ssh(auth, || {
        let mut remote = repo.find_remote(remote_name)?;
        let mut opts = FetchOptions::new();
        opts.remote_callbacks(make_callbacks(auth));
        opts.download_tags(AutotagOption::Auto);
        remote.fetch(&[] as &[&str], Some(&mut opts), None)?;
        Ok(())
    })
}

pub fn fetch_refspec(
    path: &Path,
    remote_name: &str,
    refspec: &str,
    auth: &GitAuth,
) -> Result<()> {
    let repo = Repository::discover(path)?;
    with_ssh(auth, || {
        let mut remote = repo.find_remote(remote_name)?;
        let mut opts = FetchOptions::new();
        opts.remote_callbacks(make_callbacks(auth));
        remote.fetch(&[refspec], Some(&mut opts), None)?;
        Ok(())
    })
}

pub fn push_branch(
    path: &Path,
    remote_name: &str,
    branch: Option<&str>,
    auth: &GitAuth,
) -> Result<AheadBehind> {
    let repo = Repository::discover(path)?;
    let branch_name = match branch {
        Some(name) => name.to_string(),
        None => repo
            .head()?
            .shorthand()
            .ok_or_else(|| AppError::msg("detached HEAD cannot be pushed"))?
            .to_string(),
    };
    let local_ref = format!("refs/heads/{branch_name}");
    let local_oid = repo
        .find_reference(&local_ref)?
        .target()
        .ok_or_else(|| AppError::msg("branch has no target"))?;
    if let Ok(remote_ref) = repo.find_reference(&format!("refs/remotes/{remote_name}/{branch_name}"))
    {
        if let Some(remote_oid) = remote_ref.target() {
            let (_ahead, behind) = repo.graph_ahead_behind(local_oid, remote_oid)?;
            if behind > 0 {
                return Err(AppError::msg(
                    "FORCE_PUSH_REJECTED: push would rewrite history on the remote",
                ));
            }
        }
    }
    with_ssh(auth, || {
        let mut remote = repo.find_remote(remote_name)?;
        let mut opts = PushOptions::new();
        opts.remote_callbacks(make_callbacks(auth));
        remote.push(&[&format!("{local_ref}:{local_ref}")], Some(&mut opts))?;
        Ok(())
    })?;
    // set upstream if missing
    if let Ok(mut local) = repo.find_branch(&branch_name, git2::BranchType::Local) {
        if local.upstream().is_err() {
            let _ = local.set_upstream(Some(&format!("{remote_name}/{branch_name}")));
        }
    }
    ahead_behind_repo(&repo)
}

pub fn push_tag(path: &Path, remote_name: &str, tag: &str, auth: &GitAuth) -> Result<()> {
    let repo = Repository::discover(path)?;
    with_ssh(auth, || {
        let mut remote = repo.find_remote(remote_name)?;
        let spec = format!("refs/tags/{tag}:refs/tags/{tag}");
        let mut opts = PushOptions::new();
        opts.remote_callbacks(make_callbacks(auth));
        remote.push(&[&spec], Some(&mut opts))?;
        Ok(())
    })
}

pub fn delete_remote_tag(path: &Path, remote_name: &str, tag: &str, auth: &GitAuth) -> Result<()> {
    let repo = Repository::discover(path)?;
    with_ssh(auth, || {
        let mut remote = repo.find_remote(remote_name)?;
        let spec = format!(":refs/tags/{tag}");
        let mut opts = PushOptions::new();
        opts.remote_callbacks(make_callbacks(auth));
        remote.push(&[&spec], Some(&mut opts))?;
        Ok(())
    })
}

pub fn pull_ff_only(path: &Path, remote_name: &str, auth: &GitAuth) -> Result<AheadBehind> {
    pull_ff_branch(path, remote_name, None, auth)
}

pub fn pull_ff_branch(
    path: &Path,
    remote_name: &str,
    branch: Option<&str>,
    auth: &GitAuth,
) -> Result<AheadBehind> {
    let repo = Repository::discover(path)?;
    fetch_repo(&repo, remote_name, auth)?;
    let named = branch.and_then(|name| {
        let name = name.trim_start_matches("origin/");
        (!name.is_empty()).then(|| name.to_string())
    });
    let branch_name = match named.clone() {
        Some(name) => name,
        None => {
            let head = repo.head()?;
            if !head.is_branch() {
                return Err(AppError::msg("cannot fast-forward a detached HEAD"));
            }
            head.shorthand()
                .ok_or_else(|| AppError::msg("HEAD has no name"))?
                .to_string()
        }
    };
    fast_forward_branch(&repo, remote_name, &branch_name, named.is_some())?;
    ahead_behind_repo(&repo)
}

fn fast_forward_branch(
    repo: &Repository,
    remote_name: &str,
    branch_name: &str,
    required: bool,
) -> Result<()> {
    let remote_ref = format!("refs/remotes/{remote_name}/{branch_name}");
    let Some(remote_oid) = repo.find_reference(&remote_ref).ok().and_then(|r| r.target()) else {
        return if required {
            Err(AppError::msg("no upstream is configured"))
        } else {
            Ok(())
        };
    };
    let local_ref_name = format!("refs/heads/{branch_name}");
    let Ok(mut local_ref) = repo.find_reference(&local_ref_name) else {
        return Ok(());
    };
    let local_oid = local_ref
        .target()
        .ok_or_else(|| AppError::msg("branch has no target"))?;
    let (ahead, behind) = repo.graph_ahead_behind(local_oid, remote_oid)?;
    if behind == 0 {
        return Ok(());
    }
    if ahead > 0 {
        return Err(AppError::msg(
            "VARIANT_DIVERGED: local branch and origin have diverged — pull would not fast-forward",
        ));
    }
    let on_branch = repo
        .head()
        .ok()
        .filter(|head| head.is_branch())
        .and_then(|head| head.shorthand().map(|name| name == branch_name))
        .unwrap_or(false);
    if on_branch {
        let obj = repo.find_object(remote_oid, None)?;
        repo.checkout_tree(&obj, None)?;
    }
    local_ref.set_target(remote_oid, "ff-only pull")?;
    Ok(())
}

pub(crate) fn split_progress_text(raw: &str) -> Vec<String> {
    raw.split(|c| c == '\r' || c == '\n')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

pub(crate) fn format_transfer_progress(
    received: usize,
    total: usize,
    bytes: usize,
    last_pct: &Cell<i32>,
) -> Option<String> {
    if total == 0 {
        return None;
    }
    let pct = ((received * 100) / total) as i32;
    if pct == last_pct.get() && received < total {
        return None;
    }
    last_pct.set(pct);
    let kib = bytes as f64 / 1024.0;
    Some(format!(
        "Receiving objects: {pct:3}% ({received}/{total}), {kib:.2} KiB"
    ))
}

pub(crate) fn format_delta_progress(
    indexed: usize,
    total: usize,
    last_pct: &Cell<i32>,
) -> Option<String> {
    if total == 0 {
        return None;
    }
    let pct = ((indexed * 100) / total) as i32;
    if pct == last_pct.get() && indexed < total {
        return None;
    }
    last_pct.set(pct);
    Some(format!("Resolving deltas: {pct:3}% ({indexed}/{total})"))
}

pub(crate) fn format_checkout_progress(
    path: Option<&Path>,
    current: usize,
    total: usize,
    last_pct: &Cell<i32>,
) -> Option<String> {
    if total == 0 {
        return None;
    }
    let pct = ((current * 100) / total) as i32;
    if pct == last_pct.get() && current < total {
        return None;
    }
    last_pct.set(pct);
    let name = path
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    if name.is_empty() {
        Some(format!("Checking out files: {pct:3}% ({current}/{total})"))
    } else {
        Some(format!(
            "Checking out files: {pct:3}% ({current}/{total}) {name}"
        ))
    }
}

pub fn clone_repository(
    url: &str,
    dest: &Path,
    auth: &GitAuth,
    log: impl FnMut(&str),
) -> Result<PathBuf> {
    let existed = dest.exists();
    let log = Rc::new(RefCell::new(log));
    let result = with_ssh(auth, || {
        let mut cbs = make_callbacks(auth);
        let last_obj = Cell::new(-1);
        let last_delta = Cell::new(-1);
        let transfer_log = Rc::clone(&log);
        cbs.transfer_progress(move |stats| {
            if let Some(line) = format_transfer_progress(
                stats.received_objects(),
                stats.total_objects(),
                stats.received_bytes(),
                &last_obj,
            ) {
                (*transfer_log.borrow_mut())(&line);
            }
            if stats.total_objects() > 0 && stats.received_objects() == stats.total_objects() {
                if let Some(line) =
                    format_delta_progress(stats.indexed_deltas(), stats.total_deltas(), &last_delta)
                {
                    (*transfer_log.borrow_mut())(&line);
                }
            }
            true
        });
        let sideband_log = Rc::clone(&log);
        cbs.sideband_progress(move |data| {
            let text = String::from_utf8_lossy(data);
            for line in split_progress_text(&text) {
                (*sideband_log.borrow_mut())(&line);
            }
            true
        });

        let mut checkout = git2::build::CheckoutBuilder::new();
        let last_co = Cell::new(-1);
        let checkout_log = Rc::clone(&log);
        checkout.progress(move |path, current, total| {
            if let Some(line) = format_checkout_progress(path, current, total, &last_co) {
                (*checkout_log.borrow_mut())(&line);
            }
        });

        let mut builder = git2::build::RepoBuilder::new();
        let mut fetch = FetchOptions::new();
        fetch.remote_callbacks(cbs);
        builder.fetch_options(fetch);
        builder.with_checkout(checkout);
        builder.clone(url, dest)?;
        Ok(dest.to_path_buf())
    });
    if result.is_err() && !existed {
        let _ = std::fs::remove_dir_all(dest);
    }
    result
}

#[allow(dead_code)]
pub fn github_clone_url(owner: &str, name: &str, protocol: &str) -> String {
    if protocol == "ssh" {
        format!("git@github.com:{owner}/{name}.git")
    } else {
        format!("https://github.com/{owner}/{name}.git")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::path::Path;

    #[test]
    fn parses_ssh_scp_syntax() {
        let p = parse_remote_url("git@github.com:acme/timestream.git");
        assert_eq!(p.transport, "ssh");
        assert_eq!(p.host.as_deref(), Some("github.com"));
        assert_eq!(p.owner.as_deref(), Some("acme"));
        assert_eq!(p.name.as_deref(), Some("timestream"));
    }

    #[test]
    fn parses_https() {
        let p = parse_remote_url("https://github.com/acme/timestream");
        assert_eq!(p.transport, "https");
        assert_eq!(p.owner.as_deref(), Some("acme"));
        assert_eq!(p.name.as_deref(), Some("timestream"));
    }

    #[test]
    fn parses_ssh_url() {
        let p = parse_remote_url("ssh://git@github.com/acme/timestream.git");
        assert_eq!(p.transport, "ssh");
        assert_eq!(p.host.as_deref(), Some("github.com"));
        assert_eq!(p.name.as_deref(), Some("timestream"));
    }

    #[test]
    fn splits_cr_and_lf_sideband() {
        assert_eq!(
            split_progress_text("remote: Counting objects: 10\rremote: Counting objects: 20\n"),
            vec![
                "remote: Counting objects: 10",
                "remote: Counting objects: 20"
            ]
        );
    }

    #[test]
    fn transfer_progress_throttles_same_percent() {
        let last = Cell::new(-1);
        let first = format_transfer_progress(10, 100, 1024, &last).unwrap();
        assert!(first.contains("10%"));
        assert!(format_transfer_progress(10, 100, 2048, &last).is_none());
        let next = format_transfer_progress(11, 100, 2048, &last).unwrap();
        assert!(next.contains("11%"));
        assert!(next.contains("2.00 KiB"));
    }

    #[test]
    fn clone_url_respects_protocol() {
        assert_eq!(
            github_clone_url("acme", "app", "ssh"),
            "git@github.com:acme/app.git"
        );
        assert_eq!(
            github_clone_url("acme", "app", "https"),
            "https://github.com/acme/app.git"
        );
    }

    fn no_auth() -> GitAuth {
        GitAuth {
            token: None,
            ssh_key: None,
            passphrase: None,
            use_agent: false,
        }
    }

    fn write_commit(repo: &Repository, dir: &Path, file: &str, body: &str, msg: &str) -> git2::Oid {
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Analyst").unwrap();
        cfg.set_str("user.email", "analyst@tva.local").unwrap();
        std::fs::write(dir.join(file), body).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(file)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("Analyst", "analyst@tva.local").unwrap();
        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.as_ref().into_iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
            .unwrap()
    }

    fn trunk_name(repo: &Repository) -> String {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(str::to_string))
            .unwrap_or_else(|| "master".into())
    }

    #[test]
    fn fetch_and_ff_pull_after_remote_merge() {
        let root = tempfile::TempDir::new().unwrap();
        let origin_dir = root.path().join("origin");
        let local_dir = root.path().join("local");
        std::fs::create_dir_all(&origin_dir).unwrap();

        let origin = Repository::init(&origin_dir).unwrap();
        let first = write_commit(&origin, &origin_dir, "a.txt", "one", "root");
        let trunk = trunk_name(&origin);

        git2::build::RepoBuilder::new()
            .clone(origin_dir.to_str().unwrap(), &local_dir)
            .unwrap();
        let local = Repository::open(&local_dir).unwrap();
        {
            let mut branch = local.find_branch(&trunk, git2::BranchType::Local).unwrap();
            branch.set_upstream(Some(&format!("origin/{trunk}"))).unwrap();
        }
        assert_eq!(
            local.head().unwrap().peel_to_commit().unwrap().id(),
            first
        );

        let merged = write_commit(&origin, &origin_dir, "a.txt", "merged", "merge request");

        let fetched = fetch(&local_dir, "origin", &no_auth()).unwrap();
        assert_eq!(fetched.behind, 1, "fetch should see the merged tip");
        assert_eq!(
            local
                .find_reference(&format!("refs/remotes/origin/{trunk}"))
                .unwrap()
                .target()
                .unwrap(),
            merged
        );
        assert_eq!(
            local.head().unwrap().peel_to_commit().unwrap().id(),
            first,
            "fetch must not move HEAD"
        );

        let pulled = pull_ff_only(&local_dir, "origin", &no_auth()).unwrap();
        assert_eq!(pulled.behind, 0);
        assert_eq!(pulled.ahead, 0);
        let local = Repository::open(&local_dir).unwrap();
        assert_eq!(
            local.head().unwrap().peel_to_commit().unwrap().id(),
            merged
        );
        assert_eq!(
            std::fs::read_to_string(local_dir.join("a.txt")).unwrap(),
            "merged"
        );
    }

    #[test]
    fn pull_named_base_after_merge_while_on_variant() {
        let root = tempfile::TempDir::new().unwrap();
        let origin_dir = root.path().join("origin");
        let local_dir = root.path().join("local");
        std::fs::create_dir_all(&origin_dir).unwrap();

        let origin = Repository::init(&origin_dir).unwrap();
        let first = write_commit(&origin, &origin_dir, "a.txt", "one", "root");
        let trunk = trunk_name(&origin);

        git2::build::RepoBuilder::new()
            .clone(origin_dir.to_str().unwrap(), &local_dir)
            .unwrap();
        let local = Repository::open(&local_dir).unwrap();
        {
            let mut branch = local.find_branch(&trunk, git2::BranchType::Local).unwrap();
            branch.set_upstream(Some(&format!("origin/{trunk}"))).unwrap();
        }
        let feature_commit = local.find_commit(first).unwrap();
        local.branch("pr-1", &feature_commit, false).unwrap();
        local.set_head("refs/heads/pr-1").unwrap();
        local
            .checkout_head(Some(git2::build::CheckoutBuilder::new().safe()))
            .unwrap();

        let merged = write_commit(&origin, &origin_dir, "a.txt", "merged", "merge request");

        let noop = pull_ff_only(&local_dir, "origin", &no_auth()).unwrap();
        assert_eq!(noop.behind, 0);
        let local = Repository::open(&local_dir).unwrap();
        assert_eq!(
            local
                .find_reference(&format!("refs/heads/{trunk}"))
                .unwrap()
                .target()
                .unwrap(),
            first,
            "pull of the current variant must not move the merged base"
        );

        pull_ff_branch(&local_dir, "origin", Some(&trunk), &no_auth()).unwrap();
        let local = Repository::open(&local_dir).unwrap();
        assert_eq!(
            local.head().unwrap().shorthand(),
            Some("pr-1"),
            "stay on the variant after syncing the base"
        );
        assert_eq!(
            local
                .find_reference(&format!("refs/heads/{trunk}"))
                .unwrap()
                .target()
                .unwrap(),
            merged
        );
        assert_eq!(
            std::fs::read_to_string(local_dir.join("a.txt")).unwrap(),
            "one",
            "worktree stays on the variant"
        );
    }
}
