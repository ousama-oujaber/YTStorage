import React from "react";
import { XCircle, Clock, Layers } from "lucide-react";
import { Button } from "./ui/Button";
import { ActiveTask } from "../types";

interface QueueViewProps {
  tasks: ActiveTask[];
  onCancelTask: (taskId: string) => void;
}

export const QueueView: React.FC<QueueViewProps> = ({ tasks, onCancelTask }) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
            <Layers className="w-3.5 h-3.5" />
            DAEMON TASK DISPATCHER
          </span>
          <span className="text-white/20">/</span>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Active Processing Queue
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {tasks.length} ACTIVE JOBS
          </span>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-5 shadow-xl space-y-4 border border-white/[0.08]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-muted-foreground/40">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">No tasks currently queued</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              All optical pipelines are standing by. Start an encoding, downloading, or decoding task to observe real-time telemetry here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-white/[0.08] bg-black/40 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        task.type === "encode"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : task.type === "download"
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                      }`}
                    >
                      {task.type}
                    </span>
                    <span className="font-semibold text-sm truncate max-w-md text-foreground font-mono">
                      {task.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {task.progress.toFixed(1)}%
                    </span>
                    {task.cancellable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelTask(task.id)}
                        className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 font-mono"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        <span>Cancel</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-200"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span className="truncate max-w-xs">{task.stage}</span>
                  {task.speed && <span className="text-emerald-400">{task.speed}</span>}
                  {task.details && <span>{task.details}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
