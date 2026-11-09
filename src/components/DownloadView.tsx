import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DownloadCloud,
  Video,
  Cloud,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  X,
  StopCircle,
  Lock,
  ArrowRight,
  FolderOpen,
  Activity,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { formatBytes, formatDuration, formatSpeed } from "../lib/utils";
import { DetectedSource, DownloadProgress, Metadata } from "../types";

interface DownloadViewProps {
  onTaskStarted: (taskId: string, name: string) => void;
  activeProgress?: DownloadProgress;
  isDownloading: boolean;
  onCancel: (taskId: string) => void;
  currentTaskId: string | null;
  onNavigateToDecode: (videoPath: string) => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({
  onTaskStarted,
  activeProgress,
  isDownloading,
  onCancel,
  currentTaskId,
  onNavigateToDecode,
}) => {
  const [url, setUrl] = useState<string>("");
  const [detected, setDetected] = useState<DetectedSource | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [outputDir, setOutputDir] = useState<string>("");
  const [autoDecode, setAutoDecode] = useState<boolean>(true);
  const [decodePassword, setDecodePassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [downloadResultPath, setDownloadResultPath] = useState<string | null>(null);
  const [isYtdiskVideo, setIsYtdiskVideo] = useState<boolean | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [inspectedMeta, setInspectedMeta] = useState<Metadata | null>(null);

  // Auto-detect provider on URL change
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setDetected(null);
      setDetectError(null);
      return;
    }

    const timer = setTimeout(() => {
      invoke<DetectedSource>("detect_url_provider", { url: trimmed })
        .then((res) => {
          setDetected(res);
          setDetectError(null);
        })
        .catch((err) => {
          setDetected(null);
          setDetectError(typeof err === "string" ? err : "Unsupported URL format. Only YouTube and Google Drive are allowed.");
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [url]);

  const handlePickDir = async () => {
    try {
      const selected = await invoke<string | null>("pick_directory", {
        title: "Select Download Destination Folder",
      });
      if (selected) {
        setOutputDir(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartDownload = async () => {
    if (!url.trim() || !detected) return;

    const taskId = `download-${Date.now()}`;
    setDownloadResultPath(null);
    setIsYtdiskVideo(null);
    setDownloadError(null);
    setInspectedMeta(null);
    onTaskStarted(taskId, `${detected.provider} Download`);

    try {
      const videoPath = await invoke<string>("start_download_command", {
        taskId,
        url: url.trim(),
        destinationDir: outputDir.trim() ? outputDir : null,
      });

      setDownloadResultPath(videoPath);

      // Inspect downloaded video to check if it's a YTDisk container
      try {
        const meta = await invoke<Metadata | null>("inspect_video_header", {
          videoPath,
        });
        if (meta) {
          setIsYtdiskVideo(true);
          setInspectedMeta(meta);
          if (autoDecode) {
            onNavigateToDecode(videoPath);
          }
        } else {
          setIsYtdiskVideo(false);
        }
      } catch (err) {
        console.error("Header inspection failed:", err);
        setIsYtdiskVideo(false);
      }
    } catch (err: any) {
      console.error("Download failed:", err);
      setDownloadError(typeof err === "string" ? err : "Download failed");
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Top Breadcrumb & Status Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
            <DownloadCloud className="w-3.5 h-3.5" />
            STREAM INGESTION ENGINE
          </span>
          <span className="text-white/20">/</span>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            YouTube & Google Drive Download Manager
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            RESTRICTED DOMAINS: YOUTUBE • GOOGLE DRIVE ONLY
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Input Configuration (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-5 border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2 font-mono">
                <Cloud className="w-4 h-4 text-cyan-400" />
                Target Video URL & Destination
              </span>
              <span className="font-mono text-[10px] text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded">
                HTTP RANGE & YT-DLP DAEMON
              </span>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-medium text-foreground flex items-center justify-between">
                <span>Direct Media / Video URL</span>
                {detected && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                    detected.provider === "YouTube"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  }`}>
                    {detected.provider === "YouTube" ? <Video className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                    {detected.provider} Detected
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/file/d/..."
                  className="w-full bg-black/40 border border-white/[0.1] focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all pr-10"
                />
                {url && (
                  <button
                    onClick={() => setUrl("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {detectError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{detectError}</span>
                </div>
              )}
            </div>

            {/* Destination folder */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-medium text-foreground">
                Download Destination Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="Default (~/Downloads/)"
                  className="flex-1 bg-black/40 border border-white/[0.1] focus:border-cyan-400 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePickDir}
                  className="font-mono text-xs h-9 px-3 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1" />
                  Browse...
                </Button>
              </div>
            </div>

            {/* Auto Decode & Decryption options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
              <div className="flex flex-col justify-between p-3 rounded-lg bg-black/40 border border-white/[0.08]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-semibold text-foreground block">
                      Auto-Decode on Completion
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Automatically route to decoder tab if a valid YTDisk container is recognized.
                    </span>
                  </div>
                  <Switch checked={autoDecode} onCheckedChange={setAutoDecode} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3 text-cyan-400" />
                    Decryption Password (Optional)
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={decodePassword}
                    onChange={(e) => setDecodePassword(e.target.value)}
                    placeholder="If container was encrypted..."
                    className="w-full bg-black/40 border border-white/[0.1] focus:border-cyan-400 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleStartDownload}
              disabled={!url.trim() || !detected || isDownloading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-[0_0_24px_-4px_rgba(6,182,212,0.35)] flex items-center justify-center gap-2 group active:scale-[0.99] border border-white/20 text-sm"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>
                {isDownloading ? "DOWNLOADING STREAM..." : `START ${detected?.provider.toUpperCase() || ""} DOWNLOAD`}
              </span>
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Download Telemetry (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-4 border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-mono text-xs font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Transfer Telemetry Stream
              </span>
              <span className="font-mono text-[10px] text-cyan-400 bg-white/[0.04] px-2 py-0.5 rounded font-bold">
                {isDownloading ? activeProgress?.status || "TRANSFERRING" : "STANDBY"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="text-foreground">
                  {isDownloading ? activeProgress?.file_name || "Receiving chunks..." : "Idle"}
                </span>
                <span className="text-cyan-400 font-bold">
                  {isDownloading ? `${(activeProgress?.percentage || 0).toFixed(1)}%` : "0%"}
                </span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden relative p-0.5 border border-white/[0.08]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full relative transition-all duration-200"
                  style={{ width: `${activeProgress?.percentage || 0}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_#ffffff]" />
                </div>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-black/40 border border-white/[0.06] text-center font-mono">
              <div>
                <span className="text-muted-foreground text-[9px] block">SPEED</span>
                <span className="font-bold text-cyan-400 text-xs">
                  {activeProgress?.speed_bytes_sec ? formatSpeed(activeProgress.speed_bytes_sec) : "0 B/s"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">DOWNLOADED</span>
                <span className="font-bold text-foreground text-xs">
                  {activeProgress?.downloaded_bytes ? formatBytes(activeProgress.downloaded_bytes) : "0 B"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">ETA</span>
                <span className="font-bold text-emerald-400 text-xs">
                  {activeProgress?.eta_seconds ? formatDuration(activeProgress.eta_seconds) : "--:--"}
                </span>
              </div>
            </div>

            {/* Terminal log output */}
            <div className="bg-black/80 rounded-lg border border-white/[0.08] p-3 font-mono text-[10px] space-y-1 text-muted-foreground max-h-28 overflow-y-auto">
              <div>[NET] Download manager listening on secure TLS...</div>
              {detected && (
                <div className="text-cyan-400">
                  [RESOLVE] Target identified: {detected.provider} (ID: {detected.id})
                </div>
              )}
              {isDownloading && (
                <div className="text-foreground">
                  [STREAM] Chunk stream active @ {formatSpeed(activeProgress?.speed_bytes_sec || 0)}
                </div>
              )}
              {downloadResultPath && (
                <div className="text-emerald-400 font-bold">
                  [SUCCESS] Saved: {downloadResultPath.split("/").pop()}
                </div>
              )}
              {downloadError && (
                <div className="text-rose-400 font-bold">
                  [ERROR] {downloadError}
                </div>
              )}
            </div>

            {isDownloading && currentTaskId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancel(currentTaskId)}
                className="w-full font-mono text-xs"
              >
                <StopCircle className="w-3.5 h-3.5 mr-1.5" />
                Abort Transfer
              </Button>
            )}
          </div>

          {/* Container Recognition Card */}
          {downloadResultPath && (
            <div className="glass-panel border-cyan-500/40 rounded-xl p-4 bg-cyan-500/10 space-y-3 font-mono shadow-[0_0_20px_-4px_rgba(6,182,212,0.3)]">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Download Finished!</span>
              </div>
              <p className="text-xs text-muted-foreground break-all">
                {downloadResultPath}
              </p>

              {isYtdiskVideo === true && inspectedMeta && (
                <div className="p-3 rounded-lg bg-black/60 border border-emerald-500/40 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Valid YTDisk Container Recognized!</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Contained Payload: <strong className="text-foreground">{inspectedMeta.name}</strong></p>
                    <p>Original Size: <strong className="text-foreground">{formatBytes(inspectedMeta.size)}</strong></p>
                    <p>Encrypted: <strong className={inspectedMeta.encrypted ? "text-cyan-400" : "text-foreground"}>{inspectedMeta.encrypted ? "Yes" : "No"}</strong></p>
                  </div>
                  <Button
                    onClick={() => onNavigateToDecode(downloadResultPath)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs mt-2"
                  >
                    <span>Proceed to Decode File</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              )}

              {isYtdiskVideo === false && (
                <div className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Standard video file (no YTDisk header metadata found).</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
