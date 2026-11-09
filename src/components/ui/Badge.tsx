import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground shadow":
            variant === "default",
          "border-transparent bg-secondary text-secondary-foreground":
            variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground":
            variant === "destructive",
          "border-border text-foreground": variant === "outline",
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30":
            variant === "success",
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30":
            variant === "warning",
        },
        className
      )}
      {...props}
    />
  );
}

