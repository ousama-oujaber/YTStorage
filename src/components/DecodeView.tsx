import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileVideo,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  FileCheck2,
  FolderOpen,
  Sparkles,
  StopCircle,
  Activity,
} from "lucide-react";
import { Button } from "./ui/Button";
import { formatBytes } from "../lib/utils";
import { DecodeProgress, DecodeResult, Metadata } from "../types";

interface DecodeViewProps {
  onTaskStarted: (taskId: string, name: string) => void;
  activeProgress?: DecodeProgress;
  isDecoding: boolean;
  onCancel: (taskId: string) => void;
  currentTaskId: string | null;
  preselectedVideoPath?: string | null;
}

export const DecodeView: React.FC<DecodeViewProps> = ({
  onTaskStarted,
  activeProgress,
  isDecoding,
  onCancel,
  currentTaskId,
  preselectedVideoPath,
}) => {
  const [videoPath, setVideoPath] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [outputDir, setOutputDir] = useState<string>("");

  const [headerPreview, setHeaderPreview] = useState<Metadata | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);

  useEffect(() => {
    if (preselectedVideoPath) {
      setVideoPath(preselectedVideoPath);
      inspectHeader(preselectedVideoPath);
    }
  }, [preselectedVideoPath]);

  const inspectHeader = async (path: string) => {
    setIsInspecting(true);
    setInspectError(null);
    setHeaderPreview(null);
    try {
      const meta = await invoke<Metadata | null>("inspect_video_header", {
        videoPath: path,
      });
      if (meta) {
        setHeaderPreview(meta);
      } else {
        setInspectError("No valid YTDisk header found in video. Is this a YTDisk container?");
      }
    } catch (err: any) {
      setInspectError(typeof err === "string" ? err : "Failed to inspect video header");
    } finally {
      setIsInspecting(false);
    }
  };

  const handlePickVideo = async () => {
    try {
      const selected = await invoke<string | null>("pick_file", {
        title: "Select YTDisk Video to Decode",
        filters: [["Video Files", ["mp4", "mkv", "avi", "webm", "mov"]]],
      });
      if (selected) {
        setVideoPath(selected);
        setDecodeResult(null);
        setDecodeError(null);
        inspectHeader(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePickOutputDir = async () => {
    try {
      const selected = await invoke<string | null>("pick_directory", {
        title: "Select Restored Files Output Folder",
      });
      if (selected) {
        setOutputDir(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartDecode = async () => {
    if (!videoPath.trim()) return;

    const taskId = `decode-${Date.now()}`;
    setDecodeResult(null);
    setDecodeError(null);
    onTaskStarted(taskId, "Decoding Video");

    try {
      const result = await invoke<DecodeResult>("decode_video_command", {
        taskId,
        videoPath: videoPath.trim(),
        outputDir: outputDir.trim() ? outputDir : null,
        password: password.trim() ? password : null,
      });
      setDecodeResult(result);
    } catch (err: any) {
      console.error("Decode failed:", err);
      setDecodeError(typeof err === "string" ? err : "Failed to decode video");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Top Breadcrumb & Status Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
            <FileCheck2 className="w-3.5 h-3.5" />
            RECOVERY & INTEGRITY ENGINE
          </span>
          <span className="text-white/20">/</span>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Optical Bit-Grid Decoder & SHA-256 Verifier
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            STRICT BIT-FOR-BIT INTEGRITY VERIFICATION
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Input & Parameters (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-5 border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2 font-mono">
                <FileVideo className="w-4 h-4 text-emerald-400" />
                Target Video Container & Output
              </span>
              <span className="font-mono text-[10px] text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded">
                PYTHON & RUST COMPATIBLE
              </span>
            </div>

            {/* Video File Selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-medium text-foreground">
                YTDisk Video File
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={videoPath}
                  onChange={(e) => {
                    setVideoPath(e.target.value);
                    if (e.target.value.trim()) {
                      inspectHeader(e.target.value.trim());
                    }
                  }}
                  placeholder="Select or enter path to .mp4 / .mkv container..."
                  className="flex-1 bg-black/40 border border-white/[0.1] focus:border-emerald-400 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePickVideo}
                  className="font-mono text-xs h-9 px-3 shrink-0"
                >
                  <FileVideo className="w-3.5 h-3.5 mr-1" />
                  Select Video...
                </Button>
              </div>
            </div>

            {/* Header Inspector Card */}
            {isInspecting && (
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.08] text-xs font-mono text-cyan-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Scanning first 90 frames for YTDisk optical header...</span>
              </div>
            )}

            {inspectError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}

            {headerPreview && (
              <div className="p-4 rounded-lg bg-black/50 border border-emerald-500/40 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-emerald-500/20 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Container Metadata Verified
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                    VERSION {headerPreview.v}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                  <div>Original File: <strong className="text-foreground">{headerPreview.name}</strong></div>
                  <div>File Size: <strong className="text-foreground">{formatBytes(headerPreview.size)}</strong></div>
                  <div>Optical Grid: <strong className="text-foreground">Block {headerPreview.block} ({headerPreview.frames} frames)</strong></div>
                  <div>Reed-Solomon: <strong className="text-foreground">RS-{headerPreview.nsym} ({headerPreview.codewords} codewords)</strong></div>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Encryption Status:</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    headerPreview.encrypted
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-white/[0.04] text-muted-foreground"
                  }`}>
                    {headerPreview.encrypted ? "AES-256-GCM (Password Required)" : "Plaintext (No Password)"}
                  </span>
                </div>
              </div>
            )}

            {/* Password input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Decryption Password
                </label>
                <span className="font-mono text-[9px] text-cyan-400 bg-white/[0.04] px-1.5 py-0.2 rounded">
                  Scrypt Key Derivation
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password if video is encrypted..."
                  className="w-full bg-black/40 border border-white/[0.1] focus:border-emerald-400 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none pr-8"
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

            {/* Output folder */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-medium text-foreground">
                Output Directory for Restored File
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="Default (~/Restored/)"
                  className="flex-1 bg-black/40 border border-white/[0.1] focus:border-emerald-400 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePickOutputDir}
                  className="font-mono text-xs h-9 px-3 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1" />
                  Browse...
                </Button>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={handleStartDecode}
              disabled={!videoPath.trim() || isDecoding}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-[0_0_24px_-4px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 group active:scale-[0.99] border border-white/20 text-sm"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{isDecoding ? "DECODING VIDEO STREAM..." : "START OPTICAL DECODING PIPELINE"}</span>
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Telemetry & Verified Result (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-4 border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-mono text-xs font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Optical Decoder Stream
              </span>
              <span className="font-mono text-[10px] text-emerald-400 bg-white/[0.04] px-2 py-0.5 rounded font-bold">
                {isDecoding ? `FRAME ${activeProgress?.current_frame || 0} / ${activeProgress?.total_frames || 0}` : "STANDBY"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="text-foreground">
                  {isDecoding ? activeProgress?.stage || "Processing" : "Decoder Idle"}
                </span>
                <span className="text-emerald-400 font-bold">
                  {isDecoding ? `${(activeProgress?.percentage || 0).toFixed(1)}%` : "0%"}
                </span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden relative p-0.5 border border-white/[0.08]">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full relative transition-all duration-200"
                  style={{ width: `${activeProgress?.percentage || 0}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_#ffffff]" />
                </div>
              </div>
            </div>

            {/* Telemetry Stats Strip */}
            <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-black/40 border border-white/[0.06] text-center font-mono">
              <div>
                <span className="text-muted-foreground text-[9px] block">DECODE FPS</span>
                <span className="font-bold text-emerald-400 text-xs">
                  {activeProgress?.fps ? activeProgress.fps.toFixed(1) : "0.0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">ECC ERRORS</span>
                <span className="font-bold text-cyan-400 text-xs">
                  {decodeResult ? `${decodeResult.errors_fixed} B` : "--"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">SHA-256</span>
                <span className="font-bold text-emerald-400 text-xs">
                  {decodeResult ? (decodeResult.sha256_match ? "MATCH" : "FAIL") : "--"}
                </span>
              </div>
            </div>

            {/* Terminal log */}
            <div className="bg-black/80 rounded-lg border border-white/[0.08] p-3 font-mono text-[10px] space-y-1 text-muted-foreground max-h-28 overflow-y-auto">
              <div>[DECODE] Reed-Solomon engine initialized in GF(2^8).</div>
              {videoPath && (
                <div className="text-cyan-400 truncate">
                  [TARGET] Container selected: {videoPath.split("/").pop()}
                </div>
              )}
              {isDecoding && (
                <>
                  <div className="text-foreground">
                    [FRAME] Sampling block grid @ {activeProgress?.fps.toFixed(1)} FPS
                  </div>
                  <div className="text-emerald-400">
                    [ECC] De-interleaving and correcting transposed codewords...
                  </div>
                </>
              )}
              {decodeResult && (
                <div className="text-emerald-400 font-bold">
                  [VERIFIED] SHA-256 matched bit-for-bit: {decodeResult.sha256_match ? "OK" : "CORRUPT"}
                </div>
              )}
              {decodeError && (
                <div className="text-rose-400 font-bold">
                  [ERROR] {decodeError}
                </div>
              )}
            </div>

            {isDecoding && currentTaskId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancel(currentTaskId)}
                className="w-full font-mono text-xs"
              >
                <StopCircle className="w-3.5 h-3.5 mr-1.5" />
                Abort Decoding Job
              </Button>
            )}
          </div>

          {/* Verified Success Banner */}
          {decodeResult && (
            <div className={`glass-panel rounded-xl p-4 space-y-3 font-mono shadow-xl ${
              decodeResult.sha256_match
                ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_20px_-4px_rgba(16,185,129,0.3)]"
                : "border-rose-500/40 bg-rose-500/10 shadow-[0_0_20px_-4px_rgba(244,63,94,0.3)]"
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {decodeResult.sha256_match ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400">IDENTICAL, BYTE FOR BYTE!</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                    <span className="text-rose-400">INTEGRITY CORRUPTION: SHA-256 MISMATCH</span>
                  </>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground border-t border-white/[0.08] pt-2">
                <div className="flex justify-between">
                  <span>Restored File:</span>
                  <span className="text-foreground font-semibold truncate max-w-[65%]">
                    {decodeResult.file_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>File Size:</span>
                  <span className="text-foreground">{formatBytes(decodeResult.file_size)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reed-Solomon Fixed:</span>
                  <span className="text-cyan-400 font-bold">{decodeResult.errors_fixed} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span>Output Location:</span>
                  <span className="text-foreground text-[10px] truncate max-w-[65%]">
                    {decodeResult.output_path}
                  </span>
                </div>
              </div>

              <div className="bg-black/50 p-2.5 rounded border border-white/[0.1] flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <span className="text-[10px] text-muted-foreground block">VERIFIED HASH:</span>
                  <span className="text-[11px] text-emerald-400 truncate block">
                    {decodeResult.metadata.sha256}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(decodeResult.metadata.sha256)}
                  className="h-7 px-2 text-xs font-mono shrink-0"
                >
                  {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
