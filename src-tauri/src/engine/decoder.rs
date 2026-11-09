use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use sha2::{Digest, Sha256};

use crate::engine::config::{GRID_H, GRID_W};
use crate::engine::crypto::decrypt;
use crate::engine::ecc::ecc_decode;
use crate::engine::frame::{bits_per_frame, bits_to_bytes, frame_to_bits};
use crate::engine::header::{read_header_frame, Metadata};

#[derive(Debug, Clone, serde::Serialize)]
pub struct DecodeProgress {
    pub stage: String,
    pub current_frame: usize,
    pub total_frames: usize,
    pub percentage: f32,
    pub fps: f32,
    pub elapsed_seconds: f32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DecodeResult {
    pub success: bool,
    pub sha256_match: bool,
    pub file_name: String,
    pub file_size: usize,
    pub output_path: PathBuf,
    pub errors_fixed: usize,
    pub metadata: Metadata,
}

pub struct DecodeOptions {
    pub video_path: PathBuf,
    pub output_dir: PathBuf,
    pub password: Option<String>,
}

fn read_exact_frame<R: Read>(reader: &mut R, buf: &mut [u8]) -> std::io::Result<bool> {
    let mut total = 0;
    while total < buf.len() {
        match reader.read(&mut buf[total..]) {
            Ok(0) => {
                if total == 0 {
                    return Ok(false); // Clean EOF
                } else {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::UnexpectedEof,
                        "Truncated video frame",
                    ));
                }
            }
            Ok(n) => total += n,
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }
    Ok(true)
}

pub fn inspect_header(video_path: &Path) -> Result<Option<Metadata>, String> {
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(video_path)
        .arg("-vf")
        .arg(format!("scale={}:{}:flags=area", GRID_W, GRID_H))
        .arg("-f")
        .arg("rawvideo")
        .arg("-pix_fmt")
        .arg("gray")
        .arg("-")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to launch FFmpeg: {}", e))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open FFmpeg stdout".to_string())?;

    let frame_size = GRID_W * GRID_H;
    let mut frame_buf = vec![0u8; frame_size];

    for _ in 0..90 {
        match read_exact_frame(&mut stdout, &mut frame_buf) {
            Ok(true) => {
                if let Some(meta) = read_header_frame(&frame_buf) {
                    let _ = child.kill();
                    return Ok(Some(meta));
                }
            }
            Ok(false) => break,
            Err(_) => break,
        }
    }

    let _ = child.kill();
    Ok(None)
}

pub fn decode_video<F>(
    opts: &DecodeOptions,
    progress_callback: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<DecodeResult, String>
where
    F: Fn(DecodeProgress) + Send + 'static,
{
    let t0 = Instant::now();

    if !opts.video_path.exists() {
        return Err(format!("Video file does not exist: {:?}", opts.video_path));
    }

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(&opts.video_path)
        .arg("-vf")
        .arg(format!("scale={}:{}:flags=area", GRID_W, GRID_H))
        .arg("-f")
        .arg("rawvideo")
        .arg("-pix_fmt")
        .arg("gray")
        .arg("-")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to launch FFmpeg reader: {}", e))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture FFmpeg stdout".to_string())?;

    let frame_size = GRID_W * GRID_H;
    let mut frame_buf = vec![0u8; frame_size];

    progress_callback(DecodeProgress {
        stage: "Searching for YTDISK header".to_string(),
        current_frame: 0,
        total_frames: 0,
        percentage: 0.0,
        fps: 0.0,
        elapsed_seconds: t0.elapsed().as_secs_f32(),
    });

    let mut meta_opt: Option<Metadata> = None;
    let mut header_search_count = 0;

    while header_search_count < 90 {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                return Err("Decoding cancelled by user".to_string());
            }
        }

        match read_exact_frame(&mut stdout, &mut frame_buf) {
            Ok(true) => {
                header_search_count += 1;
                if let Some(meta) = read_header_frame(&frame_buf) {
                    meta_opt = Some(meta);
                    break;
                }
            }
            Ok(false) => break,
            Err(e) => {
                let _ = child.kill();
                return Err(format!("Error reading frame: {}", e));
            }
        }
    }

    let meta = match meta_opt {
        Some(m) => m,
        None => {
            let _ = child.kill();
            return Err("No valid YTDISK header found. Is this a YTDISK video?".to_string());
        }
    };

    let total_frames = meta.frames;
    let mut chunks: Vec<Vec<u8>> = Vec::with_capacity(total_frames);

    // Skip any remaining repeated header frames until we reach the first data frame
    loop {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                return Err("Decoding cancelled by user".to_string());
            }
        }

        match read_exact_frame(&mut stdout, &mut frame_buf) {
            Ok(true) => {
                if read_header_frame(&frame_buf).is_none() {
                    // This is the first data frame!
                    chunks.push(frame_to_bits(&frame_buf, meta.block));
                    break;
                }
            }
            Ok(false) => break,
            Err(e) => {
                let _ = child.kill();
                return Err(format!("Error reading data frame: {}", e));
            }
        }
    }

    // Read the remaining data frames
    while chunks.len() < total_frames {
        if let Some(cancel) = &cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                return Err("Decoding cancelled by user".to_string());
            }
        }

        match read_exact_frame(&mut stdout, &mut frame_buf) {
            Ok(true) => {
                chunks.push(frame_to_bits(&frame_buf, meta.block));
                if chunks.len() % 15 == 0 || chunks.len() == total_frames {
                    let elapsed = t0.elapsed().as_secs_f32();
                    let fps = if elapsed > 0.0 { chunks.len() as f32 / elapsed } else { 0.0 };
                    progress_callback(DecodeProgress {
                        stage: "Reading and analyzing data frames".to_string(),
                        current_frame: chunks.len(),
                        total_frames,
                        percentage: (chunks.len() as f32 / total_frames as f32) * 80.0,
                        fps,
                        elapsed_seconds: elapsed,
                    });
                }
            }
            Ok(false) => break,
            Err(e) => {
                let _ = child.kill();
                return Err(format!("Error reading data frame: {}", e));
            }
        }
    }

    let _ = child.kill();

    if chunks.len() < total_frames {
        return Err(format!(
            "Video too short: expected {} data frames, but only found {}",
            total_frames,
            chunks.len()
        ));
    }

    progress_callback(DecodeProgress {
        stage: "Applying Reed-Solomon error correction".to_string(),
        current_frame: total_frames,
        total_frames,
        percentage: 85.0,
        fps: 0.0,
        elapsed_seconds: t0.elapsed().as_secs_f32(),
    });

    let bpf = bits_per_frame(meta.block);
    let mut all_bits = Vec::with_capacity(chunks.len() * bpf);
    for chunk in chunks {
        all_bits.extend(chunk);
    }

    let raw = bits_to_bytes(&all_bits);

    let (decoded_payload, errors_fixed) = ecc_decode(&raw, meta.codewords, meta.nsym)
        .map_err(|e| format!("Reed-Solomon error correction failed: {}", e))?;

    if decoded_payload.len() < meta.payload_len {
        return Err(format!(
            "Recovered payload size ({}) is smaller than declared payload length ({})",
            decoded_payload.len(),
            meta.payload_len
        ));
    }

    let mut payload = decoded_payload[..meta.payload_len].to_vec();

    if meta.encrypted {
        progress_callback(DecodeProgress {
            stage: "Decrypting data".to_string(),
            current_frame: total_frames,
            total_frames,
            percentage: 92.0,
            fps: 0.0,
            elapsed_seconds: t0.elapsed().as_secs_f32(),
        });

        let pass = opts
            .password
            .as_deref()
            .ok_or_else(|| "This file is encrypted, but no password was provided.".to_string())?;

        if pass.is_empty() {
            return Err("This file is encrypted, but password was empty.".to_string());
        }

        payload = decrypt(&payload, pass)?;
    }

    progress_callback(DecodeProgress {
        stage: "Verifying SHA-256 integrity".to_string(),
        current_frame: total_frames,
        total_frames,
        percentage: 97.0,
        fps: 0.0,
        elapsed_seconds: t0.elapsed().as_secs_f32(),
    });

    let computed_sha = format!("{:x}", Sha256::digest(&payload));
    if computed_sha != meta.sha256 {
        return Err(format!(
            "Integrity verification failed! Expected SHA-256 {}, but computed {}",
            meta.sha256, computed_sha
        ));
    }

    std::fs::create_dir_all(&opts.output_dir)
        .map_err(|e| format!("Cannot create output directory: {}", e))?;

    let out_file_path = opts.output_dir.join(&meta.name);
    let mut out_file = File::create(&out_file_path)
        .map_err(|e| format!("Cannot create output file {:?}: {}", out_file_path, e))?;
    out_file
        .write_all(&payload)
        .map_err(|e| format!("Cannot write output file: {}", e))?;

    progress_callback(DecodeProgress {
        stage: "Complete".to_string(),
        current_frame: total_frames,
        total_frames,
        percentage: 100.0,
        fps: 0.0,
        elapsed_seconds: t0.elapsed().as_secs_f32(),
    });

    Ok(DecodeResult {
        success: true,
        sha256_match: true,
        file_name: meta.name.clone(),
        file_size: payload.len(),
        output_path: out_file_path,
        errors_fixed,
        metadata: meta,
    })
}

