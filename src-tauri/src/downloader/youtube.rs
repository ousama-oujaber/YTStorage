use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::downloader::types::{DownloadProgress, DownloadProvider, DownloadStatus};
use crate::engine::inspect_header;

pub fn find_ytdlp_path() -> Result<PathBuf, String> {
    if let Ok(path) = which::which("yt-dlp") {
        return Ok(path);
    }

    // Check virtualenv or common local locations
    let candidates = [
        PathBuf::from("/home/protocol/Desktop/ytdisk/.venv/bin/yt-dlp"),
        dirs::home_dir().map(|h| h.join(".local/bin/yt-dlp")).unwrap_or_default(),
        PathBuf::from("/usr/bin/yt-dlp"),
        PathBuf::from("/usr/local/bin/yt-dlp"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    Err("yt-dlp executable was not found. Please ensure yt-dlp is installed.".to_string())
}

pub async fn download_youtube<F>(
    task_id: &str,
    url: &str,
    dest_dir: &Path,
    progress_callback: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<PathBuf, String>
where
    F: Fn(DownloadProgress) + Send + 'static,
{
    let ytdlp = find_ytdlp_path()?;

    std::fs::create_dir_all(dest_dir)
        .map_err(|e| format!("Cannot create destination directory {:?}: {}", dest_dir, e))?;

    let out_template = dest_dir.join("%(title)s [%(id)s].%(ext)s");

    let mut cmd = Command::new(&ytdlp);
    cmd.arg("--newline")
        .arg("--continue")
        .arg("--no-playlist")
        .arg("--progress")
        .arg("--progress-template")
        .arg("%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.speed)s|%(progress.eta)s|%(info.filepath)s")
        .arg("-f")
        .arg("bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
        .arg("-o")
        .arg(out_template.to_string_lossy().to_string())
        .arg(url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture yt-dlp stdout".to_string())?;

    let reader = BufReader::new(stdout);
    let mut final_path: Option<PathBuf> = None;
    let mut last_filename = String::from("YouTube Video");
    let mut last_downloaded = 0u64;
    let mut last_total: Option<u64> = None;

    for line_res in reader.lines() {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                progress_callback(DownloadProgress {
                    task_id: task_id.to_string(),
                    provider: DownloadProvider::YouTube,
                    url: url.to_string(),
                    file_name: last_filename,
                    downloaded_bytes: last_downloaded,
                    total_bytes: last_total,
                    speed_bytes_sec: 0.0,
                    percentage: 0.0,
                    eta_seconds: None,
                    status: DownloadStatus::Cancelled,
                    error_message: Some("Download cancelled by user".to_string()),
                    destination_path: final_path.clone(),
                    is_ytdisk_video: None,
                });
                return Err("Download cancelled by user".to_string());
            }
        }

        if let Ok(line) = line_res {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 6 {
                let pct_str = parts[0].trim().trim_end_matches('%');
                let pct: f32 = pct_str.parse().unwrap_or(0.0);

                let dl_bytes: u64 = parts[1].trim().parse().unwrap_or(0);
                last_downloaded = dl_bytes;

                let tot_bytes: Option<u64> = parts[2].trim().parse().ok();
                if tot_bytes.is_some() {
                    last_total = tot_bytes;
                }

                let speed: f64 = parts[3].trim().parse().unwrap_or(0.0);
                let eta: Option<u64> = parts[4].trim().parse().ok();

                let file_path_str = parts[5].trim();
                if !file_path_str.is_empty() && file_path_str != "NA" {
                    let pb = PathBuf::from(file_path_str);
                    if let Some(name) = pb.file_name().and_then(|n| n.to_str()) {
                        last_filename = name.to_string();
                    }
                    final_path = Some(pb);
                }

                progress_callback(DownloadProgress {
                    task_id: task_id.to_string(),
                    provider: DownloadProvider::YouTube,
                    url: url.to_string(),
                    file_name: last_filename.clone(),
                    downloaded_bytes: dl_bytes,
                    total_bytes: tot_bytes,
                    speed_bytes_sec: speed,
                    percentage: pct,
                    eta_seconds: eta,
                    status: DownloadStatus::Downloading,
                    error_message: None,
                    destination_path: final_path.clone(),
                    is_ytdisk_video: None,
                });
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("yt-dlp wait error: {}", e))?;

    if !status.success() {
        return Err(format!("yt-dlp exited with error code: {:?}", status.code()));
    }

    // If final_path wasn't extracted from progress template, search dest_dir for recent mp4
    let resolved_path = match final_path {
        Some(p) if p.exists() => p,
        _ => {
            // Find most recently modified mp4 in dest_dir
            let mut latest: Option<(PathBuf, std::time::SystemTime)> = None;
            if let Ok(entries) = std::fs::read_dir(dest_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() {
                        if let Ok(meta) = p.metadata() {
                            if let Ok(mod_time) = meta.modified() {
                                if latest.as_ref().map_or(true, |(_, t)| mod_time > *t) {
                                    latest = Some((p, mod_time));
                                }
                            }
                        }
                    }
                }
            }
            latest.map(|(p, _)| p).ok_or_else(|| {
                "yt-dlp finished but output video could not be located on disk".to_string()
            })?
        }
    };

    // Auto-detect if it's a YTDISK video!
    let is_ytdisk = inspect_header(&resolved_path).unwrap_or(None).is_some();

    progress_callback(DownloadProgress {
        task_id: task_id.to_string(),
        provider: DownloadProvider::YouTube,
        url: url.to_string(),
        file_name: resolved_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("video.mp4")
            .to_string(),
        downloaded_bytes: last_downloaded,
        total_bytes: Some(last_downloaded),
        speed_bytes_sec: 0.0,
        percentage: 100.0,
        eta_seconds: Some(0),
        status: DownloadStatus::Completed,
        error_message: None,
        destination_path: Some(resolved_path.clone()),
        is_ytdisk_video: Some(is_ytdisk),
    });

    Ok(resolved_path)
}

