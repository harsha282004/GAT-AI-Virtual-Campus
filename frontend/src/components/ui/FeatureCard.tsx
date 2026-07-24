"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/utils";

export type FeatureAccent = "purple" | "blue" | "orange" | "green" | "pink" | "gold";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: FeatureAccent;
  className?: string;
  index?: number;
}

const ACCENT_STYLES: Record<FeatureAccent, { bg: string; text: string }> = {
  purple: { bg: "bg-accent-purple/12", text: "text-accent-purple" },
  blue: { bg: "bg-brand/10", text: "text-brand" },
  orange: { bg: "bg-accent-orange/12", text: "text-accent-orange" },
  green: { bg: "bg-accent-green/12", text: "text-accent-green" },
  pink: { bg: "bg-accent-pink/12", text: "text-accent-pink" },
  gold: { bg: "bg-accent-gold/12", text: "text-accent-gold" },
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  accent = "blue",
  className,
  index = 0,
}: FeatureCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -8 }}
      className={cn(
        "glass group relative overflow-hidden rounded-3xl p-8 shadow-soft transition-shadow duration-300 hover:shadow-glow",
        className,
      )}
    >
      <div
        className={cn(
          "mb-6 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
          styles.bg,
          styles.text,
        )}
      >
        <Icon className="h-8 w-8" strokeWidth={1.6} />
      </div>

      <h3 className="mb-2.5 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{description}</p>

      <ArrowUpRight
        className={cn(
          "absolute right-7 top-7 h-5 w-5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100",
          styles.text,
        )}
      />
    </motion.div>
  );
}
