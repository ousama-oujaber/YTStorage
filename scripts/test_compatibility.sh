#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "YTDisk — Full Bidirectional Compatibility Test Suite"
echo "=========================================================="

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Check CLI binary
CLI_BIN="$REPO_DIR/src-tauri/target/release/ytdisk-cli"
if [ ! -f "$CLI_BIN" ]; then
    CLI_BIN="$REPO_DIR/src-tauri/target/debug/ytdisk-cli"
fi

if [ ! -f "$CLI_BIN" ]; then
    echo "Error: ytdisk-cli binary not found. Build it first."
    exit 1
fi

PYTHON_BIN="$REPO_DIR/.venv/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

echo "Using CLI binary: $CLI_BIN"
echo "Using Python:     $PYTHON_BIN"

TMP_DIR=$(mktemp -d /tmp/ytdisk_compat_XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

echo ""
echo "--- 1. Generating test payload (100 KB random) ---"
head -c 102400 /dev/urandom > "$TMP_DIR/input.bin"
ORIGINAL_HASH=$(sha256sum "$TMP_DIR/input.bin" | awk '{print $1}')
echo "Original payload SHA-256: $ORIGINAL_HASH"

echo ""
echo "--- 2. Rust CLI Encode -> Python Decode (Encrypted) ---"
PASSWORD="TestSecretKey_2026!"
"$CLI_BIN" encode "$TMP_DIR/input.bin" -o "$TMP_DIR/rust_encoded.mp4" -p "$PASSWORD" --upscale-4k
"$PYTHON_BIN" main.py decode "$TMP_DIR/rust_encoded.mp4" --password "$PASSWORD" -o "$TMP_DIR/py_decoded_dir"
RESTORED_HASH_1=$(sha256sum "$TMP_DIR/py_decoded_dir/input.bin" | awk '{print $1}')

if [ "$ORIGINAL_HASH" != "$RESTORED_HASH_1" ]; then
    echo "❌ FAILED: Hash mismatch in Rust -> Python decode!"
    exit 1
fi
echo "✔ SUCCESS: Rust -> Python hash matches perfectly!"

echo ""
echo "--- 3. Python Encode -> Rust CLI Decode (Encrypted) ---"
"$PYTHON_BIN" main.py encode "$TMP_DIR/input.bin" -o "$TMP_DIR/py_encoded.mp4" --password "$PASSWORD"
"$CLI_BIN" decode "$TMP_DIR/py_encoded.mp4" -o "$TMP_DIR/rust_decoded_dir" -p "$PASSWORD"
RESTORED_HASH_2=$(sha256sum "$TMP_DIR/rust_decoded_dir/input.bin" | awk '{print $1}')

if [ "$ORIGINAL_HASH" != "$RESTORED_HASH_2" ]; then
    echo "❌ FAILED: Hash mismatch in Python -> Rust decode!"
    exit 1
fi
echo "✔ SUCCESS: Python -> Rust hash matches perfectly!"

echo ""
echo "--- 4. Rust CLI Encode -> Rust CLI Decode (Plaintext) ---"
"$CLI_BIN" encode "$TMP_DIR/input.bin" -o "$TMP_DIR/rust_plain.mp4" --upscale-4k
"$CLI_BIN" decode "$TMP_DIR/rust_plain.mp4" -o "$TMP_DIR/rust_plain_dir"
RESTORED_HASH_3=$(sha256sum "$TMP_DIR/rust_plain_dir/input.bin" | awk '{print $1}')

if [ "$ORIGINAL_HASH" != "$RESTORED_HASH_3" ]; then
    echo "❌ FAILED: Hash mismatch in Rust Plaintext decode!"
    exit 1
fi
echo "✔ SUCCESS: Rust Plaintext round-trip verified!"

echo ""
echo "=========================================================="
echo "🎉 ALL TESTS PASSED: 100% BIT-FOR-BIT COMPATIBILITY PROVEN!"
echo "=========================================================="
