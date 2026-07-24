import { cn } from "@/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-lg bg-brand/8", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-hairline bg-white p-7 shadow-soft">
      <Skeleton className="mb-5 h-12 w-12 rounded-xl" />
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
