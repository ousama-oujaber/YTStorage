# 💿 YTDisk (YTStorage) — High-Density Optical Video Storage Engine

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)
[![Live Website](https://img.shields.io/badge/Live_Website-GitHub_Pages-06b6d4.svg?style=for-the-badge&logo=github)](https://ousama-oujaber.github.io/YTStorage/)
![Rust](https://img.shields.io/badge/Rust-2024_Edition-orange.svg?style=for-the-badge&logo=rust)
![Tauri](https://img.shields.io/badge/Tauri_v2-Desktop_GUI-24C8DB.svg?style=for-the-badge&logo=tauri)
![React](https://img.shields.io/badge/React_19-TypeScript-61DAFB.svg?style=for-the-badge&logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-Obsidian_Optical-06B6D4.svg?style=for-the-badge&logo=tailwindcss)
![Security](https://img.shields.io/badge/Security-AES--256--GCM_%2B_Scrypt-success.svg?style=for-the-badge&logo=shield)
![Compatibility](https://img.shields.io/badge/Python_Interop-100%25_Bit--for--Bit-brightgreen.svg?style=for-the-badge&logo=python)

<p align="center">
  <b>Turn YouTube and Google Drive into infinite, resilient cold storage.</b><br/>
  Encode arbitrary digital files into pristine 4K video streams with Reed–Solomon forward error correction, matrix temporal interleaving, and zero-knowledge AES-256-GCM encryption.
</p>

[🌐 Live Website](https://ousama-oujaber.github.io/YTStorage/) •
[✨ Features](#-key-features) •
[📥 Releases & Downloads](#-downloads--releases) •
[🚀 Quickstart](#-quickstart) •
[💻 CLI Guide](#-cli-reference-ytdisk-cli) •
[📐 Architecture](#-system-architecture) •
[🧪 Verification & Tests](#-verification--test-results)

</div>

---

## ⚡ Key Features

* **Obsidian Optical Workstation UI:** Designed with Google Stitch, featuring a military-grade dark aesthetic, reactive cyan/emerald laser telemetry, micro-grid block selectors, CRT scanline overlays, and live optical dot-matrix visualizers.
* **4K UHD Optical Density:** Encodes binary data into high-contrast monochrome pixel blocks (4×4, 8×8, 16×16) rendered at 1920×1080 and upscaled to 3840×2160 (4K) via nearest-neighbor interpolation, forcing video platforms to allocate ultra-high bitrate VP9/AV1 profiles.
* **Resilient Reed–Solomon ECC:** Implemented over Galois Field $\text{GF}(2^8)$ with primitive polynomial $0x11d$. Transposed matrix interleaving disperses spatial macroblock compression artifacts across independent codewords to defeat burst corruption.
* **Zero-Knowledge Authenticated Cryptography:** Optional AES-256-GCM encryption powered by Scrypt key derivation ($N=32768, r=8, p=1$). Passwords and raw keys are zeroized in memory and never stored in logs or configuration files.
* **Instant Header Inspector:** Reads container metadata, file attributes, and encryption flags from the initial 30 header frames in under 150 ms without decompressing or downloading the full video.
* **Automated Cloud Downloader:** Built-in streaming ingestion daemon for YouTube (via `yt-dlp`) and Google Drive (resumable chunked streaming), with real-time ETA, throughput telemetry, and automatic container recognition.
* **100% Strict Bidirectional Interoperability:** Certified byte-for-byte parity with the legacy Python reference implementation (`main.py`). Videos encoded by Python can be decoded by Rust, and vice-versa.

---

## 📥 Downloads & Releases

Pre-compiled production binaries for Linux x86_64 are available under [GitHub Releases](https://github.com/ousama-oujaber/YTStorage/releases/tag/v1.0.0):

| Package / Format | Target Distros | Installation / Usage |
| :--- | :--- | :--- |
| **`YTDisk_1.0.0_amd64.deb`** | Ubuntu, Debian, Pop!_OS, Linux Mint | `sudo dpkg -i YTDisk_1.0.0_amd64.deb` |
| **`YTDisk-1.0.0-1.x86_64.rpm`** | Fedora, RHEL, Rocky Linux, openSUSE | `sudo rpm -i YTDisk-1.0.0-1.x86_64.rpm` |
| **`ytdisk-v1.0.0-linux-x86_64.tar.gz`** | Any Linux (Arch, Void, Gentoo, Alpine) | Extract and run `./run.sh` or `./install-user.sh` |
| **User Direct Installer** | Arch Linux / User Home (`~/.local/bin`) | `./install-user.sh` |

### Checksums (SHA-256)
```text
cd669f5c1e9575b36dbce62cd2cf5257f11d69e040abf5d181db01ca1350e1ca  YTDisk-1.0.0-1.x86_64.rpm
44899b601f759f8be2be0fe574960286a8988d8b0467493c89f873f4781a8200  YTDisk_1.0.0_amd64.deb
decf9a2fd4f806ffa99027ab82afde361944bedc37dfff12a4f497be4ac4fdab  ytdisk-v1.0.0-linux-x86_64.tar.gz
```

---

## 📐 System Architecture

```
                                  [ Arbitrary File ]
                                         │
                        ┌────────────────┴────────────────┐
                        │ AES-256-GCM + Scrypt KDF (Opt)  │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │ Reed-Solomon ECC + Interleaving │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │  Monochrome Matrix Frame Raster │
                        │      (1920x1080 @ 30 FPS)       │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │ FFmpeg Nearest-Neighbor Upscale │
                        │       (3840x2160 4K UHD)        │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │     Platform Cloud Storage      │
                        │    (YouTube / Google Drive)     │
                        └─────────────────────────────────┘
```

### Technical Layout
```text
ytdisk/
├── src/                          # Obsidian Optical Frontend (React 19 + TypeScript + Vite)
│   ├── components/
│   │   ├── Header.tsx            # Telemetry status, radar pulse, navigation tabs
│   │   ├── EncodeView.tsx        # 2-column workstation bento grid & visualizer
│   │   ├── DownloadView.tsx      # YouTube & GDrive stream ingestion pipeline
│   │   ├── DecodeView.tsx        # Container inspector, SHA-256 validation banner
│   │   ├── QueueView.tsx         # Concurrent task manager & cancel daemon
│   │   ├── HistoryView.tsx       # Forensic audit journal with JSON persistence
│   │   └── SettingsModal.tsx     # Diagnostic detector (FFmpeg, yt-dlp) & paths
│   └── App.tsx                   # Master shell with floating system ribbon
├── src-tauri/                    # Core High-Performance Rust Engine
│   ├── src/
│   │   ├── engine/               # Optical encoding, ECC, frames & crypto
│   │   ├── downloader/           # Resumable chunk downloader & yt-dlp wrapper
│   │   ├── tasks/                # Background async task queue
│   │   ├── commands.rs           # Tauri IPC endpoints
│   │   └── bin/cli.rs            # Standalone CLI binary (ytdisk-cli)
│   └── tests/
│       └── integration_tests.rs  # End-to-end integration test suite
├── main.py                       # Certified Python reference script (100% interoperable)
├── install-user.sh               # Arch Linux desktop and binary user installer
└── run.sh                        # Universal environment wrapper launcher
```

---

## 🚀 Quickstart

### Prerequisites
* **FFmpeg:** `sudo pacman -S ffmpeg` (Arch) or `sudo apt install ffmpeg` (Ubuntu)
* **yt-dlp:** `sudo pacman -S yt-dlp` (Optional, required for YouTube ingestion)

### Run without root installation (Arch Linux)
```bash
git clone https://github.com/ousama-oujaber/YTStorage.git
cd YTStorage

# Launch the Desktop UI directly
./run.sh

# Or install to ~/.local/bin and desktop launcher:
./install-user.sh
```

---

## 💻 CLI Reference (`ytdisk-cli`)

YTDisk includes a high-performance standalone CLI binary compiled directly from the Rust core.

### 1. Calculate Storage Capacity
Estimate data throughput and video duration for any block and parity configuration:
```bash
ytdisk-cli capacity --block 4 --nsym 32
```
*Output:*
```text
YTDisk Capacity Analysis (Block: 4, NSYM: 32):
  Grid dimensions:       480x270
  Data per frame:        15.82 KB
  Throughput (at 30fps): 415.05 KB/s
  Minutes to store 1GB:  42.1 minutes
```

### 2. Encode File to 4K Video
Encode an archive or binary with AES-256-GCM encryption and 4K upscaling:
```bash
ytdisk-cli encode database.tar.gz -o cold_storage.mp4 --password "VaultMasterKey2026!" --upscale-4k
```

### 3. Inspect Container Metadata
Inspect a video's header without decoding or uncompressing data frames:
```bash
ytdisk-cli inspect cold_storage.mp4
```
*Output:*
```text
✔ Valid YTDISK container found!
  Version:       1
  Filename:      database.tar.gz
  Size:          52,428,800 bytes
  Data frames:   3,780
  Block size:    4
  NSYM:          32
  Encrypted:     true
  SHA-256:       b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
```

### 4. Decode and Verify Video
Extract the original payload with systematic SHA-256 verification and Reed–Solomon recovery:
```bash
ytdisk-cli decode cold_storage.mp4 -o ./restored/ --password "VaultMasterKey2026!"
```

### 5. Download and Auto-Decode from Cloud
Download directly from YouTube or Google Drive and extract on-the-fly:
```bash
ytdisk-cli download "https://www.youtube.com/watch?v=VIDEO_ID" -o ./downloads/ --auto-decode
```

---

## 🧪 Verification & Test Results

### 1. Automated Rust Unit & Integration Tests
All unit and integration tests are continuously executed:
```bash
cd src-tauri && cargo test
```
```text
running 9 tests
test engine::frame::tests::test_bits_bytes_roundtrip ... ok
test engine::ecc::tests::test_ecc_corruption_recovery ... ok
test engine::ecc::tests::test_ecc_roundtrip ... ok
test downloader::detector::tests::test_detect_gdrive ... ok
test downloader::detector::tests::test_unsupported_domains ... ok
test downloader::detector::tests::test_detect_youtube ... ok
test engine::frame::tests::test_frame_bits_roundtrip ... ok
test engine::header::tests::test_header_frame_roundtrip ... ok
test engine::crypto::tests::test_encrypt_decrypt_roundtrip ... ok

test result: ok. 9 passed; 0 failed; finished in 10.43s

running 3 integration tests
test test_provider_detection ... ok
test test_integration_encode_decode_plaintext ... ok
test test_integration_encode_decode_encrypted ... ok

test result: ok. 3 passed; 0 failed; finished in 12.24s
```

### 2. Full Bidirectional Cross-Language Compatibility
Run the automated compatibility suite to verify byte-for-byte fidelity with the reference Python implementation:
```bash
./scripts/test_compatibility.sh
```
```text
==========================================================
YTDisk — Full Bidirectional Compatibility Test Suite
==========================================================
Original payload SHA-256: ee8ff78ba241226d0f066fa7b6b92dbd12b18402d122217fc5a1f7701558095b

--- 2. Rust CLI Encode -> Python Decode (Encrypted) ---
✔ Encoding complete!
IDENTICAL, byte for byte! → Restored: ee8ff78ba241226d...
✔ SUCCESS: Rust -> Python hash matches perfectly!

--- 3. Python Encode -> Rust CLI Decode (Encrypted) ---
✔ Decoding complete!
SHA-256 match: true (Verified identical!)
✔ SUCCESS: Python -> Rust hash matches perfectly!

--- 4. Rust CLI Encode -> Rust CLI Decode (Plaintext) ---
✔ SUCCESS: Rust Plaintext round-trip verified!
==========================================================
🎉 ALL TESTS PASSED: 100% BIT-FOR-BIT COMPATIBILITY PROVEN!
==========================================================
```

---

## ⚙️ Mathematical & Encoding Specifications

| Parameter | Specification | Purpose |
| :--- | :--- | :--- |
| **Native Canvas** | $1920 \times 1080$ @ 30 FPS | Primary monochrome raster |
| **Platform Upscale** | $3840 \times 2160$ (4K UHD) | Triggers YouTube 4K VP9/AV1 high-bitrate profile |
| **Scaling Kernel** | Nearest-Neighbor (`flags=neighbor`) | Retains 100% crisp block edges without antialiasing blur |
| **Galois Field** | $\text{GF}(2^8)$ (`0x11d`) | Standard primitive polynomial for Reed-Solomon |
| **Generator Roots** | $\alpha = 2$, $\text{fcr} = 0$ | Compatibility with PyECLib / reedsolo reference |
| **Codeword Length** | $N = 255$ bytes | Maximum symbol space for 8-bit ECC |
| **Interleaving** | 2D Matrix Transposition ($M^T$) | Converts video macroblock bursts into isolated byte errors |
| **Key Derivation** | Scrypt ($N=32768, r=8, p=1$) | ASIC-resistant password hashing |
| **Authenticated Cipher** | AES-256-GCM (12-byte nonce, 16-byte tag) | Tamper-proof encryption |
| **Sampling Boundary** | Center box with margin $m = \lfloor \text{block} / 4 \rfloor$ | Eliminates border ringing and compression bleeding |

---

## 🛠️ Building from Source

### 1. Arch Linux / Manjaro
```bash
sudo pacman -S --needed base-devel nodejs npm rust ffmpeg webkit2gtk-4.1
npm install
npm run build
cargo build --manifest-path src-tauri/Cargo.toml --release
```

### 2. Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y build-essential curl libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libssl-dev ffmpeg
npm install
npm run tauri build
```

---

## 📄 License

Distributed under the **MIT License**. Created and maintained by [Ousama Oujaber](https://github.com/ousama-oujaber).
