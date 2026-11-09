#!/usr/bin/env bash
# ==============================================================================
# YTDisk User Installation Script (Arch Linux / Linux Desktop)
# Installs binaries to ~/.local/bin and desktop launcher to ~/.local/share/applications
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"

mkdir -p "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"

GUI_SRC="$SCRIPT_DIR/src-tauri/target/release/ytdisk"
CLI_SRC="$SCRIPT_DIR/src-tauri/target/release/ytdisk-cli"

if [ ! -f "$GUI_SRC" ] || [ ! -f "$CLI_SRC" ]; then
    echo "Release binaries not found. Building them now..."
    npm run build
    cargo build --manifest-path "$SCRIPT_DIR/src-tauri/Cargo.toml" --release
fi

echo "Installing binaries into $BIN_DIR..."
cp "$CLI_SRC" "$BIN_DIR/ytdisk-cli"
chmod +x "$BIN_DIR/ytdisk-cli"

cp "$GUI_SRC" "$BIN_DIR/ytdisk"
chmod +x "$BIN_DIR/ytdisk"

echo "Installing application icon into $ICON_DIR..."
cp "$SCRIPT_DIR/src-tauri/icons/128x128.png" "$ICON_DIR/ytdisk.png"

echo "Creating desktop shortcut at $DESKTOP_DIR/ytdisk.desktop..."
cat <<EOF > "$DESKTOP_DIR/ytdisk.desktop"
[Desktop Entry]
Name=YTDisk
Comment=High-Density Optical Video Storage with Reed-Solomon ECC
Exec=$BIN_DIR/ytdisk
Icon=ytdisk
Terminal=false
Type=Application
Categories=Utility;FileTools;Archiving;
Keywords=ytdisk;storage;reed-solomon;youtube;backup;
StartupWMClass=ytdisk
EOF

chmod +x "$DESKTOP_DIR/ytdisk.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" || true
fi

echo "=========================================================="
echo "✔ Installation complete!"
echo "  • CLI binary:    $BIN_DIR/ytdisk-cli"
echo "  • Desktop app:   $BIN_DIR/ytdisk"
echo "  • Menu launcher: $DESKTOP_DIR/ytdisk.desktop"
echo "You can now run 'ytdisk-cli' or 'ytdisk' directly from anywhere!"
echo "=========================================================="
