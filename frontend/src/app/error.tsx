"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40">
        <AlertTriangle className="h-8 w-8 text-rose-500 dark:text-rose-400" />
      </div>

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-base leading-7 text-muted">
        An unexpected error interrupted this page. You can try again, or head back to the
        homepage.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Button variant="primary" size="lg" icon={<RefreshCw className="h-5 w-5" />} onClick={reset}>
          Try again
        </Button>
        <Button href="/" variant="outline" size="lg" icon={<Home className="h-5 w-5" />}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}
