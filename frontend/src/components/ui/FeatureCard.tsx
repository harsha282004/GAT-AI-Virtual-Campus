"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: "maroon" | "gold" | "navy";
  className?: string;
  index?: number;
}

const ACCENT_STYLES = {
  maroon: "bg-gat-maroon/10 text-gat-maroon",
  gold: "bg-gat-gold/15 text-gat-gold-dark",
  navy: "bg-gat-navy/10 text-gat-navy dark:bg-white/10 dark:text-white",
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  accent = "navy",
  className,
  index = 0,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      className={cn(
        "group rounded-2xl border border-gat-navy/10 bg-white p-7 shadow-sm transition-shadow duration-300 hover:shadow-xl",
        "dark:border-white/10 dark:bg-gat-navy-light",
        className,
      )}
    >
      <div
        className={cn(
          "mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          ACCENT_STYLES[accent],
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="mb-2 font-display text-lg font-semibold text-gat-navy dark:text-white">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-gat-navy/70 dark:text-white/70">{description}</p>
    </motion.div>
  );
}
