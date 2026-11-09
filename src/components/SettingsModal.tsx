import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Settings,
  CheckCircle2,
  X,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-2.5">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">YTDisk Application Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Diagnostic Dependencies */}
        <div className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            System Prerequisites & Diagnostics
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border text-xs">
              <div>
                <span className="font-semibold block">FFmpeg Core Engine</span>
                <span className="text-[11px] text-muted-foreground truncate block max-w-[180px]">
                  {deps?.ffmpeg_path || "Not detected in PATH"}
                </span>
              </div>
              <Badge variant={deps?.ffmpeg_available ? "success" : "destructive"}>
                {deps?.ffmpeg_available ? "Installed" : "Missing"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border text-xs">
              <div>
                <span className="font-semibold block">yt-dlp Downloader</span>
                <span className="text-[11px] text-muted-foreground truncate block max-w-[180px]">
                  {deps?.ytdlp_path || "Not detected in PATH"}
                </span>
              </div>
              <Badge variant={deps?.ytdlp_available ? "success" : "destructive"}>
                {deps?.ytdlp_available ? "Installed" : "Missing"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Directory Paths */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Default Storage Directories
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between py-1">
                <span className="font-medium">Video Output Directory (Encoded 4K Videos)</span>
                <button
                  onClick={() => handlePickDir("video_output_dir")}
                  className="text-primary hover:underline"
                >
                  Browse...
                </button>
              </div>
              <Input
                type="text"
                value={settings.video_output_dir}
                onChange={(e) => setSettings({ ...settings, video_output_dir: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>

            <div>
              <div className="flex justify-between py-1">
                <span className="font-medium">Downloads Directory</span>
                <button
                  onClick={() => handlePickDir("download_dir")}
                  className="text-primary hover:underline"
                >
                  Browse...
                </button>
              </div>
              <Input
                type="text"
                value={settings.download_dir}
                onChange={(e) => setSettings({ ...settings, download_dir: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>

            <div>
              <div className="flex justify-between py-1">
                <span className="font-medium">Restored Files Directory (Decoded Files)</span>
                <button
                  onClick={() => handlePickDir("restore_dir")}
                  className="text-primary hover:underline"
                >
                  Browse...
                </button>
              </div>
              <Input
                type="text"
                value={settings.restore_dir}
                onChange={(e) => setSettings({ ...settings, restore_dir: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>
          </div>
        </div>

        {/* Defaults & Flags */}
        <div className="space-y-3 pt-1 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Defaults & Automation
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
            <div>
              <span className="text-xs font-semibold block">Automatic Post-Download Decoding</span>
              <span className="text-[11px] text-muted-foreground block">
                Automatically unpack YTDisk containers when download finishes.
              </span>
            </div>
            <Switch
              checked={settings.auto_decode}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_decode: checked })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block mb-1">Default Block Size</span>
              <select
                value={settings.default_block}
                onChange={(e) => setSettings({ ...settings, default_block: Number(e.target.value) })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value={4}>4x4 px (Standard 4K)</option>
                <option value={8}>8x8 px (Resilient)</option>
                <option value={16}>16x16 px (Ultra)</option>
              </select>
            </div>

            <div>
              <span className="text-muted-foreground block mb-1">Default ECC Parity (NSYM)</span>
              <select
                value={settings.default_nsym}
                onChange={(e) => setSettings({ ...settings, default_nsym: Number(e.target.value) })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value={16}>16 symbols</option>
                <option value={32}>32 symbols (Standard)</option>
                <option value={64}>64 symbols (High ECC)</option>
              </select>
            </div>

            <div>
              <span className="text-muted-foreground block mb-1">Default CRF (x264 Quality)</span>
              <Input
                type="number"
                min={0}
                max={51}
                value={settings.default_crf}
                onChange={(e) => setSettings({ ...settings, default_crf: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            <span>Reset to Defaults</span>
          </Button>

          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="text-xs">
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  <span>Save Settings</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
