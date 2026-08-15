use crate::error::Result;
use crate::git::{
    checkout_branch, commit_changes, list_branches, load_commit, load_file_diff, load_status,
    load_timeline, open_repo, stage_path, unstage_path, BranchInfo, CommitDetail, FileDiff,
    RepoSummary, StatusPayload,
};
use crate::graph::Timeline;
use std::path::PathBuf;

#[tauri::command]
pub fn open_repository(path: String) -> Result<RepoSummary> {
    open_repo(&PathBuf::from(path))
}

#[tauri::command]
pub fn get_timeline(path: String) -> Result<Timeline> {
    load_timeline(&PathBuf::from(path))
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
pub fn get_branches(path: String) -> Result<Vec<BranchInfo>> {
    list_branches(&PathBuf::from(path))
}

#[tauri::command]
pub fn switch_branch(path: String, name: String) -> Result<RepoSummary> {
    checkout_branch(&PathBuf::from(path), &name)
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
