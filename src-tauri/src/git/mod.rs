use crate::error::{AppError, Result};
use git2::{DiffDelta, DiffFile, Repository, Status};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[cfg(test)]
pub(crate) mod test_support;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSummary {
    pub path: String,
    pub name: String,
    pub head: Option<String>,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
}

pub fn open_repo(path: &Path) -> Result<RepoSummary> {
    let repo = discover(path)?;
    summary(&repo)
}

pub(crate) fn discover(path: &Path) -> Result<Repository> {
    Ok(Repository::discover(path)?)
}

pub(crate) fn summary(repo: &Repository) -> Result<RepoSummary> {
    let workdir = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .ok_or_else(|| AppError::msg("repository has no workdir"))?;
    let path = dunce_like(workdir);
    let name = Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    Ok(RepoSummary {
        path,
        name,
        head: repo.head().ok().and_then(|h| h.target().map(|o| o.to_string())),
        branch: current_branch(repo),
    })
}

pub(crate) fn current_branch(repo: &Repository) -> Option<String> {
    let head = repo.head().ok()?;
    if head.is_branch() {
        head.shorthand().map(|s| s.to_string())
    } else {
        None
    }
}

pub(crate) fn dunce_like(path: &Path) -> String {
    let raw = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf());
    let text = raw.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(&text)
        .replace('\\', "/")
}

pub(crate) fn normalize_rel(rel: &str) -> Result<String> {
    let cleaned = rel.replace('\\', "/");
    if cleaned.is_empty() || cleaned.starts_with('/') || cleaned.contains("..") {
        return Err(AppError::msg("invalid path"));
    }
    Ok(cleaned)
}

pub(crate) fn short_oid(id: &str) -> String {
    id.chars().take(7).collect()
}

pub(crate) fn delta_status(status: git2::Delta) -> String {
    match status {
        git2::Delta::Added | git2::Delta::Untracked => "added",
        git2::Delta::Deleted => "deleted",
        git2::Delta::Renamed | git2::Delta::Copied => "moved",
        _ => "modified",
    }
    .into()
}

pub(crate) fn delta_path(file: &DiffFile<'_>) -> Option<String> {
    file.path()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .filter(|p| !p.is_empty())
}

pub(crate) fn file_change_from_delta(delta: &DiffDelta<'_>) -> FileChange {
    let new_path = delta_path(&delta.new_file());
    let old_path = delta_path(&delta.old_file());
    let status = delta_status(delta.status());
    let path = new_path
        .clone()
        .or_else(|| old_path.clone())
        .unwrap_or_else(|| "?".into());
    let old_path = old_path.filter(|p| p != &path);
    FileChange {
        path,
        old_path,
        status,
    }
}

pub(crate) fn delta_matches(delta: &DiffDelta<'_>, rel: &str) -> bool {
    delta_path(&delta.new_file()).as_deref() == Some(rel)
        || delta_path(&delta.old_file()).as_deref() == Some(rel)
}

pub(crate) fn index_status(st: Status) -> String {
    if st.contains(Status::INDEX_NEW) {
        "added"
    } else if st.contains(Status::INDEX_DELETED) {
        "deleted"
    } else if st.contains(Status::INDEX_RENAMED) {
        "moved"
    } else {
        "modified"
    }
    .into()
}

pub(crate) fn wt_status(st: Status) -> String {
    if st.contains(Status::WT_DELETED) {
        "deleted"
    } else if st.contains(Status::WT_RENAMED) {
        "moved"
    } else {
        "modified"
    }
    .into()
}

#[tauri::command]
pub fn open_repository(path: String) -> Result<RepoSummary> {
    open_repo(&PathBuf::from(path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::branches::{checkout_branch, list_branches};
    use crate::timeline::graph::tests::assert_invariants;
    use crate::timeline::walk::{load_commit, load_timeline};
    use git2::Signature;
    use tempfile::TempDir;

    #[test]
    fn rejects_non_repo() {
        let dir = TempDir::new().unwrap();
        assert!(open_repo(dir.path()).is_err());
    }

    #[test]
    fn open_linear_and_inspect_commit() {
        let mut h = test_support::Harness::new();
        h.commit("readme.txt", "one", "root");
        let tip = h.commit("readme.txt", "two", "second");
        let summary = open_repo(&h.path).unwrap();
        assert_eq!(summary.branch.as_deref(), Some(h.trunk().as_str()));
        assert_eq!(summary.head.as_deref(), Some(tip.as_str()));

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert_eq!(tl.nodes.len(), 2);
        assert!(tl.nodes.iter().all(|n| n.column == 0));

        let detail = load_commit(&h.path, &tip).unwrap();
        assert_eq!(detail.summary, "second");
        assert_eq!(detail.author, "Analyst");
        assert_eq!(detail.committer, "Analyst");
        assert_eq!(detail.committer_email, "analyst@tva.local");
        assert!(!detail.signed);
        assert!(detail.signature_kind.is_none());
        assert!(detail.files.iter().any(|f| f.path == "readme.txt"));
    }

    #[test]
    fn merge_and_checkout_roundtrip() {
        let mut h = test_support::Harness::new();
        h.commit("a.txt", "a", "root");
        h.branch_from(
            "feature",
            &h.repo
                .head()
                .unwrap()
                .peel_to_commit()
                .unwrap()
                .id()
                .to_string(),
        );
        h.commit("main.txt", "m", "on sacred");
        h.checkout("feature");
        h.commit("feat.txt", "f", "on variant");
        let trunk = h.trunk();
        h.checkout(&trunk);

        let feature_tip = list_branches(&h.path)
            .unwrap()
            .into_iter()
            .find(|b| b.name == "feature")
            .unwrap()
            .tip;
        let feature_commit = h
            .repo
            .find_commit(git2::Oid::from_str(&feature_tip).unwrap())
            .unwrap();
        let head = h.repo.head().unwrap().peel_to_commit().unwrap();
        let mut index = h.repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = h.repo.find_tree(tree_id).unwrap();
        let sig = Signature::new("Analyst", "analyst@tva.local", &git2::Time::new(h.clock, 0))
            .unwrap();
        h.repo
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                "merge variant",
                &tree,
                &[&head, &feature_commit],
            )
            .unwrap();

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert!(tl
            .edges
            .iter()
            .any(|e| matches!(e.kind, crate::timeline::EdgeKind::Merge)));

        let after = checkout_branch(&h.path, "feature").unwrap();
        assert_eq!(after.branch.as_deref(), Some("feature"));
        let back = checkout_branch(&h.path, &trunk).unwrap();
        assert_eq!(back.branch.as_deref(), Some(trunk.as_str()));
    }
}
