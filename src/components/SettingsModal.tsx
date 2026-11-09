import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Settings,
  X,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { AppSettings, DependencyStatus } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deps: DependencyStatus | null;
  onSettingsSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  deps,
  onSettingsSaved,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      invoke<AppSettings>("get_settings")
        .then(setSettings)
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !settings) return null;

  const handlePickDir = async (key: "download_dir" | "restore_dir" | "video_output_dir") => {
    try {
      const selected = await invoke<string | null>("pick_directory", {
        title: `Select Folder for ${key}`,
      });
      if (selected) {
        setSettings({ ...settings, [key]: selected });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings });
      setSavedSuccess(true);
      onSettingsSaved();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = () => {
    setSettings({
      download_dir: "~/Downloads/YTDisk",
      restore_dir: "~/Downloads/YTDisk/Restored",
      video_output_dir: "~/Videos/YTDisk",
      auto_decode: true,
      default_block: 4,
      default_nsym: 32,
      default_crf: 12,
      theme: "dark",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.12] glass-panel p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center space-x-2.5">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-foreground font-mono">
              YTDisk System & Engine Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostics */}
        <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/40 space-y-2">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            System Prerequisites & Diagnostics
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-2.5 bg-black/60 rounded-lg border border-white/[0.06] text-xs font-mono">
              <div>
                <span className="font-semibold block text-foreground">FFmpeg Engine</span>
                <span className="text-[10px] text-muted-foreground truncate block max-w-[170px]">
                  {deps?.ffmpeg_path || "Not detected in PATH"}
                </span>
              </div>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                  deps?.ffmpeg_available
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                }`}
              >
                {deps?.ffmpeg_available ? "INSTALLED" : "MISSING"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-black/60 rounded-lg border border-white/[0.06] text-xs font-mono">
              <div>
                <span className="font-semibold block text-foreground">yt-dlp Downloader</span>
                <span className="text-[10px] text-muted-foreground truncate block max-w-[170px]">
                  {deps?.ytdlp_path || "Not detected in PATH"}
                </span>
              </div>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                  deps?.ytdlp_available
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                }`}
              >
                {deps?.ytdlp_available ? "INSTALLED" : "MISSING"}
              </span>
            </div>
          </div>
        </div>

        {/* Storage paths */}
        <div className="space-y-3 font-mono text-xs">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Default Storage Directories
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Video Output Directory (Encoded 4K Videos)</span>
                <button onClick={() => handlePickDir("video_output_dir")} className="text-cyan-400 hover:underline">
                  Browse...
                </button>
              </div>
              <input
                type="text"
                value={settings.video_output_dir}
                onChange={(e) => setSettings({ ...settings, video_output_dir: e.target.value })}
                className="w-full bg-black/40 border border-white/[0.1] rounded px-3 py-1.5 text-foreground text-xs font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Downloads Directory</span>
                <button onClick={() => handlePickDir("download_dir")} className="text-cyan-400 hover:underline">
                  Browse...
                </button>
              </div>
              <input
                type="text"
                value={settings.download_dir}
                onChange={(e) => setSettings({ ...settings, download_dir: e.target.value })}
                className="w-full bg-black/40 border border-white/[0.1] rounded px-3 py-1.5 text-foreground text-xs font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Restored Files Directory (Decoded Payloads)</span>
                <button onClick={() => handlePickDir("restore_dir")} className="text-cyan-400 hover:underline">
                  Browse...
                </button>
              </div>
              <input
                type="text"
                value={settings.restore_dir}
                onChange={(e) => setSettings({ ...settings, restore_dir: e.target.value })}
                className="w-full bg-black/40 border border-white/[0.1] rounded px-3 py-1.5 text-foreground text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Defaults & Automation */}
        <div className="space-y-3 pt-1 border-t border-white/[0.08] font-mono text-xs">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Automation & Pipeline Defaults
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.08] bg-black/40">
            <div>
              <span className="font-semibold block text-foreground">Automatic Post-Download Decoding</span>
              <span className="text-[10px] text-muted-foreground block">
                Automatically verify and decode containers immediately after YouTube or Google Drive download finishes.
              </span>
            </div>
            <Switch
              checked={settings.auto_decode}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_decode: checked })}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] font-mono">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Reset Defaults</span>
          </Button>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>{savedSuccess ? "Saved!" : "Save Settings"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
