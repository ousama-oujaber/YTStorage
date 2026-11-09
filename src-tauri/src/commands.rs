use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::downloader::{
    detect_provider, download_gdrive, download_youtube, DownloadProgress, DownloadProvider,
};
use crate::engine::{
    calculate_capacity, decode_video, encode_file, inspect_header, CapacityInfo,
    DecodeOptions, DecodeResult, EncodeOptions, Metadata,
};
use crate::tasks::{AppSettings, HistoryItem, TaskManager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedSourceDto {
    pub provider: String,
    pub id: String,
    pub normalized_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ffmpeg_available: bool,
    pub ffmpeg_path: Option<String>,
    pub ytdlp_available: bool,
    pub ytdlp_path: Option<String>,
}

#[tauri::command]
pub fn check_dependencies() -> DependencyStatus {
    let ffmpeg_res = which::which("ffmpeg");
    let ytdlp_res = crate::downloader::find_ytdlp_path();

    DependencyStatus {
        ffmpeg_available: ffmpeg_res.is_ok(),
        ffmpeg_path: ffmpeg_res.ok().map(|p| p.to_string_lossy().to_string()),
        ytdlp_available: ytdlp_res.is_ok(),
        ytdlp_path: ytdlp_res.ok().map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub fn get_capacity_info(block: usize, nsym: usize) -> CapacityInfo {
    calculate_capacity(block, nsym)
}

#[tauri::command]
pub fn detect_url_provider(url: String) -> Result<DetectedSourceDto, String> {
    let detected = detect_provider(&url)?;
    Ok(DetectedSourceDto {
        provider: detected.provider.to_string(),
        id: detected.id,
        normalized_url: detected.normalized_url,
    })
}

#[tauri::command]
pub fn inspect_video_header(video_path: String) -> Result<Option<Metadata>, String> {
    inspect_header(&PathBuf::from(video_path))
}

#[tauri::command]
pub fn pick_file(title: Option<String>, filters: Option<Vec<(String, Vec<String>)>>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(t);
    }
    if let Some(flts) = filters {
        for (name, exts) in flts {
            let ext_slices: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&name, &ext_slices);
        }
    }
    dialog.pick_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_save_file(
    title: Option<String>,
    default_name: Option<String>,
    filters: Option<Vec<(String, Vec<String>)>>,
) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(t);
    }
    if let Some(dn) = default_name {
        dialog = dialog.set_file_name(dn);
    }
    if let Some(flts) = filters {
        for (name, exts) in flts {
            let ext_slices: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&name, &ext_slices);
        }
    }
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_directory(title: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(t);
    }
    dialog.pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn encode_file_command(
    app: AppHandle,
    manager: State<'_, Arc<TaskManager>>,
    task_id: String,
    input_path: String,
    output_path: Option<String>,
    block: Option<usize>,
    nsym: Option<usize>,
    password: Option<String>,
    crf: Option<u32>,
    upscale_4k: Option<bool>,
) -> Result<Metadata, String> {
    let t0 = Instant::now();
    let in_pb = PathBuf::from(&input_path);
    if !in_pb.exists() {
        return Err(format!("Input file does not exist: {}", input_path));
    }

    let settings = manager.get_settings();
    let out_pb = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let name = in_pb
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("output");
            settings.video_output_dir.join(format!("{}.mp4", name))
        }
    };

    let cancel_token = manager.register_task(&task_id);
    let task_id_clone = task_id.clone();
    let app_handle = app.clone();

    let opts = EncodeOptions {
        input_path: in_pb.clone(),
        output_path: out_pb.clone(),
        block: block.unwrap_or(settings.default_block),
        nsym: nsym.unwrap_or(settings.default_nsym),
        crf: crf.unwrap_or(settings.default_crf),
        password,
        upscale_4k: upscale_4k.unwrap_or(true),
    };

    let result = tokio::task::spawn_blocking(move || {
        encode_file(
            &opts,
            move |progress| {
                let _ = app_handle.emit(
                    "encode-progress",
                    serde_json::json!({
                        "task_id": task_id_clone,
                        "progress": progress
                    }),
                );
            },
            Some(cancel_token),
        )
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?;

    manager.unregister_task(&task_id);

    let duration = t0.elapsed().as_secs_f32();
    let file_size = std::fs::metadata(&in_pb).map(|m| m.len() as usize).unwrap_or(0);

    match &result {
        Ok(meta) => {
            let _ = manager.add_history_item(HistoryItem {
                id: task_id,
                operation: "encode".to_string(),
                name: meta.name.clone(),
                size_bytes: file_size,
                sha256: Some(meta.sha256.clone()),
                status: "success".to_string(),
                error_message: None,
                source_path: Some(input_path),
                output_path: Some(out_pb.to_string_lossy().to_string()),
                created_at: Utc::now().to_rfc3339(),
                duration_seconds: duration,
                details: Some(format!(
                    "Frames: {}, Block: {}, NSYM: {}, Encrypted: {}",
                    meta.frames, meta.block, meta.nsym, meta.encrypted
                )),
            });
        }
        Err(err) => {
            let is_cancelled = err.contains("cancelled");
            let _ = manager.add_history_item(HistoryItem {
                id: task_id,
                operation: "encode".to_string(),
                name: in_pb.file_name().and_then(|n| n.to_str()).unwrap_or("file").to_string(),
                size_bytes: file_size,
                sha256: None,
                status: if is_cancelled { "cancelled".to_string() } else { "failed".to_string() },
                error_message: Some(err.clone()),
                source_path: Some(input_path),
                output_path: Some(out_pb.to_string_lossy().to_string()),
                created_at: Utc::now().to_rfc3339(),
                duration_seconds: duration,
                details: None,
            });
        }
    }

    result
}

pub async fn run_decode_internal(
    app: AppHandle,
    manager: Arc<TaskManager>,
    task_id: String,
    video_path: String,
    output_dir: Option<String>,
    password: Option<String>,
) -> Result<DecodeResult, String> {
    let t0 = Instant::now();
    let vid_pb = PathBuf::from(&video_path);
    if !vid_pb.exists() {
        return Err(format!("Video file does not exist: {}", video_path));
    }

    let settings = manager.get_settings();
    let out_dir_pb = match output_dir {
        Some(d) => PathBuf::from(d),
        None => settings.restore_dir.clone(),
    };

    let cancel_token = manager.register_task(&task_id);
    let task_id_clone = task_id.clone();
    let app_handle = app.clone();

    let opts = DecodeOptions {
        video_path: vid_pb.clone(),
        output_dir: out_dir_pb.clone(),
        password,
    };

    let result = tokio::task::spawn_blocking(move || {
        decode_video(
            &opts,
            move |progress| {
                let _ = app_handle.emit(
                    "decode-progress",
                    serde_json::json!({
                        "task_id": task_id_clone,
                        "progress": progress
                    }),
                );
            },
            Some(cancel_token),
        )
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?;

    manager.unregister_task(&task_id);

    let duration = t0.elapsed().as_secs_f32();
    let video_size = std::fs::metadata(&vid_pb).map(|m| m.len() as usize).unwrap_or(0);

    match &result {
        Ok(res) => {
            let _ = manager.add_history_item(HistoryItem {
                id: task_id,
                operation: "decode".to_string(),
                name: res.file_name.clone(),
                size_bytes: res.file_size,
                sha256: Some(res.metadata.sha256.clone()),
                status: "success".to_string(),
                error_message: None,
                source_path: Some(video_path),
                output_path: Some(res.output_path.to_string_lossy().to_string()),
                created_at: Utc::now().to_rfc3339(),
                duration_seconds: duration,
                details: Some(format!(
                    "Errors fixed: {}, Verified SHA-256: {}",
                    res.errors_fixed, res.sha256_match
                )),
            });
        }
        Err(err) => {
            let is_cancelled = err.contains("cancelled");
            let _ = manager.add_history_item(HistoryItem {
                id: task_id,
                operation: "decode".to_string(),
                name: vid_pb.file_name().and_then(|n| n.to_str()).unwrap_or("video").to_string(),
                size_bytes: video_size,
                sha256: None,
                status: if is_cancelled { "cancelled".to_string() } else { "failed".to_string() },
                error_message: Some(err.clone()),
                source_path: Some(video_path),
                output_path: None,
                created_at: Utc::now().to_rfc3339(),
                duration_seconds: duration,
                details: None,
            });
        }
    }

    result
}

#[tauri::command]
pub async fn decode_video_command(
    app: AppHandle,
    manager: State<'_, Arc<TaskManager>>,
    task_id: String,
    video_path: String,
    output_dir: Option<String>,
    password: Option<String>,
) -> Result<DecodeResult, String> {
    run_decode_internal(
        app,
        manager.inner().clone(),
        task_id,
        video_path,
        output_dir,
        password,
    )
    .await
}

#[tauri::command]
pub async fn start_download_command(
    app: AppHandle,
    manager: State<'_, Arc<TaskManager>>,
    task_id: String,
    url: String,
    output_dir: Option<String>,
    auto_decode: Option<bool>,
    decode_password: Option<String>,
) -> Result<String, String> {
    let t0 = Instant::now();
    let source = detect_provider(&url)?;
    let settings = manager.get_settings();
    let dest_dir = match output_dir {
        Some(d) => PathBuf::from(d),
        None => settings.download_dir.clone(),
    };

    let cancel_token = manager.register_task(&task_id);
    let app_handle = app.clone();

    let should_auto_decode = auto_decode.unwrap_or(settings.auto_decode);

    let progress_callback = move |p: DownloadProgress| {
        let _ = app_handle.emit("download-progress", &p);
    };

    let download_res = match source.provider {
        DownloadProvider::GoogleDrive => {
            download_gdrive(
                &task_id,
                &source.id,
                &dest_dir,
                progress_callback,
                Some(cancel_token.clone()),
            )
            .await
        }
        DownloadProvider::YouTube => {
            download_youtube(
                &task_id,
                &source.normalized_url,
                &dest_dir,
                progress_callback,
                Some(cancel_token.clone()),
            )
            .await
        }
        DownloadProvider::Unknown => {
            return Err("Unsupported download provider".to_string());
        }
    };

    manager.unregister_task(&task_id);
    let duration = t0.elapsed().as_secs_f32();

    match download_res {
        Ok(video_path) => {
            let file_size = std::fs::metadata(&video_path)
                .map(|m| m.len() as usize)
                .unwrap_or(0);
            let file_name = video_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("downloaded_video")
                .to_string();

            let _ = manager.add_history_item(HistoryItem {
                id: task_id.clone(),
                operation: "download".to_string(),
                name: file_name.clone(),
                size_bytes: file_size,
                sha256: None,
                status: "success".to_string(),
                error_message: None,
                source_path: Some(url.clone()),
                output_path: Some(video_path.to_string_lossy().to_string()),
                created_at: Utc::now().to_rfc3339(),
                duration_seconds: duration,
                details: Some(format!("Provider: {}", source.provider)),
            });

            // If auto-decode is enabled and video has valid YTDISK header, chain decode!
            if should_auto_decode {
                if let Ok(Some(_)) = inspect_header(&video_path) {
                    let decode_task_id = format!("{}-auto-decode", task_id);
                    let app_for_decode = app.clone();
                    let video_path_str = video_path.to_string_lossy().to_string();
                    let restore_dir_str = settings.restore_dir.to_string_lossy().to_string();
                    let mgr_clone = manager.inner().clone();

                    tokio::spawn(async move {
                        let _ = run_decode_internal(
                            app_for_decode,
                            mgr_clone,
                            decode_task_id,
                            video_path_str,
                            Some(restore_dir_str),
                            decode_password,
                        )
                        .await;
                    });
                }
            }

            Ok(video_path.to_string_lossy().to_string())
        }
        Err(e) => {
            let is_cancelled = e.contains("cancelled");
            let _ = manager.add_history_item(HistoryItem {
                id: task_id,
                operation: "download".to_string(),
                name: url.clone(),
                size_bytes: 0,
                sha256: None,
                status: if is_cancelled { "cancelled".to_string() } else { "failed".to_string() },
                error_message: Some(e.clone()),
                source_path: Some(url),
                output_path: None,
                created_at: Utc::now().to_rfc3339(),
                duration_seconds: duration,
                details: Some(format!("Provider: {}", source.provider)),
            });
            Err(e)
        }
    }
}

#[tauri::command]
pub fn cancel_task(manager: State<'_, Arc<TaskManager>>, task_id: String) -> bool {
    manager.cancel_task(&task_id)
}

#[tauri::command]
pub fn get_settings(manager: State<'_, Arc<TaskManager>>) -> AppSettings {
    manager.get_settings()
}

#[tauri::command]
pub fn save_settings(
    manager: State<'_, Arc<TaskManager>>,
    settings: AppSettings,
) -> Result<(), String> {
    manager.save_settings(&settings)
}

#[tauri::command]
pub fn get_history(manager: State<'_, Arc<TaskManager>>) -> Vec<HistoryItem> {
    manager.get_history()
}

#[tauri::command]
pub fn clear_history(manager: State<'_, Arc<TaskManager>>) -> Result<(), String> {
    manager.clear_history()
}
