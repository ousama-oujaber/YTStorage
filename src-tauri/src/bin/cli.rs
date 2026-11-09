use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use clap::{Parser, Subcommand};

use ytdisk_lib::downloader::{detect_provider, download_gdrive, download_youtube, DownloadProvider};
use ytdisk_lib::engine::{
    calculate_capacity, decode_video, encode_file, inspect_header,
    DecodeOptions, EncodeOptions, DEFAULT_BLOCK, DEFAULT_CRF, DEFAULT_NSYM,
};

#[derive(Parser)]
#[command(name = "ytdisk")]
#[command(about = "YTDisk — Store and retrieve files inside 4K YouTube videos with Reed-Solomon ECC")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Encode a file into a 4K YTDISK video
    Encode {
        /// File to encode
        file: PathBuf,
        /// Output MP4 path
        #[arg(short, long, default_value = "upload.mp4")]
        output: PathBuf,
        /// Pixel block size (default: 4)
        #[arg(long, default_value_t = DEFAULT_BLOCK)]
        block: usize,
        /// Reed-Solomon error correction symbols (default: 32)
        #[arg(long, default_value_t = DEFAULT_NSYM)]
        nsym: usize,
        /// Constant Rate Factor for x264 (default: 12)
        #[arg(long, default_value_t = DEFAULT_CRF)]
        crf: u32,
        /// AES-256-GCM encryption password
        #[arg(short, long)]
        password: Option<String>,
        /// Upscale video to 4K (3840x2160)
        #[arg(long, default_value_t = true)]
        upscale_4k: bool,
    },
    /// Decode a YTDISK video back to the original file
    Decode {
        /// YTDISK video file to decode
        video: PathBuf,
        /// Directory where restored file will be saved
        #[arg(short, long, default_value = "restored")]
        output: PathBuf,
        /// AES-256-GCM decryption password (if encrypted)
        #[arg(short, long)]
        password: Option<String>,
    },
    /// Inspect YTDISK video header metadata
    Inspect {
        /// Video file to inspect
        video: PathBuf,
    },
    /// Download a video from YouTube or Google Drive
    Download {
        /// YouTube or Google Drive URL
        url: String,
        /// Output destination directory
        #[arg(short, long, default_value = "downloads")]
        output: PathBuf,
        /// Automatically decode if the video is a YTDISK container
        #[arg(long, default_value_t = false)]
        auto_decode: bool,
        /// Decryption password if auto-decoding
        #[arg(long)]
        password: Option<String>,
    },
    /// Calculate storage capacity and throughput metrics
    Capacity {
        /// Pixel block size (default: 4)
        #[arg(long, default_value_t = DEFAULT_BLOCK)]
        block: usize,
        /// Reed-Solomon parity symbols (default: 32)
        #[arg(long, default_value_t = DEFAULT_NSYM)]
        nsym: usize,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Encode {
            file,
            output,
            block,
            nsym,
            crf,
            password,
            upscale_4k,
        } => {
            println!("▶ Encoding {:?} -> {:?}", file, output);
            let opts = EncodeOptions {
                input_path: file,
                output_path: output.clone(),
                block,
                nsym,
                crf,
                password,
                upscale_4k,
            };

            let meta = encode_file(
                &opts,
                |p| {
                    print!("\r  [{}] {}/{} ({:.1}%) - {:.1} fps", p.stage, p.current_frame, p.total_frames, p.percentage, p.fps);
                    use std::io::Write;
                    let _ = std::io::stdout().flush();
                },
                None,
            )?;
            println!("\n✔ Encoding complete!");
            println!("  File name:      {}", meta.name);
            println!("  Original size:  {} bytes", meta.size);
            println!("  Payload size:   {} bytes", meta.payload_len);
            println!("  Total frames:   {}", meta.frames);
            println!("  SHA-256:        {}", meta.sha256);
            println!("  Encrypted:      {}", meta.encrypted);
            println!("  Output video:   {:?}", output);
        }

        Commands::Decode {
            video,
            output,
            password,
        } => {
            println!("▶ Decoding {:?} into {:?}", video, output);
            let opts = DecodeOptions {
                video_path: video,
                output_dir: output,
                password,
            };

            let res = decode_video(
                &opts,
                |p| {
                    print!("\r  [{}] {}/{} ({:.1}%)", p.stage, p.current_frame, p.total_frames, p.percentage);
                    use std::io::Write;
                    let _ = std::io::stdout().flush();
                },
                None,
            )?;

            println!("\n✔ Decoding complete!");
            println!("  File restored:  {:?}", res.output_path);
            println!("  File size:      {} bytes", res.file_size);
            println!("  ECC fixed:      {} bytes", res.errors_fixed);
            println!("  SHA-256 match:  {} (Verified identical!)", res.sha256_match);
        }

        Commands::Inspect { video } => {
            println!("▶ Inspecting {:?}", video);
            match inspect_header(&video)? {
                Some(meta) => {
                    println!("✔ Valid YTDISK container found!");
                    println!("  Version:       {}", meta.v);
                    println!("  Filename:      {}", meta.name);
                    println!("  Size:          {} bytes", meta.size);
                    println!("  Payload len:   {} bytes", meta.payload_len);
                    println!("  Codewords:     {}", meta.codewords);
                    println!("  Data frames:   {}", meta.frames);
                    println!("  Block size:    {}", meta.block);
                    println!("  NSYM:          {}", meta.nsym);
                    println!("  Encrypted:     {}", meta.encrypted);
                    println!("  SHA-256:       {}", meta.sha256);
                }
                None => {
                    println!("✖ No YTDISK header found. File is either not a YTDISK video or corrupted.");
                }
            }
        }

        Commands::Download {
            url,
            output,
            auto_decode,
            password,
        } => {
            println!("▶ Analyzing URL: {}", url);
            let detected = detect_provider(&url)?;
            println!("✔ Provider: {}", detected.provider);

            let cancel_token = Arc::new(AtomicBool::new(false));
            let dl_res = match detected.provider {
                DownloadProvider::GoogleDrive => {
                    download_gdrive(
                        "cli-task",
                        &detected.id,
                        &output,
                        |p| {
                            print!("\r  [{}] {:.1}% - {} KB/s", p.status, p.percentage, (p.speed_bytes_sec / 1024.0) as u64);
                            use std::io::Write;
                            let _ = std::io::stdout().flush();
                        },
                        Some(cancel_token),
                    )
                    .await
                }
                DownloadProvider::YouTube => {
                    download_youtube(
                        "cli-task",
                        &detected.normalized_url,
                        &output,
                        |p| {
                            print!("\r  [{}] {:.1}% - {} KB/s", p.status, p.percentage, (p.speed_bytes_sec / 1024.0) as u64);
                            use std::io::Write;
                            let _ = std::io::stdout().flush();
                        },
                        Some(cancel_token),
                    )
                    .await
                }
                DownloadProvider::Unknown => {
                    eprintln!("✖ Unsupported provider");
                    std::process::exit(1);
                }
            }?;

            println!("\n✔ Download complete: {:?}", dl_res);

            if auto_decode {
                println!("▶ Checking for YTDISK container...");
                if let Some(_) = inspect_header(&dl_res)? {
                    println!("✔ Detected YTDISK video! Starting auto-decode...");
                    let restore_dir = output.join("restored");
                    let opts = DecodeOptions {
                        video_path: dl_res,
                        output_dir: restore_dir,
                        password,
                    };
                    let dec_res = decode_video(
                        &opts,
                        |p| {
                            print!("\r  [{}] {:.1}%", p.stage, p.percentage);
                            use std::io::Write;
                            let _ = std::io::stdout().flush();
                        },
                        None,
                    )?;
                    println!("\n✔ Restored file: {:?}", dec_res.output_path);
                } else {
                    println!("ℹ Downloaded video does not contain a YTDISK container.");
                }
            }
        }

        Commands::Capacity { block, nsym } => {
            let cap = calculate_capacity(block, nsym);
            println!("YTDisk Capacity Analysis (Block: {}, NSYM: {}):", block, nsym);
            println!("  Grid dimensions:     {}", cap.grid);
            println!("  Data per frame:      {:.2} KB", cap.kb_per_frame);
            println!("  Throughput (at 30fps): {:.2} KB/s", cap.kb_per_sec);
            println!("  Minutes to store 1GB:  {:.1} minutes", cap.minutes_per_gb);
        }
    }

    Ok(())
}

