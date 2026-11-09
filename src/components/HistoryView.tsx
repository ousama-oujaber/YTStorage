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
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
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
    <div className="space-y-4 max-w-5xl mx-auto p-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Operations History</CardTitle>
            </div>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                className="text-xs text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                <span>Clear History</span>
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Review past encoding, decoding, and downloading sessions. Passwords are never stored.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 w-full sm:w-auto">
              {["all", "encode", "download", "decode"].map((op) => (
                <button
                  key={op}
                  onClick={() => setFilterOp(op)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    filterOp === op
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          </div>

          {/* History List */}
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="text-sm font-medium">No history items found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Completed operations will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistory.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-border bg-card/70 hover:bg-card/90 transition-all text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            item.operation === "encode"
                              ? "default"
                              : item.operation === "download"
                              ? "secondary"
                              : "outline"
                          }
                          className="capitalize text-[10px] font-mono px-2 py-0.5"
                        >
                          {item.operation}
                        </Badge>

                        <span className="font-semibold text-sm truncate max-w-sm sm:max-w-md">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            item.status === "success"
                              ? "success"
                              : item.status === "failed"
                              ? "destructive"
                              : "warning"
                          }
                          className="text-[10px] capitalize"
                        >
                          {item.status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : item.status === "failed" ? (
                            <XCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          <span>{item.status}</span>
                        </Badge>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Size: {formatBytes(item.size_bytes)}</span>
                      <span>Duration: {item.duration_seconds.toFixed(1)}s</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-border/50 space-y-2 bg-secondary/30 p-2.5 rounded-lg font-mono text-[11px]">
                        {item.sha256 && (
                          <div>
                            <span className="text-muted-foreground block text-[10px]">SHA-256:</span>
                            <div className="flex items-center justify-between bg-background p-1.5 rounded border border-border mt-0.5">
                              <span className="break-all">{item.sha256}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 ml-1"
                                onClick={() => copyToClipboard(item.sha256!, `${item.id}-sha`)}
                              >
                                {copiedId === `${item.id}-sha` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {item.output_path && (
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Output Path:</span>
                            <div className="flex items-center justify-between bg-background p-1.5 rounded border border-border mt-0.5">
                              <span className="break-all">{item.output_path}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 ml-1"
                                onClick={() => copyToClipboard(item.output_path!, `${item.id}-path`)}
                              >
                                {copiedId === `${item.id}-path` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {item.details && (
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Details:</span>
                            <div className="text-foreground mt-0.5">{item.details}</div>
                          </div>
                        )}

                        {item.error_message && (
                          <div className="text-destructive">
                            <span className="text-muted-foreground block text-[10px]">Error message:</span>
                            <div className="mt-0.5">{item.error_message}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
