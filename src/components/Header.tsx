import React from "react";
import {
  HardDrive,
  Settings,
  Moon,
  Sun,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { DependencyStatus } from "../types";

interface HeaderProps {
  deps: DependencyStatus | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeTasksCount: number;
  theme: "dark" | "light";
  toggleTheme: () => void;
  openSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  deps,
  activeTab,
  setActiveTab,
  activeTasksCount,
  theme,
  toggleTheme,
  openSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 via-rose-500 to-indigo-600 text-white shadow-md">
          <HardDrive className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight">YTDisk</span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-primary/40 text-primary">
              v1.0 4K
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Infinite High-Density Storage on YouTube & Drive
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center rounded-lg bg-secondary/80 p-1">
        <button
          onClick={() => setActiveTab("encode")}
          className={`flex items-center space-x-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === "encode"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Encode</span>
        </button>
        <button
          onClick={() => setActiveTab("download")}
          className={`flex items-center space-x-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === "download"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Download</span>
        </button>
        <button
          onClick={() => setActiveTab("decode")}
          className={`flex items-center space-x-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === "decode"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Decode</span>
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center space-x-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === "queue"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Queue</span>
          {activeTasksCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse">
              {activeTasksCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center space-x-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeTab === "history"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>History</span>
        </button>
      </nav>

      {/* Status & Actions */}
      <div className="flex items-center space-x-2">
        <div className="hidden sm:flex items-center space-x-1.5 text-xs">
          {deps?.ffmpeg_available ? (
            <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md text-[11px]" title={`FFmpeg: ${deps.ffmpeg_path}`}>
              <CheckCircle2 className="h-3 w-3" />
              <span>FFmpeg</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-md text-[11px]" title="FFmpeg missing">
              <AlertCircle className="h-3 w-3" />
              <span>FFmpeg</span>
            </div>
          )}

          {deps?.ytdlp_available ? (
            <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md text-[11px]" title={`yt-dlp: ${deps.ytdlp_path}`}>
              <CheckCircle2 className="h-3 w-3" />
              <span>yt-dlp</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md text-[11px]" title="yt-dlp missing">
              <AlertCircle className="h-3 w-3" />
              <span>yt-dlp</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={openSettings}
          title="Settings"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
