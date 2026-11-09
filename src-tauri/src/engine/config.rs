use serde::{Deserialize, Serialize};

pub const GRID_W: usize = 1920;
pub const GRID_H: usize = 1080;
pub const OUT_W: usize = 3840;
pub const OUT_H: usize = 2160;
pub const FPS: u32 = 30;

pub const DEFAULT_BLOCK: usize = 4;
pub const DEFAULT_NSYM: usize = 32;
pub const RS_N: usize = 255;

pub const HEADER_BLOCK: usize = 16;
pub const HEADER_NSYM: usize = 64;
pub const HEADER_FRAMES: usize = 30;
pub const MAGIC: &str = "YTDISK";
pub const VERSION: u32 = 1;
pub const DEFAULT_CRF: u32 = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityInfo {
    pub grid: String,
    pub kb_per_frame: f64,
    pub kb_per_sec: f64,
    pub minutes_per_gb: f64,
}

pub fn calculate_capacity(block: usize, nsym: usize) -> CapacityInfo {
    let cols = GRID_W / block;
    let rows = GRID_H / block;
    let bytes_per_frame = (cols * rows) as f64 / 8.0;
    let useful_per_sec = bytes_per_frame * (RS_N - nsym) as f64 / RS_N as f64 * (FPS as f64);
    let kb_per_frame = bytes_per_frame / 1024.0;
    let kb_per_sec = useful_per_sec / 1024.0;
    let minutes_per_gb = if useful_per_sec > 0.0 {
        (1024.0 * 1024.0 * 1024.0) / useful_per_sec / 60.0
    } else {
        0.0
    };

    CapacityInfo {
        grid: format!("{}x{}", cols, rows),
        kb_per_frame,
        kb_per_sec,
        minutes_per_gb,
    }
}

