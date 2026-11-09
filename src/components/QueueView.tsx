import React from "react";
import { Activity, XCircle, Clock } from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Progress } from "./ui/Progress";
import { ActiveTask } from "../types";

interface QueueViewProps {
  tasks: ActiveTask[];
  onCancelTask: (taskId: string) => void;
}

export const QueueView: React.FC<QueueViewProps> = ({ tasks, onCancelTask }) => {
  return (
    <div className="space-y-4 max-w-4xl mx-auto p-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Active Tasks & Queue</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {tasks.length} active
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Monitor and manage ongoing encoding, downloading, and decoding tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No tasks currently in progress</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start an encode, download, or decode task to see real-time progress here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl border border-border bg-card/90 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          task.type === "encode"
                            ? "default"
                            : task.type === "download"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize text-[11px]"
                      >
                        {task.type}
                      </Badge>
                      <span className="font-semibold text-sm truncate max-w-md">{task.name}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono font-bold text-primary">
                        {task.progress.toFixed(1)}%
                      </span>
                      {task.cancellable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancelTask(task.id)}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          <span>Cancel</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <Progress value={task.progress} />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate max-w-xs">{task.stage}</span>
                    {task.speed && <span className="font-mono">{task.speed}</span>}
                    {task.details && <span className="font-mono">{task.details}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
