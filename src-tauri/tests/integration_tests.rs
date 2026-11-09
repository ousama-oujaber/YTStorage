use std::fs::File;
use std::io::Write;
use sha2::{Digest, Sha256};

use ytdisk_lib::downloader::detect_provider;
use ytdisk_lib::downloader::types::DownloadProvider;
use ytdisk_lib::engine::{
    decode_video, encode_file, inspect_header,
    DecodeOptions, EncodeOptions,
};

#[test]
fn test_integration_encode_decode_plaintext() {
    let temp_dir = std::env::temp_dir().join(format!("ytdisk_test_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();

    let input_path = temp_dir.join("test_file.txt");
    let test_data = b"This is a high-reliability optical storage test for YTDisk 4K engine!";
    {
        let mut f = File::create(&input_path).unwrap();
        f.write_all(test_data).unwrap();
    }

    let video_path = temp_dir.join("test_video.mp4");
    let encode_opts = EncodeOptions {
        input_path: input_path.clone(),
        output_path: video_path.clone(),
        block: 4,
        nsym: 32,
        crf: 12,
        password: None,
        upscale_4k: true,
    };

    let meta = encode_file(&encode_opts, |_| {}, None).expect("Encoding failed");
    assert_eq!(meta.size, test_data.len());
    assert_eq!(meta.sha256, format!("{:x}", Sha256::digest(test_data)));
    assert!(!meta.encrypted);
    assert!(video_path.exists());

    // Inspect header
    let inspected = inspect_header(&video_path).expect("Header inspect failed");
    assert!(inspected.is_some());
    let inspected_meta = inspected.unwrap();
    assert_eq!(inspected_meta.name, "test_file.txt");
    assert_eq!(inspected_meta.sha256, meta.sha256);

    // Decode
    let restore_dir = temp_dir.join("restored");
    let decode_opts = DecodeOptions {
        video_path: video_path.clone(),
        output_dir: restore_dir.clone(),
        password: None,
    };

    let result = decode_video(&decode_opts, |_| {}, None).expect("Decoding failed");
    assert!(result.success);
    assert!(result.sha256_match);
    assert_eq!(result.file_size, test_data.len());

    let restored_bytes = std::fs::read(&result.output_path).unwrap();
    assert_eq!(restored_bytes, test_data);

    let _ = std::fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_integration_encode_decode_encrypted() {
    let temp_dir = std::env::temp_dir().join(format!("ytdisk_enc_test_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();

    let input_path = temp_dir.join("confidential.bin");
    let mut test_data = Vec::with_capacity(1024);
    for i in 0..1024 {
        test_data.push(((i * 37 + 13) % 256) as u8);
    }
    {
        let mut f = File::create(&input_path).unwrap();
        f.write_all(&test_data).unwrap();
    }

    let password = "MyUltraSecurePassword_2026";
    let video_path = temp_dir.join("encrypted_vault.mp4");
    let encode_opts = EncodeOptions {
        input_path: input_path.clone(),
        output_path: video_path.clone(),
        block: 4,
        nsym: 32,
        crf: 12,
        password: Some(password.to_string()),
        upscale_4k: true,
    };

    let meta = encode_file(&encode_opts, |_| {}, None).expect("Encoding failed");
    assert!(meta.encrypted);
    assert_eq!(meta.size, test_data.len());

    // Decode with WRONG password should fail cleanly
    let restore_dir = temp_dir.join("restored");
    let decode_opts_wrong = DecodeOptions {
        video_path: video_path.clone(),
        output_dir: restore_dir.clone(),
        password: Some("WrongPassword!".to_string()),
    };
    assert!(decode_video(&decode_opts_wrong, |_| {}, None).is_err());

    // Decode with CORRECT password should succeed and verify bit-for-bit
    let decode_opts_correct = DecodeOptions {
        video_path: video_path.clone(),
        output_dir: restore_dir.clone(),
        password: Some(password.to_string()),
    };
    let result = decode_video(&decode_opts_correct, |_| {}, None).expect("Decoding failed");
    assert!(result.success);
    assert!(result.sha256_match);

    let restored_bytes = std::fs::read(&result.output_path).unwrap();
    assert_eq!(restored_bytes, test_data);

    let _ = std::fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_provider_detection() {
    let yt_res = detect_provider("https://www.youtube.com/watch?v=dQw4w9WgXcQ").unwrap();
    assert_eq!(yt_res.provider, DownloadProvider::YouTube);
    assert_eq!(yt_res.id, "dQw4w9WgXcQ");

    let gd_res = detect_provider("https://drive.google.com/file/d/1abcXYZ_456-789/view").unwrap();
    assert_eq!(gd_res.provider, DownloadProvider::GoogleDrive);
    assert_eq!(gd_res.id, "1abcXYZ_456-789");

    let invalid = detect_provider("https://randomwebsite.com/movie.mp4");
    assert!(invalid.is_err());
}
