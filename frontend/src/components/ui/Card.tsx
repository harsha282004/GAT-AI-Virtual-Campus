import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverLift?: boolean;
}

export function Card({ children, className, hoverLift = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gat-navy/10 bg-white p-6 shadow-sm",
        "dark:border-white/10 dark:bg-gat-navy-light",
        hoverLift && "transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
