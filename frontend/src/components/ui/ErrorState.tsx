"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this content. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-gat-maroon/20 bg-gat-maroon/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gat-maroon/10">
        <AlertTriangle className="h-6 w-6 text-gat-maroon" />
      </div>
      <div>
        <p className="font-display font-semibold text-gat-navy dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-gat-navy/60 dark:text-white/60">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
