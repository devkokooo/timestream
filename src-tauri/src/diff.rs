use crate::error::{AppError, Result};
use crate::git::{
    delta_matches, discover, file_change_from_delta, normalize_rel, short_oid, FileChange,
};
use git2::{DiffOptions, Repository};
use serde::Serialize;
use std::cell::RefCell;
use std::path::{Path, PathBuf};

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
pub struct RangeCommit {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RangeCompare {
    pub base: String,
    pub head: String,
    pub merge_base: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub commits: Vec<RangeCommit>,
    pub files: Vec<FileChange>,
}

const MAX_RANGE_COMMITS: usize = 250;

pub fn load_file_diff(path: &Path, sha: &str, rel: &str) -> Result<FileDiff> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    let (_commit, diff) = diff_for_commit(&repo, sha)?;
    collect_file_diff(&diff, &rel)
}

/// Working-tree variance: `staged` compares index↔HEAD; otherwise workdir↔index
/// (including untracked content).
pub fn load_worktree_diff(path: &Path, rel: &str, staged: bool) -> Result<FileDiff> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    let diff = if staged {
        staged_diff(&repo)?
    } else {
        unstaged_diff(&repo)?
    };
    collect_file_diff(&diff, &rel)
}

pub fn compare_refs(path: &Path, base: &str, head: &str) -> Result<RangeCompare> {
    let repo = discover(path)?;
    let (base_commit, head_commit, merge_base, diff) = range_diff(&repo, base, head)?;
    let (ahead, behind) = repo.graph_ahead_behind(head_commit.id(), base_commit.id())?;

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME)?;
    revwalk.push(head_commit.id())?;
    revwalk.hide(base_commit.id())?;

    let mut commits = Vec::new();
    for oid in revwalk {
        let commit = repo.find_commit(oid?)?;
        let id = commit.id().to_string();
        commits.push(RangeCommit {
            id: id.clone(),
            short_id: short_oid(&id),
            summary: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
        });
        if commits.len() >= MAX_RANGE_COMMITS {
            break;
        }
    }
    commits.sort_by(|a, b| a.timestamp.cmp(&b.timestamp).then_with(|| a.id.cmp(&b.id)));

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

    Ok(RangeCompare {
        base: base.to_string(),
        head: head.to_string(),
        merge_base: merge_base.map(|oid| oid.to_string()),
        ahead: ahead as u32,
        behind: behind as u32,
        commits,
        files,
    })
}

pub fn load_range_file_diff(path: &Path, base: &str, head: &str, rel: &str) -> Result<FileDiff> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    let (_base, _head, _merge_base, diff) = range_diff(&repo, base, head)?;
    collect_file_diff(&diff, &rel)
}

fn resolve_commit<'repo>(repo: &'repo Repository, spec: &str) -> Result<git2::Commit<'repo>> {
    let candidates = [
        spec.to_string(),
        format!("refs/heads/{spec}"),
        format!("refs/remotes/origin/{spec}"),
    ];
    for candidate in candidates {
        if let Ok(obj) = repo.revparse_single(&candidate) {
            if let Ok(commit) = obj.peel_to_commit() {
                return Ok(commit);
            }
        }
    }
    Err(AppError::msg(format!("unknown sequence '{spec}'")))
}

fn range_diff<'repo>(
    repo: &'repo Repository,
    base: &str,
    head: &str,
) -> Result<(
    git2::Commit<'repo>,
    git2::Commit<'repo>,
    Option<git2::Oid>,
    git2::Diff<'repo>,
)> {
    let base_commit = resolve_commit(repo, base)?;
    let head_commit = resolve_commit(repo, head)?;
    let merge_base = repo.merge_base(base_commit.id(), head_commit.id()).ok();
    let old_tree = if let Some(oid) = merge_base {
        Some(repo.find_commit(oid)?.tree()?)
    } else {
        Some(base_commit.tree()?)
    };
    let new_tree = head_commit.tree()?;
    let mut opts = DiffOptions::new();
    let mut diff = repo.diff_tree_to_tree(old_tree.as_ref(), Some(&new_tree), Some(&mut opts))?;
    let mut find_opts = git2::DiffFindOptions::new();
    find_opts.renames(true);
    diff.find_similar(Some(&mut find_opts))?;
    Ok((base_commit, head_commit, merge_base, diff))
}

pub(crate) fn diff_for_commit<'repo>(
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSides {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub binary: bool,
    pub old_contents: Option<String>,
    pub new_contents: Option<String>,
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8000).any(|&b| b == 0)
}

fn decode_blob(bytes: &[u8]) -> (Option<String>, bool) {
    if looks_binary(bytes) {
        return (None, true);
    }
    (Some(String::from_utf8_lossy(bytes).into_owned()), false)
}

fn tree_file_bytes(repo: &Repository, tree: &git2::Tree<'_>, rel: &str) -> Result<Option<Vec<u8>>> {
    match tree.get_path(Path::new(rel)) {
        Ok(entry) => {
            let obj = entry.to_object(repo)?;
            let blob = obj.peel_to_blob()?;
            Ok(Some(blob.content().to_vec()))
        }
        Err(_) => Ok(None),
    }
}

fn index_file_bytes(repo: &Repository, rel: &str) -> Result<Option<Vec<u8>>> {
    let index = repo.index()?;
    match index.get_path(Path::new(rel), 0) {
        Some(entry) => {
            let blob = repo.find_blob(entry.id)?;
            Ok(Some(blob.content().to_vec()))
        }
        None => Ok(None),
    }
}

fn workdir_file_bytes(repo: &Repository, rel: &str) -> Result<Option<Vec<u8>>> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::msg("repository has no workdir"))?;
    let path = workdir.join(rel);
    if !path.is_file() {
        return Ok(None);
    }
    Ok(Some(std::fs::read(&path)?))
}

fn sides_from_bytes(
    path: String,
    old_path: Option<String>,
    status: String,
    old_bytes: Option<Vec<u8>>,
    new_bytes: Option<Vec<u8>>,
) -> FileSides {
    let (old_contents, old_bin) = match old_bytes.as_deref() {
        Some(b) => decode_blob(b),
        None => (None, false),
    };
    let (new_contents, new_bin) = match new_bytes.as_deref() {
        Some(b) => decode_blob(b),
        None => (None, false),
    };
    FileSides {
        path,
        old_path,
        status,
        binary: old_bin || new_bin,
        old_contents: if old_bin { None } else { old_contents },
        new_contents: if new_bin { None } else { new_contents },
    }
}

pub fn load_file_sides(path: &Path, sha: &str, rel: &str) -> Result<FileSides> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    let meta = load_file_diff(path, sha, &rel)?;
    let (commit, _) = diff_for_commit(&repo, sha)?;
    let new_tree = commit.tree()?;
    let old_tree = commit.parents().next().and_then(|p| p.tree().ok());
    let old_rel = meta.old_path.as_deref().unwrap_or(meta.path.as_str());
    let old_bytes = match old_tree.as_ref() {
        Some(tree) => tree_file_bytes(&repo, tree, old_rel)?,
        None => None,
    };
    let new_bytes = tree_file_bytes(&repo, &new_tree, &meta.path)?;
    Ok(sides_from_bytes(
        meta.path,
        meta.old_path,
        meta.status,
        old_bytes,
        new_bytes,
    ))
}

pub fn load_worktree_file_sides(path: &Path, rel: &str, staged: bool) -> Result<FileSides> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    let meta = load_worktree_diff(path, &rel, staged)?;
    let old_rel = meta.old_path.as_deref().unwrap_or(meta.path.as_str());
    let (old_bytes, new_bytes) = if staged {
        let head_tree = repo.head().ok().and_then(|head| head.peel_to_tree().ok());
        let old = match head_tree.as_ref() {
            Some(tree) => tree_file_bytes(&repo, tree, old_rel)?,
            None => None,
        };
        let new = index_file_bytes(&repo, &meta.path)?;
        (old, new)
    } else {
        let old = index_file_bytes(&repo, old_rel)?;
        let new = workdir_file_bytes(&repo, &meta.path)?;
        // Untracked: not in index — old stays None, new from workdir.
        (old, new)
    };
    Ok(sides_from_bytes(
        meta.path,
        meta.old_path,
        meta.status,
        old_bytes,
        new_bytes,
    ))
}

pub fn load_range_file_sides(path: &Path, base: &str, head: &str, rel: &str) -> Result<FileSides> {
    let repo = discover(path)?;
    let rel = normalize_rel(rel)?;
    let meta = load_range_file_diff(path, base, head, &rel)?;
    let (base_commit, head_commit, merge_base, _) = range_diff(&repo, base, head)?;
    let old_tree = if let Some(oid) = merge_base {
        repo.find_commit(oid)?.tree()?
    } else {
        base_commit.tree()?
    };
    let new_tree = head_commit.tree()?;
    let old_rel = meta.old_path.as_deref().unwrap_or(meta.path.as_str());
    let old_bytes = tree_file_bytes(&repo, &old_tree, old_rel)?;
    let new_bytes = tree_file_bytes(&repo, &new_tree, &meta.path)?;
    Ok(sides_from_bytes(
        meta.path,
        meta.old_path,
        meta.status,
        old_bytes,
        new_bytes,
    ))
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
pub fn compare_range(path: String, base: String, head: String) -> Result<RangeCompare> {
    compare_refs(&PathBuf::from(path), &base, &head)
}

#[tauri::command]
pub fn get_range_file_diff(
    path: String,
    base: String,
    head: String,
    rel: String,
) -> Result<FileDiff> {
    load_range_file_diff(&PathBuf::from(path), &base, &head, &rel)
}

#[tauri::command]
pub fn get_file_sides(path: String, sha: String, rel: String) -> Result<FileSides> {
    load_file_sides(&PathBuf::from(path), &sha, &rel)
}

#[tauri::command]
pub fn get_worktree_file_sides(path: String, rel: String, staged: bool) -> Result<FileSides> {
    load_worktree_file_sides(&PathBuf::from(path), &rel, staged)
}

#[tauri::command]
pub fn get_range_file_sides(
    path: String,
    base: String,
    head: String,
    rel: String,
) -> Result<FileSides> {
    load_range_file_sides(&PathBuf::from(path), &base, &head, &rel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::Harness;
    use crate::timeline::walk::load_commit;
    use crate::worktree::stage_path;
    use std::fs;

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
    fn compare_refs_lists_exclusive_commits_and_three_dot_files() {
        let mut h = Harness::new();
        let root = h.commit("keep.txt", "alpha\nbeta\n", "root");
        let trunk = h.trunk();
        h.branch_from("variant", &root);
        h.checkout("variant");
        h.commit("keep.txt", "alpha\nBETA\n", "edit keep");
        let tip = h.commit("spur.txt", "anomaly\n", "add spur");
        h.checkout(&trunk);
        h.commit("sacred.txt", "canon\n", "sacred tip");

        let cmp = compare_refs(&h.path, &trunk, "variant").unwrap();
        assert_eq!(cmp.ahead, 2);
        assert_eq!(cmp.behind, 1);
        assert_eq!(cmp.commits.len(), 2);
        assert_eq!(
            cmp.commits
                .iter()
                .map(|c| c.summary.as_str())
                .collect::<Vec<_>>(),
            vec!["edit keep", "add spur"]
        );
        assert_eq!(cmp.commits[1].id, tip);
        assert_eq!(cmp.commits[0].email, "analyst@tva.local");
        assert!(cmp.merge_base.is_some());

        let paths: Vec<_> = cmp.files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"keep.txt"));
        assert!(paths.contains(&"spur.txt"));
        assert!(!paths.contains(&"sacred.txt"));

        let keep = load_range_file_diff(&h.path, &trunk, "variant", "keep.txt").unwrap();
        assert_eq!(keep.status, "modified");
        assert!(keep.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "deletion" && line.text.contains("beta"))
        }));
        assert!(keep.hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == "addition" && line.text.contains("BETA"))
        }));

        let added = load_range_file_diff(&h.path, &trunk, "variant", "spur.txt").unwrap();
        assert_eq!(added.status, "added");
        assert!(compare_refs(&h.path, &trunk, "missing-branch").is_err());
        assert!(load_range_file_diff(&h.path, &trunk, "variant", "sacred.txt").is_err());
    }

    #[test]
    fn compare_same_ref_is_empty() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        let trunk = h.trunk();
        let cmp = compare_refs(&h.path, &trunk, &trunk).unwrap();
        assert_eq!(cmp.ahead, 0);
        assert_eq!(cmp.behind, 0);
        assert!(cmp.commits.is_empty());
        assert!(cmp.files.is_empty());
    }

    #[test]
    fn file_sides_cover_added_edited_deleted() {
        let mut h = Harness::new();
        h.commit("keep.txt", "alpha\nbeta\ngamma\n", "root");
        let added = h.commit("fresh.txt", "new record\n", "add file");
        let added_sides = load_file_sides(&h.path, &added, "fresh.txt").unwrap();
        assert_eq!(added_sides.status, "added");
        assert!(added_sides.old_contents.is_none());
        assert_eq!(added_sides.new_contents.as_deref(), Some("new record\n"));

        let edited = h.commit("keep.txt", "alpha\nBETA\ngamma\ndelta\n", "edit file");
        let edited_sides = load_file_sides(&h.path, &edited, "keep.txt").unwrap();
        assert_eq!(edited_sides.status, "modified");
        assert_eq!(
            edited_sides.old_contents.as_deref(),
            Some("alpha\nbeta\ngamma\n")
        );
        assert_eq!(
            edited_sides.new_contents.as_deref(),
            Some("alpha\nBETA\ngamma\ndelta\n")
        );

        let deleted = h.rm("fresh.txt", "delete file");
        let deleted_sides = load_file_sides(&h.path, &deleted, "fresh.txt").unwrap();
        assert_eq!(deleted_sides.status, "deleted");
        assert_eq!(deleted_sides.old_contents.as_deref(), Some("new record\n"));
        assert!(deleted_sides.new_contents.is_none());
    }

    #[test]
    fn worktree_sides_cover_unstaged_and_untracked() {
        let mut h = Harness::new();
        h.commit("keep.txt", "alpha\nbeta\n", "root");
        fs::write(h.path.join("keep.txt"), "alpha\nBETA\n").unwrap();
        let unstaged = load_worktree_file_sides(&h.path, "keep.txt", false).unwrap();
        assert_eq!(unstaged.old_contents.as_deref(), Some("alpha\nbeta\n"));
        assert_eq!(unstaged.new_contents.as_deref(), Some("alpha\nBETA\n"));

        fs::write(h.path.join("fresh.txt"), "brand new\n").unwrap();
        let untracked = load_worktree_file_sides(&h.path, "fresh.txt", false).unwrap();
        assert!(untracked.old_contents.is_none());
        assert_eq!(untracked.new_contents.as_deref(), Some("brand new\n"));
    }
}
