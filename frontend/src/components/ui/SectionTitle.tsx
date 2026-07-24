"use client";

import { motion } from "framer-motion";

import { cn } from "@/utils";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionTitle({ eyebrow, title, subtitle, align = "center", className }: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn("mb-16 max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left", className)}
    >
      {eyebrow && (
        <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand">
          <span className="h-px w-6 bg-brand" />
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "gradient-underline inline-block pb-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl",
          align === "center" && "gradient-underline--center",
        )}
      >
        {title}
      </h2>
      {subtitle && <p className="mt-6 text-base leading-relaxed text-muted">{subtitle}</p>}
    </motion.div>
  );
}
