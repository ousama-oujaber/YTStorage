use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use sha2::{Digest, Sha256};

use crate::engine::config::{
    DEFAULT_BLOCK, DEFAULT_CRF, DEFAULT_NSYM, FPS, GRID_H, GRID_W, HEADER_FRAMES, MAGIC, OUT_H,
    OUT_W, VERSION,
};
use crate::engine::crypto::encrypt;
use crate::engine::ecc::{ecc_encode, num_codewords};
use crate::engine::frame::{bits_per_frame, bits_to_frame, bytes_to_bits};
use crate::engine::header::{make_header_frame, Metadata};

#[derive(Debug, Clone, serde::Serialize)]
pub struct EncodeProgress {
    pub stage: String,
    pub current_frame: usize,
    pub total_frames: usize,
    pub percentage: f32,
    pub fps: f32,
    pub elapsed_seconds: f32,
}

pub struct EncodeOptions {
    pub input_path: PathBuf,
    pub output_path: PathBuf,
    pub block: usize,
    pub nsym: usize,
    pub crf: u32,
    pub password: Option<String>,
    pub upscale_4k: bool,
}

impl Default for EncodeOptions {
    fn default() -> Self {
        Self {
            input_path: PathBuf::new(),
            output_path: PathBuf::new(),
            block: DEFAULT_BLOCK,
            nsym: DEFAULT_NSYM,
            crf: DEFAULT_CRF,
            password: None,
            upscale_4k: true,
        }
    }
}

pub fn encode_file<F>(
    opts: &EncodeOptions,
    progress_callback: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<Metadata, String>
where
    F: Fn(EncodeProgress) + Send + 'static,
{
    let t0 = Instant::now();

    let mut file = File::open(&opts.input_path)
        .map_err(|e| format!("Cannot open input file {:?}: {}", opts.input_path, e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Cannot read input file: {}", e))?;

    let file_name = opts
        .input_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();

    let sha256 = format!("{:x}", Sha256::digest(&data));

    if let Some(cancel) = &cancel_flag {
        if cancel.load(Ordering::Relaxed) {
            return Err("Encoding cancelled by user".to_string());
        }
    }

    progress_callback(EncodeProgress {
        stage: "Encrypting and preparing data".to_string(),
        current_frame: 0,
        total_frames: 0,
        percentage: 0.0,
        fps: 0.0,
        elapsed_seconds: t0.elapsed().as_secs_f32(),
    });

    let (payload, encrypted) = match &opts.password {
        Some(p) if !p.is_empty() => (encrypt(&data, p)?, true),
        _ => (data.clone(), false),
    };

    let ecc = ecc_encode(&payload, opts.nsym);
    let bits = bytes_to_bits(&ecc);
    let bpf = bits_per_frame(opts.block);
    let n_frames = (bits.len() + bpf - 1) / bpf;
    let total_video_frames = HEADER_FRAMES + n_frames;

    let meta = Metadata {
        magic: MAGIC.to_string(),
        v: VERSION,
        name: file_name,
        size: data.len(),
        sha256,
        payload_len: payload.len(),
        codewords: num_codewords(payload.len(), opts.nsym),
        block: opts.block,
        nsym: opts.nsym,
        frames: n_frames,
        encrypted,
    };

    let header_frame = make_header_frame(&meta)?;

    // Prepare FFmpeg child process
    if let Some(parent) = opts.output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut scale_args = Vec::new();
    if opts.upscale_4k {
        scale_args.push("-vf".to_string());
        scale_args.push(format!("scale={}:{}:flags=neighbor", OUT_W, OUT_H));
    }

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-f")
        .arg("rawvideo")
        .arg("-pix_fmt")
        .arg("gray")
        .arg("-s")
        .arg(format!("{}x{}", GRID_W, GRID_H))
        .arg("-r")
        .arg(FPS.to_string())
        .arg("-i")
        .arg("-");

    for s in &scale_args {
        cmd.arg(s);
    }

    cmd.arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-crf")
        .arg(opts.crf.to_string())
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg(&opts.output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to launch FFmpeg: {}. Ensure FFmpeg is installed and accessible in PATH.",
            e
        )
    })?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open FFmpeg stdin".to_string())?;

    // Write header frames
    for f in 0..HEADER_FRAMES {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                drop(stdin);
                let _ = child.kill();
                let _ = std::fs::remove_file(&opts.output_path);
                return Err("Encoding cancelled by user".to_string());
            }
        }

        if let Err(e) = stdin.write_all(&header_frame) {
            let _ = child.kill();
            return Err(format!("Error writing header frame to FFmpeg: {}", e));
        }

        if f % 10 == 0 || f == HEADER_FRAMES - 1 {
            let elapsed = t0.elapsed().as_secs_f32();
            let fps = if elapsed > 0.0 { (f + 1) as f32 / elapsed } else { 0.0 };
            progress_callback(EncodeProgress {
                stage: "Writing header frames".to_string(),
                current_frame: f + 1,
                total_frames: total_video_frames,
                percentage: ((f + 1) as f32 / total_video_frames as f32) * 100.0,
                fps,
                elapsed_seconds: elapsed,
            });
        }
    }

    // Write data frames
    for i in 0..n_frames {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                drop(stdin);
                let _ = child.kill();
                let _ = std::fs::remove_file(&opts.output_path);
                return Err("Encoding cancelled by user".to_string());
            }
        }

        let start_bit = i * bpf;
        let end_bit = ((i + 1) * bpf).min(bits.len());
        let slice = &bits[start_bit..end_bit];
        let frame_bytes = bits_to_frame(slice, opts.block);

        if let Err(e) = stdin.write_all(&frame_bytes) {
            let _ = child.kill();
            return Err(format!("Error writing data frame {} to FFmpeg: {}", i, e));
        }

        if i % 15 == 0 || i == n_frames - 1 {
            let current = HEADER_FRAMES + i + 1;
            let elapsed = t0.elapsed().as_secs_f32();
            let fps = if elapsed > 0.0 { current as f32 / elapsed } else { 0.0 };
            progress_callback(EncodeProgress {
                stage: "Writing data frames".to_string(),
                current_frame: current,
                total_frames: total_video_frames,
                percentage: (current as f32 / total_video_frames as f32) * 100.0,
                fps,
                elapsed_seconds: elapsed,
            });
        }
    }

    drop(stdin);

    let output = child
        .wait_with_output()
        .map_err(|e| format!("FFmpeg process error: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed with exit code {:?}: {}", output.status.code(), stderr));
    }

    Ok(meta)
}

