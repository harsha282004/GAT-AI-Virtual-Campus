import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCard({ children, className, ...rest }: GlassCardProps) {
  return (
    <div className={cn("glass rounded-3xl p-7 shadow-soft", className)} {...rest}>
      {children}
    </div>
  );
}
