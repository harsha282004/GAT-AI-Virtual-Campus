import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/utils";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  narrow?: boolean;
  noPaddingTop?: boolean;
}

export function PageContainer({
  children,
  className,
  narrow = false,
  noPaddingTop = false,
  ...rest
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 sm:px-10 lg:px-16",
        narrow ? "max-w-4xl" : "max-w-7xl",
        !noPaddingTop && "pt-28 pb-20",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
