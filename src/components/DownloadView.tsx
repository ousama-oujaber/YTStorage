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
  FileVideo,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Progress } from "./ui/Progress";
import { Switch } from "./ui/Switch";
import { formatBytes, formatDuration, formatSpeed } from "../lib/utils";
import { DetectedSource, DownloadProgress } from "../types";

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
          setDetectError(typeof err === "string" ? err : "Unsupported URL format");
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
    onTaskStarted(taskId, `${detected.provider} Download`);

    try {
      const path = await invoke<string>("start_download_command", {
        taskId,
        url: url.trim(),
        outputDir: outputDir ? outputDir : null,
        autoDecode,
        decodePassword: decodePassword.trim() ? decodePassword.trim() : null,
      });
      setDownloadResultPath(path);

      // Check header
      const header = await invoke<any>("inspect_video_header", { videoPath: path });
      setIsYtdiskVideo(header !== null);
    } catch (err: any) {
      setDownloadError(typeof err === "string" ? err : JSON.stringify(err));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <DownloadCloud className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              YouTube & Google Drive Downloader
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Download 4K YTDisk containers directly from YouTube or Google Drive with automatic integrity detection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium">Video or File URL</label>
              {detected && (
                <Badge
                  variant={detected.provider === "YouTube" ? "destructive" : "default"}
                  className="flex items-center space-x-1 py-0.5 px-2"
                >
                  {detected.provider === "YouTube" ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <Cloud className="h-3 w-3" />
                  )}
                  <span>{detected.provider} Detected</span>
                </Badge>
              )}
            </div>
            <div className="flex space-x-2">
              <Input
                type="url"
                placeholder="Paste YouTube video link (watch?v=...) or Google Drive link (file/d/...)..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-xs font-mono"
              />
              {url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                  onClick={() => setUrl("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {detectError && (
              <div className="flex items-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{detectError}</span>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Auto Decode Switch */}
            <div className="p-3.5 rounded-lg border border-border bg-secondary/30 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold flex items-center space-x-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Auto-Decode YTDisk Videos</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Immediately restore original file once video finishes downloading.
                  </div>
                </div>
                <Switch checked={autoDecode} onCheckedChange={setAutoDecode} />
              </div>

              {autoDecode && (
                <div className="pt-2 border-t border-border/50">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Decryption password (if container is encrypted)..."
                      value={decodePassword}
                      onChange={(e) => setDecodePassword(e.target.value)}
                      className="pr-10 text-xs h-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Destination Directory */}
            <div className="p-3.5 rounded-lg border border-border bg-secondary/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Download Destination Folder</span>
                <Button variant="link" size="sm" className="h-5 p-0 text-xs" onClick={handlePickDir}>
                  Browse...
                </Button>
              </div>
              <Input
                type="text"
                placeholder="Defaults to Downloads/YTDisk"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                className="text-xs font-mono h-8"
              />
              <div className="text-[11px] text-muted-foreground">
                Partial downloads can be resumed automatically if interrupted.
              </div>
            </div>
          </div>

          {/* Start Download Button */}
          <Button
            size="lg"
            className="w-full text-base font-semibold shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
            disabled={!url.trim() || !detected || isDownloading}
            onClick={handleStartDownload}
          >
            <DownloadCloud className="h-4 w-4" />
            <span>
              {isDownloading
                ? "Downloading Content..."
                : detected
                ? `Download from ${detected.provider}`
                : "Enter YouTube or Google Drive URL"}
            </span>
          </Button>

          {/* Active Download Progress */}
          {isDownloading && activeProgress && (
            <Card className="border-primary/50 bg-primary/5 animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-semibold text-primary truncate max-w-sm">
                    {activeProgress.file_name}
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {activeProgress.percentage.toFixed(1)}%
                  </Badge>
                </div>

                <Progress value={activeProgress.percentage} />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>
                    {formatBytes(activeProgress.downloaded_bytes)}
                    {activeProgress.total_bytes ? ` / ${formatBytes(activeProgress.total_bytes)}` : ""}
                  </span>
                  <span>{formatSpeed(activeProgress.speed_bytes_sec)}</span>
                  <span>{activeProgress.eta_seconds ? `ETA: ${formatDuration(activeProgress.eta_seconds)}` : "Calculating..."}</span>
                </div>

                {currentTaskId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                    onClick={() => onCancel(currentTaskId)}
                  >
                    Cancel Download
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {downloadError && (
            <Card className="border-destructive/40 bg-destructive/10 text-destructive">
              <CardContent className="p-4 flex items-start space-x-2 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Download Error</div>
                  <div className="mt-1 break-all">{downloadError}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Complete Card */}
          {downloadResultPath && (
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-bold text-sm">Download Finished Successfully!</span>
                  </div>
                  {isYtdiskVideo && (
                    <Badge variant="success" className="text-xs">
                      ✔ Valid YTDisk Container Detected
                    </Badge>
                  )}
                </div>

                <div className="p-2 bg-background/80 rounded border border-border text-xs space-y-1">
                  <div className="text-muted-foreground text-[11px]">Saved video file:</div>
                  <div className="font-mono text-xs break-all">{downloadResultPath}</div>
                </div>

                {isYtdiskVideo && !autoDecode && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      Ready to unpack and recover original file?
                    </span>
                    <Button
                      size="sm"
                      onClick={() => onNavigateToDecode(downloadResultPath)}
                      className="text-xs flex items-center space-x-1"
                    >
                      <FileVideo className="h-3.5 w-3.5" />
                      <span>Decode Video Now</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
