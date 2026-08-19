use super::current_branch;
use crate::branches::checkout_branch;
use git2::{Repository, Signature, Time};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub(crate) struct Harness {
    _dir: TempDir,
    pub path: PathBuf,
    pub repo: Repository,
    pub clock: i64,
    trunk: String,
}

impl Harness {
    pub fn new() -> Self {
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

    pub fn commit_tree(&mut self, message: &str) -> String {
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

    pub fn commit(&mut self, file: &str, contents: &str, message: &str) -> String {
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

    pub fn rm(&mut self, file: &str, message: &str) -> String {
        fs::remove_file(self.path.join(file)).unwrap();
        let mut index = self.repo.index().unwrap();
        index.remove_path(Path::new(file)).unwrap();
        index.write().unwrap();
        self.commit_tree(message)
    }

    pub fn mv(&mut self, from: &str, to: &str, message: &str) -> String {
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

    pub fn branch_from(&self, name: &str, sha: &str) {
        let oid = git2::Oid::from_str(sha).unwrap();
        let commit = self.repo.find_commit(oid).unwrap();
        self.repo.branch(name, &commit, false).unwrap();
    }

    pub fn checkout(&self, name: &str) {
        checkout_branch(&self.path, name).unwrap();
    }

    pub fn trunk(&self) -> String {
        if self.trunk.is_empty() {
            current_branch(&self.repo).unwrap_or_else(|| "master".into())
        } else {
            self.trunk.clone()
        }
    }
}
