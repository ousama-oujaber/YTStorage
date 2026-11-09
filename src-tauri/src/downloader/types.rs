use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DownloadProvider {
    YouTube,
    GoogleDrive,
    Unknown,
}

impl std::fmt::Display for DownloadProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DownloadProvider::YouTube => write!(f, "YouTube"),
            DownloadProvider::GoogleDrive => write!(f, "Google Drive"),
            DownloadProvider::Unknown => write!(f, "Unknown"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for DownloadStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DownloadStatus::Pending => write!(f, "Pending"),
            DownloadStatus::Downloading => write!(f, "Downloading"),
            DownloadStatus::Paused => write!(f, "Paused"),
            DownloadStatus::Completed => write!(f, "Completed"),
            DownloadStatus::Failed => write!(f, "Failed"),
            DownloadStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub task_id: String,
    pub provider: DownloadProvider,
    pub url: String,
    pub file_name: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bytes_sec: f64,
    pub percentage: f32,
    pub eta_seconds: Option<u64>,
    pub status: DownloadStatus,
    pub error_message: Option<String>,
    pub destination_path: Option<PathBuf>,
    pub is_ytdisk_video: Option<bool>,
}

