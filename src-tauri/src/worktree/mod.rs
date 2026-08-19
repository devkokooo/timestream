use crate::error::{AppError, Result};
use crate::git::{discover, index_status, normalize_rel, wt_status, FileChange};
use git2::{ObjectType, Repository, Signature, Status, StatusOptions};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusPayload {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<FileChange>,
}

pub fn load_status(path: &Path) -> Result<StatusPayload> {
    let repo = discover(path)?;
    status_of(&repo)
}

pub fn stage_path(path: &Path, rel: &str) -> Result<StatusPayload> {
    let repo = discover(path)?;
    let mut index = repo.index()?;
    let rel = normalize_rel(rel)?;
    if repo
        .status_file(Path::new(&rel))
        .map(|s| s.is_wt_deleted() || s.is_index_deleted())
        .unwrap_or(false)
    {
        let _ = index.remove_path(Path::new(&rel));
    } else {
        index.add_path(Path::new(&rel))?;
    }
    index.write()?;
    status_of(&repo)
}

pub fn unstage_path(path: &Path, rel: &str) -> Result<StatusPayload> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    match repo.head() {
        Ok(head) => {
            let obj = head.peel(ObjectType::Commit)?;
            repo.reset_default(Some(&obj), [Path::new(&rel)])?;
        }
        Err(_) => {
            let mut index = repo.index()?;
            let _ = index.remove_path(Path::new(&rel));
            index.write()?;
        }
    }
    status_of(&repo)
}

pub fn commit_changes(path: &Path, message: &str, amend: bool) -> Result<String> {
    let message = message.trim();
    if message.is_empty() {
        return Err(AppError::msg("a case note is required"));
    }
    let repo = discover(path)?;
    let status = status_of(&repo)?;
    if !amend && status.staged.is_empty() {
        return Err(AppError::msg("nothing staged to file"));
    }
    let committer = repo
        .signature()
        .or_else(|_| Signature::now("Timestream", "timestream@local"))?;
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    if amend {
        return amend_head(&repo, message, &tree, &committer);
    }

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.as_ref().into_iter().collect();
    let oid = repo.commit(
        Some("HEAD"),
        &committer,
        &committer,
        message,
        &tree,
        &parents,
    )?;
    Ok(oid.to_string())
}

fn amend_head(
    repo: &Repository,
    message: &str,
    tree: &git2::Tree,
    committer: &Signature,
) -> Result<String> {
    let head_ref = repo
        .head()
        .map_err(|_| AppError::msg("nothing to revise"))?;
    if !head_ref.is_branch() {
        return Err(AppError::msg("cannot revise a detached HEAD"));
    }
    let ref_name = head_ref
        .name()
        .ok_or_else(|| AppError::msg("HEAD has no name"))?
        .to_string();
    ensure_head_unpublished(repo)?;
    let head = head_ref.peel_to_commit()?;
    let author = head.author();
    let parents: Vec<git2::Commit> = head.parents().collect();
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
    let oid = repo.commit(None, &author, committer, message, tree, &parent_refs)?;
    repo.reference(&ref_name, oid, true, "revise last filing")?;
    Ok(oid.to_string())
}

fn ensure_head_unpublished(repo: &Repository) -> Result<()> {
    let head = repo
        .head()
        .map_err(|_| AppError::msg("nothing to revise"))?;
    if !head.is_branch() {
        return Err(AppError::msg("cannot revise a detached HEAD"));
    }
    let local = head
        .target()
        .ok_or_else(|| AppError::msg("HEAD has no target"))?;
    let branch = git2::Branch::wrap(head);
    match branch.upstream() {
        Ok(up) => {
            let remote_oid = up
                .get()
                .target()
                .ok_or_else(|| AppError::msg("upstream has no target"))?;
            let (ahead, _) = repo.graph_ahead_behind(local, remote_oid)?;
            if ahead == 0 {
                return Err(AppError::msg(
                    "cannot revise a filing that has already been uploaded",
                ));
            }
            Ok(())
        }
        Err(_) => Ok(()),
    }
}

fn status_of(repo: &Repository) -> Result<StatusPayload> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts))?;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("?").replace('\\', "/");
        let st = entry.status();
        if st.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            staged.push(FileChange {
                path: path.clone(),
                old_path: None,
                status: index_status(st),
            });
        }
        if st.intersects(
            Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_RENAMED | Status::WT_TYPECHANGE,
        ) {
            unstaged.push(FileChange {
                path: path.clone(),
                old_path: None,
                status: wt_status(st),
            });
        }
        if st.contains(Status::WT_NEW) {
            untracked.push(FileChange {
                path,
                old_path: None,
                status: "untracked".into(),
            });
        }
    }
    Ok(StatusPayload {
        staged,
        unstaged,
        untracked,
    })
}

#[tauri::command]
pub fn get_status(path: String) -> Result<StatusPayload> {
    load_status(&PathBuf::from(path))
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
pub fn file_commit(path: String, message: String, amend: Option<bool>) -> Result<String> {
    commit_changes(&PathBuf::from(path), &message, amend.unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::Harness;
    use crate::timeline::graph::tests::assert_invariants;
    use crate::timeline::walk::load_timeline;
    use std::fs;

    #[test]
    fn stage_and_commit_extends_timeline() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        fs::write(h.path.join("anomaly.txt"), "detected").unwrap();

        let dirty = load_status(&h.path).unwrap();
        assert!(dirty.untracked.iter().any(|f| f.path == "anomaly.txt"));

        stage_path(&h.path, "anomaly.txt").unwrap();
        let staged = load_status(&h.path).unwrap();
        assert!(staged.staged.iter().any(|f| f.path == "anomaly.txt"));
        assert!(staged.untracked.is_empty());

        let sha = commit_changes(&h.path, "file the anomaly", false).unwrap();
        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert_eq!(tl.nodes.len(), 2);
        assert_eq!(tl.head.as_deref(), Some(sha.as_str()));
        assert!(load_status(&h.path).unwrap().staged.is_empty());
    }

    #[test]
    fn amend_folds_staged_file_into_unpublished_head() {
        let mut h = Harness::new();
        let root = h.commit("a.txt", "a", "root");
        let first = h.commit("b.txt", "b", "incomplete filing");
        fs::write(h.path.join("left-out.txt"), "oops").unwrap();
        stage_path(&h.path, "left-out.txt").unwrap();

        let sha = commit_changes(&h.path, "complete filing", true).unwrap();
        assert_ne!(sha, first);
        let head = h.repo.head().unwrap().peel_to_commit().unwrap();
        assert_eq!(head.id().to_string(), sha);
        assert_eq!(head.parent_id(0).unwrap().to_string(), root);
        assert_eq!(head.message().unwrap(), "complete filing");
        assert!(head.tree().unwrap().get_name("left-out.txt").is_some());
        assert!(h
            .repo
            .find_commit(git2::Oid::from_str(&first).unwrap())
            .is_ok());

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert_eq!(tl.head.as_deref(), Some(sha.as_str()));
        assert!(!tl.nodes.iter().any(|n| n.id == first));
        assert!(load_status(&h.path).unwrap().staged.is_empty());
    }

    #[test]
    fn amend_allows_message_only_when_unpublished() {
        let mut h = Harness::new();
        let first = h.commit("a.txt", "a", "typo filing");
        let sha = commit_changes(&h.path, "fixed filing", true).unwrap();
        assert_ne!(sha, first);
        let head = h.repo.head().unwrap().peel_to_commit().unwrap();
        assert_eq!(head.id().to_string(), sha);
        assert_eq!(head.message().unwrap(), "fixed filing");
        assert!(head.tree().unwrap().get_name("a.txt").is_some());
    }

    #[test]
    fn amend_rejects_published_head() {
        let mut h = Harness::new();
        let tip = h.commit("a.txt", "a", "root");
        let trunk = h.trunk();
        let oid = git2::Oid::from_str(&tip).unwrap();
        h.repo
            .remote("origin", "https://example.com/tva/archive.git")
            .unwrap();
        h.repo
            .reference(
                &format!("refs/remotes/origin/{trunk}"),
                oid,
                true,
                "test remote",
            )
            .unwrap();
        let mut branch = h.repo.find_branch(&trunk, git2::BranchType::Local).unwrap();
        branch
            .set_upstream(Some(&format!("origin/{trunk}")))
            .unwrap();

        let err = commit_changes(&h.path, "revise", true).unwrap_err();
        assert!(err.to_string().contains("already been uploaded"), "{err}");
        assert_eq!(
            h.repo
                .head()
                .unwrap()
                .peel_to_commit()
                .unwrap()
                .id()
                .to_string(),
            tip
        );
    }

    #[test]
    fn amend_rejects_empty_repo_and_detached_head() {
        let empty = Harness::new();
        let err = commit_changes(&empty.path, "revise", true).unwrap_err();
        assert!(err.to_string().contains("nothing to revise"), "{err}");

        let mut h = Harness::new();
        let tip = h.commit("a.txt", "a", "root");
        h.repo
            .set_head_detached(git2::Oid::from_str(&tip).unwrap())
            .unwrap();
        let err = commit_changes(&h.path, "revise", true).unwrap_err();
        assert!(err.to_string().contains("detached HEAD"), "{err}");
    }
}
