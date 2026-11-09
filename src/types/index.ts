export interface Metadata {
  magic: string;
  v: number;
  name: string;
  size: number;
  sha256: string;
  payload_len: number;
  codewords: number;
  block: number;
  nsym: number;
  frames: number;
  encrypted: boolean;
}

export interface CapacityInfo {
  grid: string;
  kb_per_frame: number;
  kb_per_sec: number;
  minutes_per_gb: number;
}

export interface EncodeProgress {
  stage: string;
  current_frame: number;
  total_frames: number;
  percentage: number;
  fps: number;
  elapsed_seconds: number;
}

export interface DecodeProgress {
  stage: string;
  current_frame: number;
  total_frames: number;
  percentage: number;
  fps: number;
  elapsed_seconds: number;
}

export interface DecodeResult {
  success: boolean;
  sha256_match: boolean;
  file_name: string;
  file_size: number;
  output_path: string;
  errors_fixed: number;
  metadata: Metadata;
}

export type DownloadProvider = "YouTube" | "Google Drive" | "Unknown";

export type DownloadStatus =
  | "Pending"
  | "Downloading"
  | "Paused"
  | "Completed"
  | "Failed"
  | "Cancelled";

export interface DownloadProgress {
  task_id: string;
  provider: DownloadProvider;
  url: string;
  file_name: string;
  downloaded_bytes: number;
  total_bytes?: number;
  speed_bytes_sec: number;
  percentage: number;
  eta_seconds?: number;
  status: DownloadStatus;
  error_message?: string;
  destination_path?: string;
  is_ytdisk_video?: boolean;
}

export interface DetectedSource {
  provider: string;
  id: string;
  normalized_url: string;
}

export interface HistoryItem {
  id: string;
  operation: "encode" | "decode" | "download";
  name: string;
  size_bytes: number;
  sha256?: string;
  status: "success" | "failed" | "cancelled";
  error_message?: string;
  source_path?: string;
  output_path?: string;
  created_at: string;
  duration_seconds: number;
  details?: string;
}

export interface AppSettings {
  download_dir: string;
  restore_dir: string;
  video_output_dir: string;
  auto_decode: boolean;
  default_block: number;
  default_nsym: number;
  default_crf: number;
  theme: "dark" | "light" | "system";
}

export interface DependencyStatus {
  ffmpeg_available: boolean;
  ffmpeg_path?: string;
  ytdlp_available: boolean;
  ytdlp_path?: string;
}

export interface ActiveTask {
  id: string;
  type: "encode" | "decode" | "download";
  name: string;
  progress: number;
  stage: string;
  speed?: string;
  details?: string;
  cancellable: boolean;
}

