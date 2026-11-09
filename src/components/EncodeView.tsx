import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  UploadCloud,
  File,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  Play,
  X,
  Gauge,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Progress } from "./ui/Progress";
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
  const [crf, setCrf] = useState<number>(12);
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [upscale4k, setUpscale4k] = useState<boolean>(true);
  const [customOutPath, setCustomOutPath] = useState<string>("");

  // Capacity calculation
  const [capacity, setCapacity] = useState<CapacityInfo | null>(null);

  // Results
  const [encodeResult, setEncodeResult] = useState<Metadata | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);

  // Fetch capacity metrics whenever block or nsym change
  useEffect(() => {
    invoke<CapacityInfo>("get_capacity_info", { block, nsym })
      .then(setCapacity)
      .catch(console.error);
  }, [block, nsym]);

  const handlePickFile = async () => {
    try {
      const selected = await invoke<string | null>("pick_file", {
        title: "Select File to Encode into YTDisk Video",
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
      const defaultName = fileName ? `${fileName.replace(/\.[^/.]+$/, "")}.mp4` : "ytdisk_video.mp4";
      const selected = await invoke<string | null>("pick_save_file", {
        title: "Select Destination MP4 Video",
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
    onTaskStarted(taskId, fileName);

    try {
      const result = await invoke<Metadata>("encode_file_command", {
        taskId,
        inputPath: selectedFilePath,
        outputPath: customOutPath ? customOutPath : null,
        block,
        nsym,
        password: password.trim() ? password.trim() : null,
        crf,
        upscale4k,
      });
      setEncodeResult(result);
    } catch (err: any) {
      setEncodeError(typeof err === "string" ? err : JSON.stringify(err));
    }
  };

  const copySha = () => {
    if (encodeResult?.sha256) {
      navigator.clipboard.writeText(encodeResult.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-2">
      {/* File Dropzone */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          selectedFilePath
            ? "border-emerald-500/40 bg-card"
            : "border-border hover:border-primary/50 bg-card/60"
        }`}
        onClick={!selectedFilePath ? handlePickFile : undefined}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          {!selectedFilePath ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <UploadCloud className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold">Select a file to encode into 4K video</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Any file type (archives, documents, binaries) will be converted into high-density visual data blocks with Reed-Solomon error correction.
              </p>
              <Button size="sm" className="mt-4" onClick={handlePickFile}>
                Browse File
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full max-w-2xl bg-secondary/50 p-4 rounded-xl border border-border">
              <div className="flex items-center space-x-3.5 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <File className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm truncate max-w-md">{fileName}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-lg font-mono">
                    {selectedFilePath}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handlePickFile}>
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFilePath("");
                    setFileName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Settings */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Encoding & Security Options</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Tune pixel density, error recovery margin, and optional encryption.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Block Size */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Block Size (Pixel Resolution)</span>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {block}x{block} px
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 4, label: "4x4 (Recommended)", desc: "Optimal for 4K YouTube" },
                    { val: 8, label: "8x8 (High Resilience)", desc: "Heavy compression safe" },
                    { val: 16, label: "16x16 (Ultra Safe)", desc: "Severe degradation safe" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => setBlock(item.val)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        block === item.val
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reed-Solomon NSYM */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Reed-Solomon ECC Parity (NSYM)</span>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {nsym} symbols ({nsym / 2} bytes recoverable / 255)
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 16, label: "16 symbols", desc: "Fastest / low overhead" },
                    { val: 32, label: "32 (Default)", desc: "Standard YouTube resilience" },
                    { val: 64, label: "64 (High ECC)", desc: "Maximum error recovery" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => setNsym(item.val)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        nsym === item.val
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Password Encryption */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center space-x-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>AES-256-GCM Password Encryption (Optional)</span>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password to encrypt container (leave blank for unencrypted)..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Uses Scrypt (N=32768, r=8, p=1) key derivation and AES-256-GCM authentication. Passwords are never saved.
                </p>
              </div>

              {/* 4K Upscale & Output Path */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <div className="text-xs font-medium">Upscale Video to 4K (3840x2160)</div>
                  <div className="text-[11px] text-muted-foreground">
                    Required for YouTube to apply high-bitrate VP9/AV1 codecs without compression distortion.
                  </div>
                </div>
                <Switch checked={upscale4k} onCheckedChange={setUpscale4k} />
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="text-xs font-medium">x264 Constant Rate Factor (CRF: 12 recommended)</div>
                <Input
                  type="number"
                  min={0}
                  max={51}
                  value={crf}
                  onChange={(e) => setCrf(Number(e.target.value))}
                  className="w-20 text-xs h-8 font-mono text-center"
                />
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Custom Destination (Optional)</span>
                  <Button variant="link" size="sm" className="h-6 p-0 text-xs" onClick={handlePickSavePath}>
                    Browse...
                  </Button>
                </div>
                <Input
                  type="text"
                  placeholder="Defaults to Videos/YTDisk/<filename>.mp4"
                  value={customOutPath}
                  onChange={(e) => setCustomOutPath(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Capacity Metrics & Primary Action */}
        <div className="space-y-4">
          <Card className="bg-secondary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <Gauge className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Throughput & Capacity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Grid Resolution</span>
                <span className="font-mono font-semibold">{capacity?.grid || "480x270"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Payload per Frame</span>
                <span className="font-mono font-semibold">{capacity?.kb_per_frame.toFixed(2)} KB</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Throughput (30 FPS)</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {capacity?.kb_per_sec.toFixed(1)} KB/s
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Video Length for 1 GB</span>
                <span className="font-mono font-semibold">
                  ~{capacity?.minutes_per_gb.toFixed(1)} minutes
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Primary Action Button */}
          <Button
            size="lg"
            className="w-full text-base font-semibold shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
            disabled={!selectedFilePath || isEncoding}
            onClick={handleStartEncode}
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isEncoding ? "Encoding Video..." : "Encode File to 4K Video"}</span>
          </Button>

          {/* Live Progress Card */}
          {isEncoding && activeProgress && (
            <Card className="border-primary/50 bg-primary/5 animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">{activeProgress.stage}</span>
                  <span className="font-mono font-bold">{activeProgress.percentage.toFixed(1)}%</span>
                </div>
                <Progress value={activeProgress.percentage} />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>
                    Frame {activeProgress.current_frame}/{activeProgress.total_frames}
                  </span>
                  <span>{activeProgress.fps.toFixed(1)} FPS</span>
                  <span>{activeProgress.elapsed_seconds.toFixed(1)}s</span>
                </div>
                {currentTaskId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                    onClick={() => onCancel(currentTaskId)}
                  >
                    Cancel Encoding
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {encodeError && (
            <Card className="border-destructive/40 bg-destructive/10 text-destructive">
              <CardContent className="p-4 flex items-start space-x-2 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Encoding Error</div>
                  <div className="mt-1 break-all">{encodeError}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Result Card */}
          {encodeResult && (
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold text-sm">4K Video Created Successfully!</span>
                </div>
                <div className="text-xs space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original File:</span>
                    <span className="font-semibold truncate max-w-[180px]">{encodeResult.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Size:</span>
                    <span className="font-mono">{formatBytes(encodeResult.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Video Frames:</span>
                    <span className="font-mono">{encodeResult.frames + 30} frames</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Encrypted:</span>
                    <span>{encodeResult.encrypted ? "Yes (AES-256-GCM)" : "No"}</span>
                  </div>
                  <div className="pt-2">
                    <div className="text-[11px] text-muted-foreground mb-1">SHA-256 Hash:</div>
                    <div className="flex items-center space-x-1.5 bg-background/80 p-2 rounded border border-border">
                      <span className="font-mono text-[10px] break-all truncate">
                        {encodeResult.sha256}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copySha}>
                        {copiedSha ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
