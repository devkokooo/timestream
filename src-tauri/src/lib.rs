mod auth;
mod commands;
mod error;
mod git;
mod github;
mod graph;
mod remotes;
mod settings;
mod ssh;

use commands::*;

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
            get_branches,
            switch_branch,
            create_local_branch,
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
            github_list_pulls,
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
            github_submit_review,
            github_reply_review_comment,
            github_list_notifications,
            github_search_repos
        ])
        .run(tauri::generate_context!())
        .expect("error while running timestream");
}
