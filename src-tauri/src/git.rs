use crate::error::{AppError, Result};
use crate::graph::{
    layout_timeline, RawCommit, RawRef, RefKind, Timeline,
};
use git2::{
    build::CheckoutBuilder, DiffOptions, ObjectType, Repository, Signature, Status,
    StatusOptions,
};
use serde::Serialize;
use std::path::Path;

const MAX_COMMITS: usize = 2500;

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
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusPayload {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetail {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub body: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub files: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub tip: String,
    pub is_head: bool,
}

pub fn open_repo(path: &Path) -> Result<RepoSummary> {
    let repo = Repository::discover(path)?;
    summary(&repo)
}

pub fn load_timeline(path: &Path) -> Result<Timeline> {
    let repo = Repository::discover(path)?;
    let (commits, refs, head, sacred_hint) = collect_raw(&repo)?;
    Ok(layout_timeline(commits, refs, head, sacred_hint))
}

pub fn load_status(path: &Path) -> Result<StatusPayload> {
    let repo = Repository::discover(path)?;
    status_of(&repo)
}

pub fn load_commit(path: &Path, sha: &str) -> Result<CommitDetail> {
    let repo = Repository::discover(path)?;
    let oid = repo.revparse_single(sha)?.id();
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let parent_tree = commit.parents().next().and_then(|p| p.tree().ok());
    let mut opts = DiffOptions::new();
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;

    let mut files = Vec::new();
    diff.foreach(
        &mut |delta, _| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|| "?".into());
            files.push(FileChange {
                path,
                status: delta_status(delta.status()),
            });
            true
        },
        None,
        None,
        None,
    )?;

    let message = commit.message().unwrap_or("").to_string();
    let summary = commit.summary().unwrap_or("").to_string();
    let body = message
        .strip_prefix(&summary)
        .unwrap_or("")
        .trim()
        .to_string();
    let author = commit.author();
    let author_name = author.name().unwrap_or("unknown").to_string();
    let email = author.email().unwrap_or("").to_string();
    let timestamp = commit.time().seconds();
    let parents: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();
    let id = commit.id().to_string();

    Ok(CommitDetail {
        id: id.clone(),
        short_id: short_oid(&id),
        summary,
        body,
        author: author_name,
        email,
        timestamp,
        parents,
        files,
    })
}

pub fn list_branches(path: &Path) -> Result<Vec<BranchInfo>> {
    let repo = Repository::discover(path)?;
    let head_name = current_branch(&repo);
    let mut out = Vec::new();
    for branch in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();
        let tip = branch
            .get()
            .peel_to_commit()
            .map(|c| c.id().to_string())
            .unwrap_or_default();
        let is_head = head_name.as_deref() == Some(name.as_str());
        out.push(BranchInfo { name, tip, is_head });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn checkout_branch(path: &Path, name: &str) -> Result<RepoSummary> {
    let repo = Repository::discover(path)?;
    let refname = format!("refs/heads/{name}");
    repo.find_reference(&refname)
        .map_err(|_| AppError::msg(format!("unknown variant '{name}'")))?;
    repo.set_head(&refname)?;
    repo.checkout_head(Some(CheckoutBuilder::new().safe()))?;
    summary(&repo)
}

pub fn stage_path(path: &Path, rel: &str) -> Result<StatusPayload> {
    let repo = Repository::discover(path)?;
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
    let repo = Repository::discover(path)?;
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

pub fn commit_changes(path: &Path, message: &str) -> Result<String> {
    let message = message.trim();
    if message.is_empty() {
        return Err(AppError::msg("a case note is required"));
    }
    let repo = Repository::discover(path)?;
    let status = status_of(&repo)?;
    if status.staged.is_empty() {
        return Err(AppError::msg("nothing staged to file"));
    }
    let sig = repo
        .signature()
        .or_else(|_| Signature::now("Timestream", "timestream@local"))?;
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.as_ref().into_iter().collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    Ok(oid.to_string())
}

fn summary(repo: &Repository) -> Result<RepoSummary> {
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

fn current_branch(repo: &Repository) -> Option<String> {
    let head = repo.head().ok()?;
    if head.is_branch() {
        head.shorthand().map(|s| s.to_string())
    } else {
        None
    }
}

fn collect_raw(
    repo: &Repository,
) -> Result<(Vec<RawCommit>, Vec<RawRef>, Option<String>, Option<String>)> {
    let mut walk = repo.revwalk()?;
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

    let mut refs = Vec::new();
    for reference in repo.references()? {
        let reference = reference?;
        if reference.is_remote() {
            continue;
        }
        let Ok(commit) = reference.peel_to_commit() else {
            continue;
        };
        let _ = walk.push(commit.id());
        let Some(name) = reference.shorthand() else {
            continue;
        };
        let kind = if reference.is_branch() {
            RefKind::Branch
        } else if reference.is_tag() {
            RefKind::Tag
        } else {
            continue;
        };
        refs.push(RawRef {
            name: name.to_string(),
            target: commit.id().to_string(),
            kind,
        });
    }
    if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            let _ = walk.push(commit.id());
        }
    }

    let mut commits = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for oid in walk {
        let oid = oid?;
        if !seen.insert(oid) {
            continue;
        }
        let commit = repo.find_commit(oid)?;
        commits.push(RawCommit {
            id: oid.to_string(),
            parents: commit.parent_ids().map(|id| id.to_string()).collect(),
            timestamp: commit.time().seconds(),
            summary: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
        });
        if commits.len() >= MAX_COMMITS {
            break;
        }
    }

    let head = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id().to_string());
    let sacred_hint = current_branch(repo)
        .filter(|b| b == "main" || b == "master")
        .or_else(|| {
            refs.iter()
                .find(|r| r.kind == RefKind::Branch && (r.name == "main" || r.name == "master"))
                .map(|r| r.name.clone())
        })
        .or_else(|| current_branch(repo));

    Ok((commits, refs, head, sacred_hint))
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
        let path = entry
            .path()
            .unwrap_or("?")
            .replace('\\', "/");
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
                status: index_status(st),
            });
        }
        if st.intersects(
            Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        ) {
            unstaged.push(FileChange {
                path: path.clone(),
                status: wt_status(st),
            });
        }
        if st.contains(Status::WT_NEW) {
            untracked.push(FileChange {
                path,
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

fn index_status(st: Status) -> String {
    if st.contains(Status::INDEX_NEW) {
        "added"
    } else if st.contains(Status::INDEX_DELETED) {
        "deleted"
    } else if st.contains(Status::INDEX_RENAMED) {
        "renamed"
    } else {
        "modified"
    }
    .into()
}

fn wt_status(st: Status) -> String {
    if st.contains(Status::WT_DELETED) {
        "deleted"
    } else if st.contains(Status::WT_RENAMED) {
        "renamed"
    } else {
        "modified"
    }
    .into()
}

fn delta_status(status: git2::Delta) -> String {
    match status {
        git2::Delta::Added => "added",
        git2::Delta::Deleted => "deleted",
        git2::Delta::Renamed => "renamed",
        git2::Delta::Copied => "copied",
        _ => "modified",
    }
    .into()
}

fn normalize_rel(rel: &str) -> Result<String> {
    let cleaned = rel.replace('\\', "/");
    if cleaned.is_empty() || cleaned.starts_with('/') || cleaned.contains("..") {
        return Err(AppError::msg("invalid path"));
    }
    Ok(cleaned)
}

fn short_oid(id: &str) -> String {
    id.chars().take(7).collect()
}

fn dunce_like(path: &Path) -> String {
    let raw = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf());
    let text = raw.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(&text)
        .replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::tests::assert_invariants;
    use git2::Time;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    struct Harness {
        _dir: TempDir,
        path: PathBuf,
        repo: Repository,
        clock: i64,
        trunk: String,
    }

    impl Harness {
        fn new() -> Self {
            let dir = TempDir::new().unwrap();
            let repo = Repository::init(dir.path()).unwrap();
            let mut cfg = repo.config().unwrap();
            cfg.set_str("user.name", "Analyst").unwrap();
            cfg.set_str("user.email", "analyst@tva.local").unwrap();
            Self {
                path: dir.path().to_path_buf(),
                _dir: dir,
                repo,
                clock: 1_700_000_000,
                trunk: String::new(),
            }
        }

        fn commit(&mut self, file: &str, contents: &str, message: &str) -> String {
            fs::write(self.path.join(file), contents).unwrap();
            let mut index = self.repo.index().unwrap();
            index.add_path(Path::new(file)).unwrap();
            index.write().unwrap();
            let tree_id = index.write_tree().unwrap();
            let tree = self.repo.find_tree(tree_id).unwrap();
            let sig = Signature::new(
                "Analyst",
                "analyst@tva.local",
                &Time::new(self.clock, 0),
            )
            .unwrap();
            self.clock += 60;
            let parent = self.repo.head().ok().and_then(|h| h.peel_to_commit().ok());
            let parents: Vec<&git2::Commit> = parent.as_ref().into_iter().collect();
            let oid = self
                .repo
                .commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
                .unwrap()
                .to_string();
            if self.trunk.is_empty() {
                if let Some(name) = current_branch(&self.repo) {
                    self.trunk = name;
                }
            }
            oid
        }

        fn branch_from(&self, name: &str, sha: &str) {
            let oid = git2::Oid::from_str(sha).unwrap();
            let commit = self.repo.find_commit(oid).unwrap();
            self.repo.branch(name, &commit, false).unwrap();
        }

        fn checkout(&self, name: &str) {
            checkout_branch(&self.path, name).unwrap();
        }

        fn trunk(&self) -> String {
            if self.trunk.is_empty() {
                current_branch(&self.repo).unwrap_or_else(|| "master".into())
            } else {
                self.trunk.clone()
            }
        }
    }

    #[test]
    fn rejects_non_repo() {
        let dir = TempDir::new().unwrap();
        assert!(open_repo(dir.path()).is_err());
    }

    #[test]
    fn open_linear_and_inspect_commit() {
        let mut h = Harness::new();
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
        assert!(detail.files.iter().any(|f| f.path == "readme.txt"));
    }

    #[test]
    fn many_branches_have_unique_tip_lanes() {
        let mut h = Harness::new();
        let nexus = h.commit("base.txt", "nexus", "nexus");
        h.commit("main.txt", "sacred", "sacred tip");
        for i in 1..=8 {
            h.branch_from(&format!("var-{i}"), &nexus);
            h.checkout(&format!("var-{i}"));
            h.commit(&format!("v{i}.txt"), "x", &format!("variant {i}"));
        }
        h.checkout(&h.trunk());

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert!(tl.dossiers.len() >= 9);

        let mut cols = std::collections::HashSet::new();
        for d in tl.dossiers.iter().filter(|d| !d.is_sacred) {
            let node = tl.nodes.iter().find(|n| n.id == d.tip).unwrap();
            assert_ne!(node.column, 0, "{} stayed on sacred", d.name);
            assert!(cols.insert(node.column), "lane reuse for {}", d.name);
        }
        assert_eq!(cols.len(), 8);
    }

    #[test]
    fn long_diverged_histories_keep_stable_lanes() {
        let mut h = Harness::new();
        let root = h.commit("root.txt", "root", "root");
        for i in 1..=20 {
            h.commit("main.txt", &format!("s{i}"), &format!("sacred {i}"));
        }
        h.branch_from("long-feature", &root);
        h.checkout("long-feature");
        let mut variant_tips = Vec::new();
        for i in 1..=20 {
            variant_tips.push(h.commit(
                "feat.txt",
                &format!("v{i}"),
                &format!("variant {i}"),
            ));
        }
        h.checkout(&h.trunk());

        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);

        assert_eq!(tl.sacred_branch.as_deref(), Some(h.trunk().as_str()));
        let mut sacred_cols = std::collections::HashSet::new();
        let mut cursor = tl
            .dossiers
            .iter()
            .find(|d| d.is_sacred)
            .map(|d| d.tip.clone())
            .expect("sacred dossier");
        loop {
            let node = tl.nodes.iter().find(|n| n.id == cursor).unwrap();
            sacred_cols.insert(node.column);
            match node.parents.first() {
                Some(parent) => cursor = parent.clone(),
                None => break,
            }
        }
        assert_eq!(sacred_cols, std::collections::HashSet::from([0]));

        let variant_cols: std::collections::HashSet<_> = tl
            .nodes
            .iter()
            .filter(|n| n.summary.starts_with("variant"))
            .map(|n| n.column)
            .collect();
        assert_eq!(variant_cols.len(), 1);
        assert!(!variant_cols.contains(&0));

        let dossier = tl
            .dossiers
            .iter()
            .find(|d| d.name == "long-feature")
            .unwrap();
        assert_eq!(dossier.exclusive_commits, 20);
        assert!(dossier.commits_apart >= 40);
        assert_eq!(
            dossier.threat,
            crate::graph::ThreatLevel::Severe
        );
    }

    #[test]
    fn merge_and_checkout_roundtrip() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        h.branch_from("feature", &h.repo.head().unwrap().peel_to_commit().unwrap().id().to_string());
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
        let feature_commit = h.repo.find_commit(git2::Oid::from_str(&feature_tip).unwrap()).unwrap();
        let head = h.repo.head().unwrap().peel_to_commit().unwrap();
        let mut index = h.repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = h.repo.find_tree(tree_id).unwrap();
        let sig = Signature::new("Analyst", "analyst@tva.local", &Time::new(h.clock, 0)).unwrap();
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
        assert!(tl.edges.iter().any(|e| matches!(e.kind, crate::graph::EdgeKind::Merge)));

        let after = checkout_branch(&h.path, "feature").unwrap();
        assert_eq!(after.branch.as_deref(), Some("feature"));
        let back = checkout_branch(&h.path, &trunk).unwrap();
        assert_eq!(back.branch.as_deref(), Some(trunk.as_str()));
    }

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

        let sha = commit_changes(&h.path, "file the anomaly").unwrap();
        let tl = load_timeline(&h.path).unwrap();
        assert_invariants(&tl);
        assert_eq!(tl.nodes.len(), 2);
        assert_eq!(tl.head.as_deref(), Some(sha.as_str()));
        assert!(load_status(&h.path).unwrap().staged.is_empty());
    }
}
