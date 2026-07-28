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
        "rounded-3xl border border-hairline bg-white p-7 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30",
        hoverLift &&
          "transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-glow",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
