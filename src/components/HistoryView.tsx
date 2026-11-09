import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  History,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { Button } from "./ui/Button";
import { formatBytes } from "../lib/utils";
import { HistoryItem } from "../types";

export const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filterOp, setFilterOp] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const items = await invoke<HistoryItem[]>("get_history");
      setHistory(items);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear all operation history?")) {
      try {
        await invoke("clear_history");
        setHistory([]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredHistory = history.filter((item) => {
    if (filterOp !== "all" && item.operation !== filterOp) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSha = item.sha256?.toLowerCase().includes(q) || false;
      const matchPath = item.output_path?.toLowerCase().includes(q) || false;
      return matchName || matchSha || matchPath;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            AUDIT JOURNAL & LEDGER
          </span>
          <span className="text-white/20">/</span>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Historical Operations Log
          </h1>
        </div>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="text-xs text-rose-400 hover:bg-rose-500/10 border-rose-500/30 font-mono h-8"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            <span>Clear History</span>
          </Button>
        )}
      </div>

      <div className="glass-panel rounded-xl p-5 shadow-xl space-y-4 border border-white/[0.08]">
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto font-mono text-xs">
            {["all", "encode", "download", "decode"].map((op) => (
              <button
                key={op}
                onClick={() => setFilterOp(op)}
                className={`px-3 py-1.5 rounded-md capitalize transition-all border ${
                  filterOp === op
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-semibold"
                    : "bg-black/30 text-muted-foreground border-white/[0.08] hover:text-foreground"
                }`}
              >
                {op}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by filename, hash, or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.1] focus:border-cyan-400 rounded-lg pl-8 pr-3 py-1.5 text-foreground font-mono text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
            <History className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">No matching operations recorded</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? "Try refining your search terms." : "Past transactions and operations will be logged here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredHistory.map((item) => {
              const isExpanded = expandedId === item.id;
              const formattedDate = new Date(item.created_at).toLocaleString();

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/[0.08] bg-black/40 overflow-hidden transition-all shadow-sm font-mono"
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${
                          item.operation === "encode"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : item.operation === "download"
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                            : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        {item.operation}
                      </span>

                      <div className="overflow-hidden">
                        <span className="font-semibold text-xs text-foreground truncate block">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {formattedDate} {item.size_bytes ? `• ${formatBytes(item.size_bytes)}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                          item.status === "success"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : item.status === "failed"
                            ? "bg-rose-500/15 text-rose-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {item.status === "success" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : item.status === "failed" ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {item.status}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border-t border-white/[0.06] bg-black/60 text-xs space-y-2 text-muted-foreground">
                      {item.output_path && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block">Location:</span>
                          <span className="text-foreground text-[11px] break-all">{item.output_path}</span>
                        </div>
                      )}

                      {item.sha256 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block">SHA-256 Digest:</span>
                          <div className="flex items-center justify-between gap-2 bg-black/80 px-2.5 py-1.5 rounded border border-white/[0.06] mt-0.5">
                            <span className="text-[11px] text-cyan-400 truncate">{item.sha256}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.sha256!, item.id);
                              }}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {item.details && (
                        <div className="text-[11px]">
                          Details: <strong className="text-emerald-400">{item.details}</strong>
                        </div>
                      )}

                      {item.error_message && (
                        <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                          Error: {item.error_message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
