use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use futures_util::StreamExt;
use regex::Regex;
use reqwest::header::{CONTENT_DISPOSITION, CONTENT_LENGTH, RANGE};

use crate::downloader::types::{DownloadProgress, DownloadProvider, DownloadStatus};
use crate::engine::inspect_header;

pub async fn download_gdrive<F>(
    task_id: &str,
    file_id: &str,
    dest_dir: &Path,
    progress_callback: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<PathBuf, String>
where
    F: Fn(DownloadProgress) + Send + 'static,
{
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let initial_url = format!("https://drive.google.com/uc?export=download&id={}", file_id);
    let resp = client
        .get(&initial_url)
        .send()
        .await
        .map_err(|e| format!("HTTP request to Google Drive failed: {}", e))?;

    let mut download_url = initial_url.clone();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let mut filename = format!("gdrive_{}.mp4", file_id);
    if let Some(cd) = resp.headers().get(CONTENT_DISPOSITION) {
        if let Ok(cd_str) = cd.to_str() {
            let fn_re = Regex::new(r#"filename\*?=(?:UTF-8'')?"?([^";]+)"?"#).unwrap();
            if let Some(caps) = fn_re.captures(cd_str) {
                filename = caps[1].trim_matches('"').to_string();
            }
        }
    }

    // Check if Google Drive returned a virus scan warning confirmation page
    if content_type.contains("text/html") {
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read Google Drive confirmation HTML: {}", e))?;

        let confirm_re = Regex::new(r#"confirm=([0-9A-Za-z_-]+)"#).unwrap();
        let token_opt = if let Some(caps) = confirm_re.captures(&body) {
            Some(caps[1].to_string())
        } else {
            let input_re = Regex::new(r#"name="confirm"\s+value="([^"]+)""#).unwrap();
            input_re.captures(&body).map(|c| c[1].to_string())
        };

        if let Some(token) = token_opt {
            download_url = format!(
                "https://drive.google.com/uc?export=download&id={}&confirm={}",
                file_id, token
            );
        } else {
            return Err("Google Drive requires authorization or file is not accessible publicly.".to_string());
        }
    }

    let final_dest = dest_dir.join(&filename);
    let part_dest = dest_dir.join(format!("{}.part", &filename));

    // Check for resume support
    let mut existing_bytes = 0u64;
    if part_dest.exists() {
        if let Ok(meta) = std::fs::metadata(&part_dest) {
            existing_bytes = meta.len();
        }
    }

    let mut req = client.get(&download_url);
    if existing_bytes > 0 {
        req = req.header(RANGE, format!("bytes={}-", existing_bytes));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Failed to initiate Google Drive stream: {}", e))?;

    let is_partial = resp.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    let append_mode = is_partial && existing_bytes > 0;

    let content_len = resp
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());

    let total_bytes = if append_mode {
        content_len.map(|cl| cl + existing_bytes)
    } else {
        content_len
    };

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(append_mode)
        .truncate(!append_mode)
        .open(&part_dest)
        .map_err(|e| format!("Cannot open part file {:?}: {}", part_dest, e))?;

    let mut downloaded = if append_mode { existing_bytes } else { 0u64 };
    let start_time = Instant::now();
    let mut last_emit = Instant::now();
    let mut stream = resp.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                progress_callback(DownloadProgress {
                    task_id: task_id.to_string(),
                    provider: DownloadProvider::GoogleDrive,
                    url: initial_url,
                    file_name: filename,
                    downloaded_bytes: downloaded,
                    total_bytes,
                    speed_bytes_sec: 0.0,
                    percentage: total_bytes.map_or(0.0, |t| (downloaded as f32 / t as f32) * 100.0),
                    eta_seconds: None,
                    status: DownloadStatus::Cancelled,
                    error_message: Some("Download cancelled by user".to_string()),
                    destination_path: Some(part_dest),
                    is_ytdisk_video: None,
                });
                return Err("Download cancelled by user".to_string());
            }
        }

        let chunk = chunk_res.map_err(|e| format!("Error while downloading stream chunk: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Error writing chunk to disk: {}", e))?;
        downloaded += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 250 {
            let elapsed_total = start_time.elapsed().as_secs_f64();
            let bytes_since_start = if downloaded >= existing_bytes {
                downloaded - existing_bytes
            } else {
                downloaded
            };
            let speed = if elapsed_total > 0.0 {
                bytes_since_start as f64 / elapsed_total
            } else {
                0.0
            };
            let percentage = total_bytes.map_or(0.0, |t| (downloaded as f32 / t as f32) * 100.0);
            let eta = if speed > 0.0 && total_bytes.is_some() {
                let remaining = total_bytes.unwrap().saturating_sub(downloaded);
                Some((remaining as f64 / speed) as u64)
            } else {
                None
            };

            progress_callback(DownloadProgress {
                task_id: task_id.to_string(),
                provider: DownloadProvider::GoogleDrive,
                url: initial_url.clone(),
                file_name: filename.clone(),
                downloaded_bytes: downloaded,
                total_bytes,
                speed_bytes_sec: speed,
                percentage,
                eta_seconds: eta,
                status: DownloadStatus::Downloading,
                error_message: None,
                destination_path: Some(part_dest.clone()),
                is_ytdisk_video: None,
            });

            last_emit = Instant::now();
        }
    }

    file.flush()
        .map_err(|e| format!("Failed to flush part file: {}", e))?;
    drop(file);

    // Rename part file to final destination
    std::fs::rename(&part_dest, &final_dest)
        .map_err(|e| format!("Failed to rename part file to final file: {}", e))?;

    // Check if the downloaded file is a valid YTDISK video
    let is_ytdisk = inspect_header(&final_dest).unwrap_or(None).is_some();

    progress_callback(DownloadProgress {
        task_id: task_id.to_string(),
        provider: DownloadProvider::GoogleDrive,
        url: initial_url,
        file_name: filename,
        downloaded_bytes: downloaded,
        total_bytes: Some(downloaded),
        speed_bytes_sec: 0.0,
        percentage: 100.0,
        eta_seconds: Some(0),
        status: DownloadStatus::Completed,
        error_message: None,
        destination_path: Some(final_dest.clone()),
        is_ytdisk_video: Some(is_ytdisk),
    });

    Ok(final_dest)
}

