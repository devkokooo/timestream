mod auth;
mod branches;
mod diff;
mod error;
mod git;
mod github;
mod remotes;
mod settings;
mod ssh;
mod timeline;
mod worktree;

use branches::{
    create_local_branch, delete_local_branch, get_branches, rename_local_branch, switch_branch,
};
use diff::{
    compare_range, get_file_diff, get_file_sides, get_range_file_diff, get_range_file_sides,
    get_worktree_diff, get_worktree_file_sides,
};
use git::open_repository;
use github::{
    github_add_issue_comment, github_create_issue, github_create_pull, github_create_release,
    github_get_pull, github_list_checks, github_list_issue_comments, github_list_issues,
    github_list_notifications, github_list_pull_commits, github_list_pull_counts,
    github_list_pulls, github_list_releases, github_list_review_comments, github_list_reviews,
    github_login_begin, github_login_pat, github_login_poll, github_logout, github_merge_pull,
    github_reply_review_comment, github_repo_features, github_rerun_job, github_search_repos,
    github_submit_review, github_update_issue, github_update_pull, github_update_release,
    github_whoami,
};
use remotes::commands::{
    ahead_behind, checkout_pull_request, clone_repository, delete_remote_tag, fetch_remote,
    github_origin, list_remotes, pull_ff_only, push_branch, push_tag,
};
use settings::{get_settings, set_settings, settings_toml_path};
use ssh::{list_ssh_keys, ssh_add_key, ssh_agent_ensure, ssh_agent_status};
use timeline::{create_local_tag, delete_local_tag, get_commit, get_timeline};
use worktree::{file_commit, get_status, stage_file, unstage_file};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_repository,
            get_timeline,
            get_status,
            get_commit,
            get_file_diff,
            get_worktree_diff,
            compare_range,
            get_range_file_diff,
            get_file_sides,
            get_worktree_file_sides,
            get_range_file_sides,
            get_branches,
            switch_branch,
            create_local_branch,
            rename_local_branch,
            delete_local_branch,
            stage_file,
            unstage_file,
            file_commit,
            create_local_tag,
            delete_local_tag,
            get_settings,
            set_settings,
            settings_toml_path,
            github_login_begin,
            github_login_poll,
            github_login_pat,
            github_whoami,
            github_logout,
            list_remotes,
            github_origin,
            ahead_behind,
            fetch_remote,
            push_branch,
            pull_ff_only,
            clone_repository,
            push_tag,
            delete_remote_tag,
            checkout_pull_request,
            list_ssh_keys,
            ssh_agent_status,
            ssh_agent_ensure,
            ssh_add_key,
            github_repo_features,
            github_list_pulls,
            github_list_pull_counts,
            github_get_pull,
            github_create_pull,
            github_update_pull,
            github_merge_pull,
            github_list_issues,
            github_create_issue,
            github_update_issue,
            github_list_issue_comments,
            github_add_issue_comment,
            github_list_releases,
            github_create_release,
            github_update_release,
            github_list_checks,
            github_rerun_job,
            github_list_review_comments,
            github_list_pull_commits,
            github_list_reviews,
            github_submit_review,
            github_reply_review_comment,
            github_list_notifications,
            github_search_repos
        ])
        .run(tauri::generate_context!())
        .expect("error while running timestream");
}
