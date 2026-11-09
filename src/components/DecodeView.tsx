import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileVideo,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Play,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  X,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Progress } from "./ui/Progress";
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

  // If a preselected video path is provided (e.g. from Download tab)
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
        setInspectError("No YTDisk header found. Is this video a valid YTDisk container?");
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
        title: "Select Restored Files Output Directory",
      });
      if (selected) {
        setOutputDir(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartDecode = async () => {
    if (!videoPath) return;

    const taskId = `decode-${Date.now()}`;
    const name = videoPath.split(/[\/\\]/).pop() || "video";
    setDecodeResult(null);
    setDecodeError(null);
    onTaskStarted(taskId, name);

    try {
      const result = await invoke<DecodeResult>("decode_video_command", {
        taskId,
        videoPath,
        outputDir: outputDir ? outputDir : null,
        password: password.trim() ? password.trim() : null,
      });
      setDecodeResult(result);
    } catch (err: any) {
      setDecodeError(typeof err === "string" ? err : JSON.stringify(err));
    }
  };

  const copySha = () => {
    if (decodeResult?.metadata.sha256) {
      navigator.clipboard.writeText(decodeResult.metadata.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2">
      {/* Video Picker Card */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          videoPath ? "border-primary/40 bg-card" : "border-border hover:border-primary/50 bg-card/60"
        }`}
        onClick={!videoPath ? handlePickVideo : undefined}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          {!videoPath ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <FileVideo className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold">Select a YTDisk video to restore</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Fully compatible with all videos produced by both Rust and Python versions.
              </p>
              <Button size="sm" className="mt-4" onClick={handlePickVideo}>
                Browse Video
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full max-w-2xl bg-secondary/50 p-4 rounded-xl border border-border">
              <div className="flex items-center space-x-3.5 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <FileVideo className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm truncate max-w-md">
                    {videoPath.split(/[\/\\]/).pop()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-lg font-mono">
                    {videoPath}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handlePickVideo}>
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoPath("");
                    setHeaderPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header Container Preview */}
      {isInspecting && (
        <Card className="border-primary/30 bg-primary/5 animate-pulse">
          <CardContent className="p-4 flex items-center space-x-3 text-xs text-primary">
            <Sparkles className="h-4 w-4 animate-spin" />
            <span>Scanning first video frames for YTDisk optical metadata container...</span>
          </CardContent>
        </Card>
      )}

      {inspectError && (
        <Card className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <CardContent className="p-4 flex items-center space-x-2 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{inspectError}</span>
          </CardContent>
        </Card>
      )}

      {headerPreview && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="h-4 w-4" />
                <CardTitle className="text-sm font-semibold">Container Header Verified</CardTitle>
              </div>
              <Badge variant="success" className="text-xs font-mono">
                YTDisk v{headerPreview.v}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-1 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-background/80 rounded-lg border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground block">Original File</span>
                <span className="font-semibold truncate block">{headerPreview.name}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Original Size</span>
                <span className="font-mono font-medium block">{formatBytes(headerPreview.size)}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Payload Frames</span>
                <span className="font-mono font-medium block">{headerPreview.frames} frames</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Encryption</span>
                <Badge
                  variant={headerPreview.encrypted ? "destructive" : "secondary"}
                  className="text-[10px] py-0 px-1.5"
                >
                  {headerPreview.encrypted ? "AES-256 Encrypted" : "Unencrypted"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Decryption & Output Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* Password (if encrypted) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>AES-256-GCM Decryption Password</span>
              </span>
              {headerPreview?.encrypted && (
                <Badge variant="destructive" className="text-[10px] py-0">
                  Password Required
                </Badge>
              )}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={
                  headerPreview?.encrypted
                    ? "Enter password to decrypt this container..."
                    : "Password (leave blank if video is unencrypted)..."
                }
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
          </div>

          {/* Destination Directory */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Destination Directory</span>
              <Button variant="link" size="sm" className="h-5 p-0 text-xs" onClick={handlePickOutputDir}>
                Browse...
              </Button>
            </div>
            <Input
              type="text"
              placeholder="Defaults to Downloads/YTDisk/Restored"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Action Button */}
          <Button
            size="lg"
            className="w-full text-base font-semibold shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
            disabled={!videoPath || isDecoding}
            onClick={handleStartDecode}
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isDecoding ? "Decoding and Verifying..." : "Decode Video to File"}</span>
          </Button>

          {/* Live Progress */}
          {isDecoding && activeProgress && (
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
                  <span>{activeProgress.fps > 0 ? `${activeProgress.fps.toFixed(1)} FPS` : ""}</span>
                  <span>{activeProgress.elapsed_seconds.toFixed(1)}s</span>
                </div>
                {currentTaskId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                    onClick={() => onCancel(currentTaskId)}
                  >
                    Cancel Decoding
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Decode Error Card */}
          {decodeError && (
            <Card className="border-destructive/40 bg-destructive/10 text-destructive">
              <CardContent className="p-4 flex items-start space-x-2 text-xs">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Integrity or Decoding Failure</div>
                  <div className="mt-1 break-all">{decodeError}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Per security requirements, no file is reported as restored if SHA-256 verification fails or Reed-Solomon gave up.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decode Success Card with Strict SHA-256 Verification */}
          {decodeResult && (
            <Card className="border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-7 w-7 shrink-0" />
                  <div>
                    <h4 className="font-bold text-base leading-tight">
                      INTEGRITY VERIFIED: 100% BIT-FOR-BIT IDENTICAL
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Systematic SHA-256 checksum matched original file exactly.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-background/90 rounded-lg border border-border text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restored File:</span>
                    <span className="font-semibold">{decodeResult.file_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restored Size:</span>
                    <span className="font-mono">{formatBytes(decodeResult.file_size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reed-Solomon Repaired:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {decodeResult.errors_fixed} byte errors recovered
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[11px] text-muted-foreground block mb-1">
                      Verified SHA-256 Hash:
                    </span>
                    <div className="flex items-center space-x-1.5 bg-secondary/50 p-1.5 rounded">
                      <span className="font-mono text-[10px] break-all truncate">
                        {decodeResult.metadata.sha256}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copySha}>
                        {copiedSha ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-[11px] text-muted-foreground block mb-1">Saved Location:</span>
                    <div className="font-mono text-[11px] break-all p-1.5 bg-secondary/30 rounded border border-border/50">
                      {decodeResult.output_path}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
