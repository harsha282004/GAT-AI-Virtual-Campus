"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  durationMs?: number;
  className?: string;
}

/**
 * Animated number that counts up when scrolled into view. Extracted from
 * features/landing/CampusStatistics.tsx. A safety timeout snaps to the final
 * value even if the in-view animation never runs (e.g. the element mounted
 * already on-screen after an async fetch), so the number is never stuck at 0.
 */
export function CountUp({ value, durationMs = 1400, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value, durationMs]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDisplay((current) => (current === value ? current : value));
    }, durationMs + 400);
    return () => window.clearTimeout(id);
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}
