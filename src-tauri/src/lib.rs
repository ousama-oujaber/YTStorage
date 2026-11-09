pub mod commands;
pub mod downloader;
pub mod engine;
pub mod tasks;

use std::sync::Arc;
use tasks::TaskManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let task_manager = Arc::new(TaskManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(task_manager)
        .invoke_handler(tauri::generate_handler![
            commands::check_dependencies,
            commands::get_capacity_info,
            commands::detect_url_provider,
            commands::inspect_video_header,
            commands::pick_file,
            commands::pick_save_file,
            commands::pick_directory,
            commands::encode_file_command,
            commands::decode_video_command,
            commands::start_download_command,
            commands::cancel_task,
            commands::get_settings,
            commands::save_settings,
            commands::get_history,
            commands::clear_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
