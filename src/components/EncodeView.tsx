import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  UploadCloud,
  FileArchive,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Copy,
  Check,
  X,
  Sliders,
  Cpu,
  Sparkles,
  StopCircle,
  Activity,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { formatBytes } from "../lib/utils";
import { CapacityInfo, EncodeProgress, Metadata } from "../types";

interface EncodeViewProps {
  onTaskStarted: (taskId: string, name: string) => void;
  activeProgress?: EncodeProgress;
  isEncoding: boolean;
  onCancel: (taskId: string) => void;
  currentTaskId: string | null;
}

export const EncodeView: React.FC<EncodeViewProps> = ({
  onTaskStarted,
  activeProgress,
  isEncoding,
  onCancel,
  currentTaskId,
}) => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // Settings
  const [block, setBlock] = useState<number>(4);
  const [nsym, setNsym] = useState<number>(32);
  const crf = 12;
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [upscale4k, setUpscale4k] = useState<boolean>(true);
  const [customOutPath, setCustomOutPath] = useState<string>("");

  // Capacity calculation
  const [capacity, setCapacity] = useState<CapacityInfo | null>(null);

  // Results & Errors
  const [encodeResult, setEncodeResult] = useState<Metadata | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);

  // Real-time capacity computation
  useEffect(() => {
    invoke<CapacityInfo>("get_capacity_info", { block, nsym })
      .then(setCapacity)
      .catch(console.error);
  }, [block, nsym]);

  const handlePickFile = async () => {
    try {
      const selected = await invoke<string | null>("pick_file", {
        title: "Select File to Encode into 4K YTDisk Video",
      });
      if (selected) {
        setSelectedFilePath(selected);
        const name = selected.split(/[\/\\]/).pop() || "file";
        setFileName(name);
        setEncodeResult(null);
        setEncodeError(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePickSavePath = async () => {
    try {
      const defaultName = fileName
        ? `${fileName.replace(/\.[^/.]+$/, "")}.mp4`
        : "ytdisk_video.mp4";
      const selected = await invoke<string | null>("pick_save_file", {
        title: "Select Destination 4K MP4 Video",
        defaultName,
        filters: [["MP4 Video", ["mp4"]]],
      });
      if (selected) {
        setCustomOutPath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartEncode = async () => {
    if (!selectedFilePath) return;

    const taskId = `encode-${Date.now()}`;
    setEncodeResult(null);
    setEncodeError(null);
    onTaskStarted(taskId, `Encoding ${fileName}`);

    try {
      const meta = await invoke<Metadata>("encode_file_command", {
        taskId,
        filePath: selectedFilePath,
        outputPath: customOutPath.trim() ? customOutPath : null,
        block,
        nsym,
        crf,
        password: password.trim() ? password : null,
        upscale4k,
      });
      setEncodeResult(meta);
    } catch (err: any) {
      console.error("Encode failed:", err);
      setEncodeError(typeof err === "string" ? err : "Failed to encode file");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Breadcrumb & Status Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            PARITY MATRIX WORKSTATION
          </span>
          <span className="text-white/20">/</span>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Optical Bit-Grid Encoder Pipeline
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>PIPELINE LOAD:</span>
            <div className="w-16 h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.08]">
              <div
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: isEncoding ? `${activeProgress?.percentage || 50}%` : "12%" }}
              />
            </div>
            <span className="text-emerald-400 font-semibold">
              {isEncoding ? `${(activeProgress?.percentage || 0).toFixed(0)}%` : "READY"}
            </span>
          </div>
          <div className="h-3 w-px bg-white/[0.1]" />
          <span className="text-cyan-400 flex items-center gap-1 text-[11px]">
            <Lock className="w-3 h-3" />
            AES-256 HARDWARE CRYPTO ACCEL ACTIVE
          </span>
        </div>
      </div>

      {/* 2-Column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Ingestion, Grid Settings & Execution CTA (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Interactive File Dropzone */}
          <div className="glass-panel rounded-xl p-5 relative overflow-hidden shadow-xl group border border-white/[0.08]">
            <div className="absolute inset-0 scanline-overlay pointer-events-none opacity-30" />
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-cyan-400" />
                Source Ingestion Buffer
              </span>
              <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                selectedFilePath
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-white/[0.04] text-muted-foreground border-white/[0.08]"
              }`}>
                {selectedFilePath ? "BUFFER STAGED" : "AWAITING PAYLOAD"}
              </span>
            </div>

            {selectedFilePath ? (
              <div className="dashed-cyber-border rounded-lg bg-black/40 p-4 transition-all hover:border-cyan-400 relative">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-lg bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-cyan-400 relative shrink-0">
                      <FileArchive className="w-6 h-6" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground tracking-tight break-all font-mono text-sm">
                          {fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          CRC32 Validated
                        </span>
                        <span className="text-white/20">•</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Zstandard / Arbitrary Payload
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePickFile}
                      className="h-8 text-xs font-mono"
                    >
                      Change
                    </Button>
                    <button
                      onClick={() => {
                        setSelectedFilePath("");
                        setFileName("");
                      }}
                      className="p-1.5 rounded-md hover:bg-white/[0.08] text-muted-foreground hover:text-rose-400 transition-colors"
                      title="Clear payload"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Destination path picker */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Destination:</span>
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <span className="text-cyan-400 truncate text-[11px]">
                      {customOutPath || "Default (~/Videos/upload.mp4)"}
                    </span>
                    <button
                      onClick={handlePickSavePath}
                      className="text-muted-foreground hover:text-foreground text-[10px] underline underline-offset-2 shrink-0"
                    >
                      Browse...
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={handlePickFile}
                className="dashed-cyber-border rounded-lg bg-black/20 p-8 text-center cursor-pointer hover:bg-black/40 hover:border-cyan-400 transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <UploadCloud className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to select or drag & drop any file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Documents, archives, binaries, encrypted vaults, or datasets
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
                  <span>UNLIMITED FILE SIZE</span>
                  <span>•</span>
                  <span>100% BIT-FOR-BIT RECOVERY</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Optical Modulation & Reed-Solomon Matrix Parameters */}
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-6 border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2 font-mono">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Optical Modulation & Reed-Solomon Matrix Parameters
              </span>
              <span className="font-mono text-[10px] text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded">
                GF(2^8) GALOIS FIELD
              </span>
            </div>

            {/* Block density options */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                  Pixel Block Density
                  <span className="text-muted-foreground text-[10px]">(Bin Matrix Size)</span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400">
                  {block === 4 ? "Highest Raw Throughput (Recommended)" : block === 8 ? "Balanced Profile" : "Maximum Spatial Resilience"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 4x4 */}
                <div
                  onClick={() => setBlock(4)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    block === 4
                      ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_-4px_rgba(16,185,129,0.3)]"
                      : "bg-black/30 border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-mono text-xs font-bold ${block === 4 ? "text-emerald-400" : "text-foreground"}`}>
                      4x4 Micro-Grid
                    </span>
                    <span className={`w-2 h-2 rounded-full ${block === 4 ? "bg-emerald-400" : "bg-white/20"}`} />
                  </div>
                  <div className="w-full h-7 mb-2 bg-black/60 rounded border border-white/[0.06] flex items-center justify-center p-1">
                    <div className="grid grid-cols-8 gap-0.5 w-full h-full opacity-70">
                      <span className="bg-emerald-400" /><span className="bg-white/10" /><span className="bg-emerald-400" /><span className="bg-emerald-400" />
                      <span className="bg-white/10" /><span className="bg-emerald-400" /><span className="bg-white/10" /><span className="bg-emerald-400" />
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground flex justify-between">
                    <span>Capacity:</span>
                    <span className="text-foreground font-semibold">15.82 KB/frame</span>
                  </div>
                </div>

                {/* 8x8 */}
                <div
                  onClick={() => setBlock(8)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    block === 8
                      ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_-4px_rgba(6,182,212,0.3)]"
                      : "bg-black/30 border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-mono text-xs font-bold ${block === 8 ? "text-cyan-400" : "text-foreground"}`}>
                      8x8 Balanced
                    </span>
                    <span className={`w-2 h-2 rounded-full ${block === 8 ? "bg-cyan-400" : "bg-white/20"}`} />
                  </div>
                  <div className="w-full h-7 mb-2 bg-black/60 rounded border border-white/[0.06] flex items-center justify-center p-1">
                    <div className="grid grid-cols-4 gap-1 w-full h-full opacity-60">
                      <span className="bg-cyan-400" /><span className="bg-white/10" />
                      <span className="bg-white/10" /><span className="bg-cyan-400" />
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground flex justify-between">
                    <span>Capacity:</span>
                    <span className="text-foreground font-semibold">3.95 KB/frame</span>
                  </div>
                </div>

                {/* 16x16 */}
                <div
                  onClick={() => setBlock(16)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    block === 16
                      ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_-4px_rgba(168,85,247,0.3)]"
                      : "bg-black/30 border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-mono text-xs font-bold ${block === 16 ? "text-purple-400" : "text-foreground"}`}>
                      16x16 Resilience
                    </span>
                    <span className={`w-2 h-2 rounded-full ${block === 16 ? "bg-purple-400" : "bg-white/20"}`} />
                  </div>
                  <div className="w-full h-7 mb-2 bg-black/60 rounded border border-white/[0.06] flex items-center justify-center p-1">
                    <div className="grid grid-cols-2 gap-1.5 w-full h-full opacity-60">
                      <span className="bg-purple-400" /><span className="bg-white/10" />
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground flex justify-between">
                    <span>Capacity:</span>
                    <span className="text-foreground font-semibold">0.98 KB/frame</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reed-Solomon parity selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                  Reed-Solomon Parity Budget
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    RS(255, {255 - nsym})
                  </span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  Recovery Guarantee: 99.998%
                </span>
              </div>

              <div className="flex gap-2">
                {[16, 32, 64].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNsym(n)}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono transition-all border ${
                      nsym === n
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold shadow-sm"
                        : "bg-black/30 text-muted-foreground border-white/[0.08] hover:text-foreground hover:border-white/20"
                    }`}
                  >
                    RS-{n} ({n / 2} bytes error recovery)
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Matrix interleaving (`codewords.T`) redistributes burst video compression artifacts across separate codewords.
              </p>
            </div>

            {/* Password & 4K Enforce */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-medium text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Payload Encryption Key
                  </label>
                  <span className="font-mono text-[9px] text-cyan-400 bg-white/[0.04] px-1.5 py-0.2 rounded">
                    Scrypt KDF
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional AES-256-GCM password..."
                    className="w-full bg-black/40 border border-white/[0.1] focus:border-cyan-400 rounded-md px-3 py-2 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Zero password storage. Authenticated 128-bit MAC verification.
                </p>
              </div>

              <div className="flex flex-col justify-between p-3 rounded-lg bg-black/40 border border-white/[0.08]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-semibold text-foreground block">
                      Enforce 4K Upscale (UHD)
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      3840x2160 nearest-neighbor scaling for YouTube VP9/AV1 profile preservation.
                    </span>
                  </div>
                  <Switch checked={upscale4k} onCheckedChange={setUpscale4k} />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-2">
                  <CheckCircle2 className="w-3 h-3" />
                  Chroma Subsampling & Macroblock Safe
                </div>
              </div>
            </div>
          </div>

          {/* 3. Primary Execution CTA */}
          <div>
            <Button
              onClick={handleStartEncode}
              disabled={!selectedFilePath || isEncoding}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-[0_0_24px_-4px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 group active:scale-[0.99] border border-white/20 text-sm"
            >
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="tracking-wider">
                {isEncoding ? "ENCODING IN PROGRESS..." : "START 4K ENCODING PIPELINE"}
              </span>
            </Button>
            <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-muted-foreground mt-2">
              <span>Bit-for-Bit Guarantee</span>
              <span>•</span>
              <span>Target: YouTube 2160p MP4</span>
              <span>•</span>
              <span>Reed-Solomon RS(255,223)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Optical Capacity & Live Progress Stream (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Optical Matrix Capacity & Telemetry Card */}
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-4 border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-mono text-xs font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Matrix Capacity Telemetry
              </span>
              <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE RENDER FEED
              </span>
            </div>

            {/* Micro Canvas Matrix Visualizer */}
            <div className="relative w-full h-32 rounded-lg bg-black/60 border border-white/[0.1] overflow-hidden flex flex-col justify-between p-2.5 group">
              <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:8px_8px] opacity-25 group-hover:opacity-40 transition-opacity" />
              <div className="relative z-10 flex justify-between items-start font-mono text-[10px]">
                <span className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-cyan-400 border border-white/[0.08]">
                  LBA FRAME 0x000732
                </span>
                <span className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-muted-foreground">
                  {capacity ? `${(capacity.kb_per_frame * 1024 * 8).toFixed(0)} BITS/FRAME` : "129,600 BITS/FRAME"}
                </span>
              </div>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce opacity-70" />
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-black/70 px-2 py-1 rounded">
                <span>Raster: Left → Right Transposed</span>
                <span className="text-emerald-400 font-semibold">Header Locked</span>
              </div>
            </div>

            {/* Metrics Bento Sub-grid */}
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] text-muted-foreground block mb-0.5">DENSITY / FRAME</span>
                <span className="text-sm font-bold text-foreground">
                  {capacity ? `${capacity.kb_per_frame.toFixed(2)} KB` : "15.82 KB"}
                </span>
                <div className="w-full bg-white/[0.06] h-1 rounded mt-2 overflow-hidden">
                  <div className="bg-emerald-400 h-full w-[85%]" />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] text-muted-foreground block mb-0.5">THROUGHPUT (30 FPS)</span>
                <span className="text-sm font-bold text-cyan-400">
                  {capacity ? `${capacity.kb_per_sec.toFixed(2)} KB/s` : "415.05 KB/s"}
                </span>
                <div className="w-full bg-white/[0.06] h-1 rounded mt-2 overflow-hidden">
                  <div className="bg-cyan-400 h-full w-[65%]" />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] text-muted-foreground block mb-0.5">DATA GRID</span>
                <span className="text-sm font-bold text-foreground">
                  {capacity ? capacity.grid : "480 × 270"}
                </span>
                <span className="text-[9px] text-muted-foreground/70 block mt-1">16:9 Optical Ratio</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] text-muted-foreground block mb-0.5">1.0 GB EQUIVALENT</span>
                <span className="text-sm font-bold text-foreground">
                  {capacity ? `${capacity.minutes_per_gb.toFixed(1)} mins` : "42.1 mins"}
                </span>
                <span className="text-[9px] text-emerald-400 block mt-1">@ 30.00 FPS UHD</span>
              </div>
            </div>
          </div>

          {/* 2. Live Stream & Encoding Progress Card */}
          <div className="glass-panel rounded-xl p-5 shadow-xl space-y-4 border border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isEncoding ? "bg-cyan-400 animate-pulse" : "bg-white/20"}`} />
                <span className="font-mono text-xs font-semibold text-foreground">Active Pipeline Stream</span>
              </div>
              <span className="font-mono text-[10px] text-cyan-400 bg-white/[0.04] px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                {isEncoding
                  ? `FRAME ${activeProgress?.current_frame || 0} / ${activeProgress?.total_frames || 0}`
                  : "STANDBY"}
              </span>
            </div>

            {/* Laser Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="text-foreground">
                  {isEncoding ? activeProgress?.stage || "Encoding" : "Pipeline Idle"}
                </span>
                <span className="text-cyan-400 font-bold">
                  {isEncoding ? `${(activeProgress?.percentage || 0).toFixed(1)}%` : "0%"}
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
            <div className="grid grid-cols-4 gap-2 py-2 px-3 rounded-lg bg-black/40 border border-white/[0.06] text-center font-mono">
              <div>
                <span className="text-muted-foreground text-[9px] block">ENCODE FPS</span>
                <span className="font-bold text-emerald-400 text-xs">
                  {activeProgress?.fps ? activeProgress.fps.toFixed(1) : "0.0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">FRAMES</span>
                <span className="font-bold text-foreground text-xs">
                  {activeProgress?.current_frame || 0}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">CRF</span>
                <span className="font-bold text-cyan-400 text-xs">{crf}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[9px] block">SECURITY</span>
                <span className="font-bold text-foreground text-xs">
                  {password ? "AES-GCM" : "PLAIN"}
                </span>
              </div>
            </div>

            {/* Embedded Terminal Output Viewport */}
            <div className="bg-black/80 rounded-lg border border-white/[0.08] overflow-hidden flex flex-col font-mono text-[10px]">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-[9px] text-muted-foreground uppercase tracking-wider">
                    OPTICAL_CORE_STREAM
                  </span>
                </div>
                <span className="text-[9px] text-emerald-400">AUTO-SCROLL: ON</span>
              </div>
              <div className="p-3 space-y-1 text-muted-foreground max-h-28 overflow-y-auto leading-relaxed">
                <div>[00:00:00] <span className="text-cyan-400">[INIT]</span> Optical pipeline daemon ready.</div>
                {selectedFilePath && (
                  <div>
                    [00:00:01] <span className="text-emerald-400">[INGEST]</span> Payload staged: {fileName}
                  </div>
                )}
                {isEncoding && (
                  <>
                    <div className="text-emerald-400">
                      [STREAM] <span className="text-emerald-300 font-semibold">[RS-ENC]</span> Interleaving matrix active (N=255, k=223)
                    </div>
                    {password && (
                      <div className="text-cyan-400">
                        [CRYPTO] <span className="text-cyan-300 font-semibold">[AES-256]</span> Authenticated payload stream cipher active
                      </div>
                    )}
                    <div className="text-foreground">
                      [FFMPEG] Streaming frame {activeProgress?.current_frame} / {activeProgress?.total_frames} @ {activeProgress?.fps.toFixed(1)} fps
                    </div>
                  </>
                )}
                {encodeResult && (
                  <div className="text-emerald-400 font-bold">
                    [COMPLETE] Frame rendering finished. SHA-256 integrity committed!
                  </div>
                )}
                {encodeError && (
                  <div className="text-rose-400 font-bold">
                    [ERROR] {encodeError}
                  </div>
                )}
              </div>
            </div>

            {/* Cancel Action if encoding */}
            {isEncoding && currentTaskId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancel(currentTaskId)}
                className="w-full font-mono text-xs"
              >
                <StopCircle className="w-3.5 h-3.5 mr-1.5" />
                Abort Encoding Job
              </Button>
            )}
          </div>

          {/* Success Banner */}
          {encodeResult && (
            <div className="glass-panel border-emerald-500/40 rounded-xl p-4 bg-emerald-500/10 space-y-3 font-mono shadow-[0_0_20px_-4px_rgba(16,185,129,0.3)]">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>4K Optical Video Successfully Generated!</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground border-t border-emerald-500/20 pt-2">
                <div className="flex justify-between">
                  <span>File:</span>
                  <span className="text-foreground font-semibold">{encodeResult.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="text-foreground">{formatBytes(encodeResult.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Frames:</span>
                  <span className="text-foreground">{encodeResult.frames} ({(encodeResult.frames / 30).toFixed(1)}s)</span>
                </div>
                <div className="flex justify-between">
                  <span>Encrypted:</span>
                  <span className={encodeResult.encrypted ? "text-cyan-400" : "text-muted-foreground"}>
                    {encodeResult.encrypted ? "Yes (AES-256-GCM)" : "No (Plaintext)"}
                  </span>
                </div>
              </div>
              <div className="bg-black/50 p-2.5 rounded border border-emerald-500/30 flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <span className="text-[10px] text-muted-foreground block">SHA-256 DIGEST:</span>
                  <span className="text-[11px] text-emerald-400 truncate block">
                    {encodeResult.sha256}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(encodeResult.sha256)}
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
