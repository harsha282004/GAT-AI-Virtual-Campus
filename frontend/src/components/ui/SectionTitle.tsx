"use client";

import { motion } from "framer-motion";

import { cn } from "@/utils";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  light?: boolean;
  className?: string;
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
  light = false,
  className,
}: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className={cn(
        "mb-14 max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]",
            light ? "text-gat-gold-light" : "text-gat-maroon",
          )}
        >
          <span className="h-px w-6 bg-current" />
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "font-display text-3xl font-bold tracking-tight sm:text-4xl",
          light ? "text-white" : "text-gat-navy dark:text-white",
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed",
            light ? "text-white/70" : "text-gat-navy/70 dark:text-white/70",
          )}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
