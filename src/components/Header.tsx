import React from "react";
import {
  Disc3,
  Settings,
  Moon,
  Sun,
  Layers,
  UploadCloud,
  DownloadCloud,
  FileCheck2,
  Clock,
} from "lucide-react";
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
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 h-16 w-full glass-panel border-b border-white/[0.08] shadow-lg shadow-black/20">
      {/* Brand Logo & Realtime Engine Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-high/90 border border-white/[0.12] shadow-inner group cursor-pointer">
            <Disc3 className="w-5 h-5 text-cyan-400 transition-transform duration-700 group-hover:rotate-180" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-foreground flex items-center gap-1.5">
                YTDisk
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  4K OPTICAL
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/40 border border-white/[0.06]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
            MPEG-4K OPTICAL ENGINE ONLINE
          </span>
        </div>
      </div>

      {/* Navigation Links with Glow & Active Indicators */}
      <nav className="flex items-center gap-1.5 h-full py-2">
        <button
          onClick={() => setActiveTab("encode")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "encode"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Encode File</span>
        </button>

        <button
          onClick={() => setActiveTab("download")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "download"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          }`}
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span>Download & Stream</span>
        </button>

        <button
          onClick={() => setActiveTab("decode")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "decode"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Decode Video</span>
        </button>

        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "queue"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Queue</span>
          {activeTasksCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-[10px] font-mono font-bold text-black animate-pulse">
              {activeTasksCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === "history"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </nav>

      {/* Trailing Actions & System Badges */}
      <div className="flex items-center gap-3">
        <div className="hidden xl:flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded">
            FFmpeg {deps?.ffmpeg_available ? "OK" : "MISSING"}
          </span>
          <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
            RS(255,223)
          </span>
        </div>

        <div className="h-4 w-px bg-white/[0.1] hidden sm:block" />

        <div className="flex items-center gap-1">
          <button
            onClick={openSettings}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            title="Settings & System Diagnostics"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};

