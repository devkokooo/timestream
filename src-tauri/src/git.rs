use crate::error::{AppError, Result};
use crate::graph::{
    layout_timeline, RawCommit, RawRef, RefKind, Timeline,
};
use git2::{
    build::CheckoutBuilder, DiffOptions, ObjectType, Repository, Signature, Status,
    StatusOptions,
};
use serde::Serialize;
use std::cell::RefCell;
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
    pub old_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String,
    pub old_no: Option<u32>,
    pub new_no: Option<u32>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub binary: bool,
    pub hunks: Vec<DiffHunk>,
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

#[allow(dead_code)]
pub fn load_timeline(path: &Path) -> Result<Timeline> {
    load_timeline_opts(path, true)
}

pub fn load_timeline_opts(path: &Path, show_upstream: bool) -> Result<Timeline> {
    let repo = Repository::discover(path)?;
    let (commits, refs, head, sacred_hint) = collect_raw(&repo, show_upstream)?;
    Ok(layout_timeline(commits, refs, head, sacred_hint))
}

pub fn load_status(path: &Path) -> Result<StatusPayload> {
    let repo = Repository::discover(path)?;
    status_of(&repo)
}

pub fn load_commit(path: &Path, sha: &str) -> Result<CommitDetail> {
    let repo = Repository::discover(path)?;
    let (commit, diff) = diff_for_commit(&repo, sha)?;

    let mut files = Vec::new();
    diff.foreach(
        &mut |delta, _| {
            files.push(file_change_from_delta(&delta));
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

pub fn load_file_diff(path: &Path, sha: &str, rel: &str) -> Result<FileDiff> {
    let repo = Repository::discover(path)?;
    let rel = normalize_rel(rel)?;
    let (_commit, diff) = diff_for_commit(&repo, sha)?;
    collect_file_diff(&diff, &rel)
}

/// Working-tree variance: `staged` compares index↔HEAD; otherwise workdir↔index
/// (including untracked content).
pub fn load_worktree_diff(path: &Path, rel: &str, staged: bool) -> Result<FileDiff> {
    let repo = Repository::discover(path)?;
    let rel = normalize_rel(rel)?;
    let diff = if staged {
        staged_diff(&repo)?
    } else {
        unstaged_diff(&repo)?
    };
    collect_file_diff(&diff, &rel)
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

pub fn create_branch(path: &Path, name: &str) -> Result<RepoSummary> {
    let repo = Repository::discover(path)?;
    let commit = repo
        .head()?
        .peel_to_commit()
        .map_err(|_| AppError::msg("HEAD has no commit"))?;
    repo.branch(name, &commit, false)?;
    checkout_branch(path, name)
}

pub fn create_tag(path: &Path, name: &str, sha: &str, message: Option<&str>) -> Result<()> {
    let repo = Repository::discover(path)?;
    let obj = repo.revparse_single(sha)?;
    if let Some(message) = message.filter(|m| !m.trim().is_empty()) {
        let sig = repo
            .signature()
            .or_else(|_| Signature::now("Timestream", "timestream@local"))?;
        repo.tag(name, &obj, &sig, message, false)?;
    } else {
        repo.tag_lightweight(name, &obj, false)?;
    }
    Ok(())
}

pub fn delete_tag(path: &Path, name: &str) -> Result<()> {
    let repo = Repository::discover(path)?;
    repo.tag_delete(name)?;
    Ok(())
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
    show_upstream: bool,
) -> Result<(Vec<RawCommit>, Vec<RawRef>, Option<String>, Option<String>)> {
    let mut walk = repo.revwalk()?;
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

    let mut refs = Vec::new();
    for reference in repo.references()? {
        let reference = reference?;
        if reference.is_remote() {
            if !show_upstream {
                continue;
            }
            let Ok(commit) = reference.peel_to_commit() else {
                continue;
            };
            let _ = walk.push(commit.id());
            let Some(name) = reference.shorthand() else {
                continue;
            };
            refs.push(RawRef {
                name: name.to_string(),
                target: commit.id().to_string(),
                kind: RefKind::Remote,
            });
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
                old_path: None,
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

fn index_status(st: Status) -> String {
    if st.contains(Status::INDEX_NEW) {
        "added"
    } else if st.contains(Status::INDEX_DELETED) {
        "deleted"
    } else     if st.contains(Status::INDEX_RENAMED) {
        "moved"
    } else {
        "modified"
    }
    .into()
}

fn wt_status(st: Status) -> String {
    if st.contains(Status::WT_DELETED) {
        "deleted"
    } else     if st.contains(Status::WT_RENAMED) {
        "moved"
    } else {
        "modified"
    }
    .into()
}

fn delta_status(status: git2::Delta) -> String {
    match status {
        git2::Delta::Added | git2::Delta::Untracked => "added",
        git2::Delta::Deleted => "deleted",
        git2::Delta::Renamed | git2::Delta::Copied => "moved",
        _ => "modified",
    }
    .into()
}

fn delta_path(file: &git2::DiffFile<'_>) -> Option<String> {
    file.path()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .filter(|p| !p.is_empty())
}

fn file_change_from_delta(delta: &git2::DiffDelta<'_>) -> FileChange {
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

fn delta_matches(delta: &git2::DiffDelta<'_>, rel: &str) -> bool {
    delta_path(&delta.new_file()).as_deref() == Some(rel)
        || delta_path(&delta.old_file()).as_deref() == Some(rel)
}

fn diff_for_commit<'repo>(
    repo: &'repo Repository,
    sha: &str,
) -> Result<(git2::Commit<'repo>, git2::Diff<'repo>)> {
    let oid = repo.revparse_single(sha)?.id();
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let parent_tree = commit.parents().next().and_then(|p| p.tree().ok());
    let mut opts = DiffOptions::new();
    let mut diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;
    let mut find_opts = git2::DiffFindOptions::new();
    find_opts.renames(true);
    diff.find_similar(Some(&mut find_opts))?;
    Ok((commit, diff))
}

fn staged_diff<'repo>(repo: &'repo Repository) -> Result<git2::Diff<'repo>> {
    let head_tree = repo.head().ok().and_then(|head| head.peel_to_tree().ok());
    let mut opts = DiffOptions::new();
    let mut diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))?;
    let mut find_opts = git2::DiffFindOptions::new();
    find_opts.renames(true);
    diff.find_similar(Some(&mut find_opts))?;
    Ok(diff)
}

fn unstaged_diff<'repo>(repo: &'repo Repository) -> Result<git2::Diff<'repo>> {
    let mut opts = DiffOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show_untracked_content(true);
    Ok(repo.diff_index_to_workdir(None, Some(&mut opts))?)
}

struct DiffCollector {
    wanted: String,
    found: bool,
    binary: bool,
    path: String,
    old_path: Option<String>,
    status: String,
    hunks: Vec<DiffHunk>,
    current: Option<DiffHunk>,
}

impl DiffCollector {
    fn new(wanted: String) -> Self {
        Self {
            wanted,
            found: false,
            binary: false,
            path: String::new(),
            old_path: None,
            status: String::new(),
            hunks: Vec::new(),
            current: None,
        }
    }

    fn flush(&mut self) {
        if let Some(hunk) = self.current.take() {
            self.hunks.push(hunk);
        }
    }

    fn on_file(&mut self, delta: git2::DiffDelta<'_>) -> bool {
        self.flush();
        if !delta_matches(&delta, &self.wanted) {
            return true;
        }
        let change = file_change_from_delta(&delta);
        self.found = true;
        self.path = change.path;
        self.old_path = change.old_path;
        self.status = change.status;
        true
    }

    fn on_binary(&mut self, delta: git2::DiffDelta<'_>) -> bool {
        if delta_matches(&delta, &self.wanted) {
            self.binary = true;
        }
        true
    }

    fn on_hunk(&mut self, delta: git2::DiffDelta<'_>, hunk: git2::DiffHunk<'_>) -> bool {
        if !delta_matches(&delta, &self.wanted) {
            return true;
        }
        self.flush();
        self.current = Some(DiffHunk {
            old_start: hunk.old_start(),
            old_lines: hunk.old_lines(),
            new_start: hunk.new_start(),
            new_lines: hunk.new_lines(),
            header: String::from_utf8_lossy(hunk.header())
                .trim_end_matches(['\n', '\r'])
                .to_string(),
            lines: Vec::new(),
        });
        true
    }

    fn on_line(&mut self, delta: git2::DiffDelta<'_>, line: git2::DiffLine<'_>) -> bool {
        if !delta_matches(&delta, &self.wanted) {
            return true;
        }
        if let Some(hunk) = self.current.as_mut() {
            hunk.lines.push(DiffLine {
                kind: line_kind(line.origin()),
                old_no: line.old_lineno(),
                new_no: line.new_lineno(),
                text: String::from_utf8_lossy(line.content())
                    .trim_end_matches(['\n', '\r'])
                    .to_string(),
            });
        }
        true
    }
}

fn line_kind(origin: char) -> String {
    match origin {
        '+' => "addition",
        '-' => "deletion",
        ' ' | '=' => "context",
        _ => "meta",
    }
    .into()
}

fn collect_file_diff(diff: &git2::Diff<'_>, rel: &str) -> Result<FileDiff> {
    let collector = RefCell::new(DiffCollector::new(rel.to_string()));
    diff.foreach(
        &mut |delta, _| collector.borrow_mut().on_file(delta),
        Some(&mut |delta, _| collector.borrow_mut().on_binary(delta)),
        Some(&mut |delta, hunk| collector.borrow_mut().on_hunk(delta, hunk)),
        Some(&mut |delta, _, line| collector.borrow_mut().on_line(delta, line)),
    )?;
    let mut collector = collector.into_inner();
    collector.flush();
    if !collector.found {
        return Err(AppError::msg(format!("no variance recorded for '{rel}'")));
    }
    Ok(FileDiff {
        path: collector.path,
        old_path: collector.old_path,
        status: collector.status,
        binary: collector.binary,
        hunks: collector.hunks,
    })
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

        fn commit_tree(&mut self, message: &str) -> String {
            let mut index = self.repo.index().unwrap();
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

        fn commit(&mut self, file: &str, contents: &str, message: &str) -> String {
            if let Some(parent) = Path::new(file).parent() {
                if !parent.as_os_str().is_empty() {
                    fs::create_dir_all(self.path.join(parent)).unwrap();
                }
            }
            fs::write(self.path.join(file), contents).unwrap();
            let mut index = self.repo.index().unwrap();
            index.add_path(Path::new(file)).unwrap();
            index.write().unwrap();
            self.commit_tree(message)
        }

        fn rm(&mut self, file: &str, message: &str) -> String {
            fs::remove_file(self.path.join(file)).unwrap();
            let mut index = self.repo.index().unwrap();
            index.remove_path(Path::new(file)).unwrap();
            index.write().unwrap();
            self.commit_tree(message)
        }

        fn mv(&mut self, from: &str, to: &str, message: &str) -> String {
            if let Some(parent) = Path::new(to).parent() {
                if !parent.as_os_str().is_empty() {
                    fs::create_dir_all(self.path.join(parent)).unwrap();
                }
            }
            fs::rename(self.path.join(from), self.path.join(to)).unwrap();
            let mut index = self.repo.index().unwrap();
            index.remove_path(Path::new(from)).unwrap();
            index.add_path(Path::new(to)).unwrap();
            index.write().unwrap();
            self.commit_tree(message)
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

    #[test]
    fn file_diff_covers_modified_added_deleted_moved() {
        let mut h = Harness::new();
        h.commit("keep.txt", "alpha\nbeta\ngamma\n", "root");
        let added = h.commit("fresh.txt", "new record\n", "add file");
        let added_diff = load_file_diff(&h.path, &added, "fresh.txt").unwrap();
        assert_eq!(added_diff.status, "added");
        assert!(added_diff.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "addition" && line.text.contains("new record"))
        }));

        let edited = h.commit("keep.txt", "alpha\nBETA\ngamma\ndelta\n", "edit file");
        let edited_diff = load_file_diff(&h.path, &edited, "keep.txt").unwrap();
        assert_eq!(edited_diff.status, "modified");
        assert!(edited_diff.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "deletion" && line.text.contains("beta"))
        }));
        assert!(edited_diff.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "addition" && line.text.contains("BETA"))
        }));

        let deleted = h.rm("fresh.txt", "delete file");
        let deleted_diff = load_file_diff(&h.path, &deleted, "fresh.txt").unwrap();
        assert_eq!(deleted_diff.status, "deleted");
        assert!(deleted_diff.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "deletion" && line.text.contains("new record"))
        }));

        h.commit(
            "old-name.txt",
            "unique payload for rename detection 314159\n",
            "before move",
        );
        let moved = h.mv("old-name.txt", "new-name.txt", "move file");
        let detail = load_commit(&h.path, &moved).unwrap();
        let change = detail
            .files
            .iter()
            .find(|f| f.path == "new-name.txt")
            .expect("moved file listed");
        assert_eq!(change.status, "moved");
        assert_eq!(change.old_path.as_deref(), Some("old-name.txt"));

        let moved_diff = load_file_diff(&h.path, &moved, "new-name.txt").unwrap();
        assert_eq!(moved_diff.status, "moved");
        assert_eq!(moved_diff.old_path.as_deref(), Some("old-name.txt"));
        assert!(load_file_diff(&h.path, &moved, "missing.txt").is_err());
    }

    #[test]
    fn worktree_diff_covers_unstaged_staged_and_untracked() {
        let mut h = Harness::new();
        h.commit("keep.txt", "alpha\nbeta\n", "root");

        fs::write(h.path.join("keep.txt"), "alpha\nBETA\n").unwrap();
        let unstaged = load_worktree_diff(&h.path, "keep.txt", false).unwrap();
        assert_eq!(unstaged.status, "modified");
        assert!(unstaged.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "deletion" && line.text.contains("beta"))
        }));
        assert!(unstaged.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "addition" && line.text.contains("BETA"))
        }));
        assert!(load_worktree_diff(&h.path, "keep.txt", true).is_err());

        stage_path(&h.path, "keep.txt").unwrap();
        let staged = load_worktree_diff(&h.path, "keep.txt", true).unwrap();
        assert_eq!(staged.status, "modified");
        assert!(staged.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "addition" && line.text.contains("BETA"))
        }));
        assert!(load_worktree_diff(&h.path, "keep.txt", false).is_err());

        fs::write(h.path.join("fresh.txt"), "brand new\n").unwrap();
        let untracked = load_worktree_diff(&h.path, "fresh.txt", false).unwrap();
        assert_eq!(untracked.status, "added");
        assert!(untracked.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "addition" && line.text.contains("brand new"))
        }));
        assert!(load_worktree_diff(&h.path, "missing.txt", false).is_err());
    }

    #[test]
    fn remote_tracking_ref_appears_when_upstream_enabled() {
        let mut h = Harness::new();
        let root = h.commit("a.txt", "a", "root");
        h.branch_from("feature", &root);
        h.checkout("feature");
        let tip = h.commit("f.txt", "f", "on feature");
        let oid = git2::Oid::from_str(&tip).unwrap();
        h.repo
            .reference("refs/remotes/origin/feature", oid, true, "test remote")
            .unwrap();

        let hidden = load_timeline_opts(&h.path, false).unwrap();
        assert!(!hidden.nodes.iter().any(|n| {
            n.refs.iter().any(|r| r.kind == crate::graph::RefKind::Remote)
        }));

        let shown = load_timeline_opts(&h.path, true).unwrap();
        assert_invariants(&shown);
        assert!(shown.nodes.iter().any(|n| {
            n.refs.iter().any(|r| r.kind == crate::graph::RefKind::Remote && r.name == "origin/feature")
        }));
    }

    #[test]
    fn create_and_delete_lightweight_tag() {
        let mut h = Harness::new();
        let tip = h.commit("a.txt", "a", "root");
        create_tag(&h.path, "v1.0", &tip, None).unwrap();
        let tl = load_timeline(&h.path).unwrap();
        assert!(tl.nodes.iter().any(|n| n.refs.iter().any(|r| r.name == "v1.0")));
        delete_tag(&h.path, "v1.0").unwrap();
        let after = load_timeline(&h.path).unwrap();
        assert!(!after.nodes.iter().any(|n| n.refs.iter().any(|r| r.name == "v1.0")));
    }

    #[test]
    fn create_branch_from_head() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        let summary = create_branch(&h.path, "variant-x").unwrap();
        assert_eq!(summary.branch.as_deref(), Some("variant-x"));
    }
}
