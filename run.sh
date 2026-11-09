#!/usr/bin/env bash
# ==============================================================================
# YTDisk Launcher for Arch Linux
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure local webkit2gtk libraries are in LD_LIBRARY_PATH if present
if [ -d "$HOME/.local/opt/webkit2gtk/usr/lib" ]; then
    export LD_LIBRARY_PATH="$HOME/.local/opt/webkit2gtk/usr/lib:${LD_LIBRARY_PATH:-}"
fi

# Locate release binary, fallback to debug if release isn't built
GUI_BIN="$SCRIPT_DIR/src-tauri/target/release/ytdisk"
CLI_BIN="$SCRIPT_DIR/src-tauri/target/release/ytdisk-cli"

if [ ! -f "$GUI_BIN" ]; then
    GUI_BIN="$SCRIPT_DIR/src-tauri/target/debug/ytdisk"
fi

if [ ! -f "$CLI_BIN" ]; then
    CLI_BIN="$SCRIPT_DIR/src-tauri/target/debug/ytdisk-cli"
fi

# Dispatch based on arguments
if [ "${1:-}" = "cli" ]; then
    shift
    exec "$CLI_BIN" "$@"
elif [ -n "${1:-}" ] && [ "$1" != "--gui" ]; then
    # If passed any arguments other than --gui, route to CLI
    exec "$CLI_BIN" "$@"
else
    # Launch Desktop GUI
    echo "Launching YTDisk Desktop UI..."
    exec "$GUI_BIN"
fi
