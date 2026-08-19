use crate::error::{AppError, Result};
use crate::git::{discover, summary, RepoSummary};
use git2::{build::CheckoutBuilder, BranchType, Repository};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub tip: String,
    pub is_head: bool,
}

pub fn list_branches(path: &Path) -> Result<Vec<BranchInfo>> {
    let repo = discover(path)?;
    let head_name = crate::git::current_branch(&repo);
    let mut out = Vec::new();
    for branch in repo.branches(Some(BranchType::Local))? {
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

fn validate_branch_name(name: &str) -> Result<()> {
    if name.trim().is_empty() {
        return Err(AppError::msg("variant name is required"));
    }
    if name != name.trim() {
        return Err(AppError::msg("variant name cannot start or end with whitespace"));
    }
    if name.eq_ignore_ascii_case("HEAD") {
        return Err(AppError::msg("HEAD is not a valid variant name"));
    }
    if name.starts_with('-') {
        return Err(AppError::msg("variant name cannot start with '-'"));
    }
    match git2::Branch::name_is_valid(name) {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::msg(format!("invalid variant name '{name}'"))),
        Err(err) => Err(err.into()),
    }
}

fn find_local_branch<'repo>(
    repo: &'repo Repository,
    name: &str,
) -> Result<git2::Branch<'repo>> {
    repo.find_branch(name, BranchType::Local)
        .map_err(|_| AppError::msg(format!("unknown variant '{name}'")))
}

pub fn create_branch(path: &Path, name: &str, checkout: bool) -> Result<RepoSummary> {
    validate_branch_name(name)?;
    let repo = discover(path)?;
    if repo.find_branch(name, BranchType::Local).is_ok() {
        return Err(AppError::msg(format!("variant '{name}' already exists")));
    }
    {
        let commit = repo
            .head()?
            .peel_to_commit()
            .map_err(|_| AppError::msg("HEAD has no commit"))?;
        repo.branch(name, &commit, false)?;
    }
    if checkout {
        checkout_branch(path, name)
    } else {
        summary(&repo)
    }
}

pub fn rename_branch(path: &Path, from: &str, to: &str) -> Result<RepoSummary> {
    validate_branch_name(to)?;
    if from == to {
        let repo = discover(path)?;
        return summary(&repo);
    }
    let repo = discover(path)?;
    if repo.find_branch(to, BranchType::Local).is_ok() {
        return Err(AppError::msg(format!("variant '{to}' already exists")));
    }
    {
        let mut branch = find_local_branch(&repo, from)?;
        branch.rename(to, false)?;
    }
    summary(&repo)
}

pub fn delete_branch(path: &Path, name: &str) -> Result<()> {
    let repo = discover(path)?;
    let mut branch = find_local_branch(&repo, name)?;
    if branch.is_head() {
        return Err(AppError::msg(
            "cannot cull the active sequence — switch first",
        ));
    }
    branch.delete()?;
    Ok(())
}

pub fn checkout_branch(path: &Path, name: &str) -> Result<RepoSummary> {
    let repo = discover(path)?;
    let refname = format!("refs/heads/{name}");
    repo.find_reference(&refname)
        .map_err(|_| AppError::msg(format!("unknown variant '{name}'")))?;
    repo.set_head(&refname)?;
    repo.checkout_head(Some(CheckoutBuilder::new().safe()))?;
    summary(&repo)
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
pub fn create_local_branch(
    path: String,
    name: String,
    checkout: Option<bool>,
) -> Result<RepoSummary> {
    create_branch(&PathBuf::from(path), &name, checkout.unwrap_or(true))
}

#[tauri::command]
pub fn rename_local_branch(path: String, from: String, to: String) -> Result<RepoSummary> {
    rename_branch(&PathBuf::from(path), &from, &to)
}

#[tauri::command]
pub fn delete_local_branch(path: String, name: String) -> Result<()> {
    delete_branch(&PathBuf::from(path), &name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::Harness;

    #[test]
    fn create_branch_from_head() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        let summary = create_branch(&h.path, "variant-x", true).unwrap();
        assert_eq!(summary.branch.as_deref(), Some("variant-x"));
    }

    #[test]
    fn create_branch_without_checkout_stays_on_head() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        let trunk = h.trunk();
        let summary = create_branch(&h.path, "variant-hold", false).unwrap();
        assert_eq!(summary.branch.as_deref(), Some(trunk.as_str()));
        let names: Vec<_> = list_branches(&h.path)
            .unwrap()
            .into_iter()
            .map(|b| b.name)
            .collect();
        assert!(names.contains(&"variant-hold".to_string()));
    }

    #[test]
    fn create_branch_rejects_duplicate_and_invalid_names() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        create_branch(&h.path, "variant-x", false).unwrap();
        assert!(create_branch(&h.path, "variant-x", false).is_err());
        assert!(create_branch(&h.path, "HEAD", false).is_err());
        assert!(create_branch(&h.path, "-oops", false).is_err());
        assert!(create_branch(&h.path, "bad name", false).is_err());
        assert!(create_branch(&h.path, "", false).is_err());
    }

    #[test]
    fn rename_branch_updates_head_when_active() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        create_branch(&h.path, "variant-x", true).unwrap();
        let summary = rename_branch(&h.path, "variant-x", "variant-y").unwrap();
        assert_eq!(summary.branch.as_deref(), Some("variant-y"));
        let names: Vec<_> = list_branches(&h.path)
            .unwrap()
            .into_iter()
            .map(|b| b.name)
            .collect();
        assert!(names.contains(&"variant-y".to_string()));
        assert!(!names.contains(&"variant-x".to_string()));
    }

    #[test]
    fn rename_branch_rejects_taken_name() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        let trunk = h.trunk();
        create_branch(&h.path, "variant-x", false).unwrap();
        assert!(rename_branch(&h.path, "variant-x", &trunk).is_err());
        assert!(rename_branch(&h.path, "missing", "other").is_err());
    }

    #[test]
    fn delete_branch_refuses_head_and_removes_others() {
        let mut h = Harness::new();
        h.commit("a.txt", "a", "root");
        let trunk = h.trunk();
        create_branch(&h.path, "variant-x", false).unwrap();
        assert!(delete_branch(&h.path, &trunk).is_err());
        delete_branch(&h.path, "variant-x").unwrap();
        let names: Vec<_> = list_branches(&h.path)
            .unwrap()
            .into_iter()
            .map(|b| b.name)
            .collect();
        assert!(!names.contains(&"variant-x".to_string()));
        assert!(delete_branch(&h.path, "variant-x").is_err());
    }
}
