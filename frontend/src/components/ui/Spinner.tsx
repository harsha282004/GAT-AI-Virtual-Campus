import { Loader2 } from "lucide-react";

import { cn } from "@/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
};

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className={cn("animate-spin text-gat-maroon", SIZE_MAP[size])} />
      {label && <p className="text-sm text-gat-navy/60 dark:text-white/60">{label}</p>}
    </div>
  );
}
