mod commands;
mod error;
mod git;
mod graph;

use commands::{
    file_commit, get_branches, get_commit, get_status, get_timeline, open_repository, stage_file,
    switch_branch, unstage_file,
};

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
            get_branches,
            switch_branch,
            stage_file,
            unstage_file,
            file_commit
        ])
        .run(tauri::generate_context!())
        .expect("error while running timestream");
}
