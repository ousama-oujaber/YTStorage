import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Header } from "./components/Header";
import { EncodeView } from "./components/EncodeView";
import { DownloadView } from "./components/DownloadView";
import { DecodeView } from "./components/DecodeView";
import { QueueView } from "./components/QueueView";
import { HistoryView } from "./components/HistoryView";
import { SettingsModal } from "./components/SettingsModal";
import {
  ActiveTask,
  DependencyStatus,
  DownloadProgress,
  EncodeProgress,
  DecodeProgress,
} from "./types";
import { formatBytes, formatSpeed } from "./lib/utils";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("encode");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Active tasks management
  const [activeTasks, setActiveTasks] = useState<Record<string, ActiveTask>>({});
  const [currentEncodeProgress, setCurrentEncodeProgress] = useState<EncodeProgress | undefined>(undefined);
  const [currentDecodeProgress, setCurrentDecodeProgress] = useState<DecodeProgress | undefined>(undefined);
  const [currentDownloadProgress, setCurrentDownloadProgress] = useState<DownloadProgress | undefined>(undefined);

  const [currentEncodeTaskId, setCurrentEncodeTaskId] = useState<string | null>(null);
  const [currentDecodeTaskId, setCurrentDecodeTaskId] = useState<string | null>(null);
  const [currentDownloadTaskId, setCurrentDownloadTaskId] = useState<string | null>(null);

  const [decodePreselectPath, setDecodePreselectPath] = useState<string | null>(null);

  // Initial load: theme and dependencies check
  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem("ytdisk_theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Check system prerequisites
    invoke<DependencyStatus>("check_dependencies")
      .then(setDeps)
      .catch(console.error);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ytdisk_theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Setup Tauri event listeners for real-time streaming progress
  useEffect(() => {
    let unlistenEncode: (() => void) | undefined;
    let unlistenDecode: (() => void) | undefined;
    let unlistenDownload: (() => void) | undefined;

    listen<{ task_id: string; progress: EncodeProgress }>("encode-progress", (event) => {
      const { task_id, progress } = event.payload;
      setCurrentEncodeProgress(progress);
      setActiveTasks((prev) => ({
        ...prev,
        [task_id]: {
          id: task_id,
          type: "encode",
          name: prev[task_id]?.name || "Encoding File",
          progress: progress.percentage,
          stage: progress.stage,
          speed: `${progress.fps.toFixed(1)} FPS`,
          details: `Frame ${progress.current_frame}/${progress.total_frames}`,
          cancellable: true,
        },
      }));

      if (progress.percentage >= 100) {
        setTimeout(() => {
          setActiveTasks((prev) => {
            const copy = { ...prev };
            delete copy[task_id];
            return copy;
          });
          setCurrentEncodeTaskId(null);
        }, 1500);
      }
    }).then((un) => (unlistenEncode = un));

    listen<{ task_id: string; progress: DecodeProgress }>("decode-progress", (event) => {
      const { task_id, progress } = event.payload;
      setCurrentDecodeProgress(progress);
      setActiveTasks((prev) => ({
        ...prev,
        [task_id]: {
          id: task_id,
          type: "decode",
          name: prev[task_id]?.name || "Decoding Video",
          progress: progress.percentage,
          stage: progress.stage,
          speed: progress.fps > 0 ? `${progress.fps.toFixed(1)} FPS` : "",
          details: `Frame ${progress.current_frame}/${progress.total_frames}`,
          cancellable: true,
        },
      }));

      if (progress.percentage >= 100) {
        setTimeout(() => {
          setActiveTasks((prev) => {
            const copy = { ...prev };
            delete copy[task_id];
            return copy;
          });
          setCurrentDecodeTaskId(null);
        }, 1500);
      }
    }).then((un) => (unlistenDecode = un));

    listen<DownloadProgress>("download-progress", (event) => {
      const progress = event.payload;
      setCurrentDownloadProgress(progress);
      setActiveTasks((prev) => ({
        ...prev,
        [progress.task_id]: {
          id: progress.task_id,
          type: "download",
          name: progress.file_name || "Downloading Content",
          progress: progress.percentage,
          stage: progress.status,
          speed: formatSpeed(progress.speed_bytes_sec),
          details: formatBytes(progress.downloaded_bytes),
          cancellable: progress.status === "Downloading",
        },
      }));

      if (progress.status === "Completed" || progress.status === "Cancelled" || progress.status === "Failed") {
        setTimeout(() => {
          setActiveTasks((prev) => {
            const copy = { ...prev };
            delete copy[progress.task_id];
            return copy;
          });
          setCurrentDownloadTaskId(null);
        }, 2000);
      }
    }).then((un) => (unlistenDownload = un));

    return () => {
      if (unlistenEncode) unlistenEncode();
      if (unlistenDecode) unlistenDecode();
      if (unlistenDownload) unlistenDownload();
    };
  }, []);

  const handleCancelTask = async (taskId: string) => {
    try {
      await invoke("cancel_task", { taskId });
      setActiveTasks((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleNavigateToDecode = (videoPath: string) => {
    setDecodePreselectPath(videoPath);
    setActiveTab("decode");
  };

  const activeTasksList = Object.values(activeTasks);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      <Header
        deps={deps}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTasksCount={activeTasksList.length}
        theme={theme}
        toggleTheme={toggleTheme}
        openSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === "encode" && (
          <EncodeView
            onTaskStarted={(id, name) => {
              setCurrentEncodeTaskId(id);
              setActiveTasks((prev) => ({
                ...prev,
                [id]: {
                  id,
                  type: "encode",
                  name,
                  progress: 0,
                  stage: "Starting encoding...",
                  cancellable: true,
                },
              }));
            }}
            activeProgress={currentEncodeProgress}
            isEncoding={currentEncodeTaskId !== null}
            onCancel={handleCancelTask}
            currentTaskId={currentEncodeTaskId}
          />
        )}

        {activeTab === "download" && (
          <DownloadView
            onTaskStarted={(id, name) => {
              setCurrentDownloadTaskId(id);
              setActiveTasks((prev) => ({
                ...prev,
                [id]: {
                  id,
                  type: "download",
                  name,
                  progress: 0,
                  stage: "Starting download...",
                  cancellable: true,
                },
              }));
            }}
            activeProgress={currentDownloadProgress}
            isDownloading={currentDownloadTaskId !== null}
            onCancel={handleCancelTask}
            currentTaskId={currentDownloadTaskId}
            onNavigateToDecode={handleNavigateToDecode}
          />
        )}

        {activeTab === "decode" && (
          <DecodeView
            onTaskStarted={(id, name) => {
              setCurrentDecodeTaskId(id);
              setActiveTasks((prev) => ({
                ...prev,
                [id]: {
                  id,
                  type: "decode",
                  name,
                  progress: 0,
                  stage: "Starting decode...",
                  cancellable: true,
                },
              }));
            }}
            activeProgress={currentDecodeProgress}
            isDecoding={currentDecodeTaskId !== null}
            onCancel={handleCancelTask}
            currentTaskId={currentDecodeTaskId}
            preselectedVideoPath={decodePreselectPath}
          />
        )}

        {activeTab === "queue" && (
          <QueueView tasks={activeTasksList} onCancelTask={handleCancelTask} />
        )}

        {activeTab === "history" && <HistoryView />}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        deps={deps}
        onSettingsSaved={() => {
          invoke<DependencyStatus>("check_dependencies").then(setDeps).catch(console.error);
        }}
      />
    </div>
  );
};

export default App;
