"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";

import { cn } from "@/utils";

export type FeatureAccent = "purple" | "blue" | "orange" | "green" | "pink" | "gold";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: FeatureAccent;
  className?: string;
  index?: number;
  /** When set, the whole card navigates here — the existing hover
   * ArrowUpRight affordance already below is what signals "clickable",
   * so no extra styling is needed. Omit to keep a card purely
   * informational (e.g. Multi-language Support). */
  href?: string;
}

const ACCENT_STYLES: Record<FeatureAccent, { bg: string; text: string; glow: string }> = {
  purple: { bg: "bg-accent-purple/12", text: "text-accent-purple", glow: "124,111,235" },
  blue: { bg: "bg-brand/10", text: "text-brand", glow: "35,68,212" },
  orange: { bg: "bg-accent-orange/12", text: "text-accent-orange", glow: "245,158,66" },
  green: { bg: "bg-accent-green/12", text: "text-accent-green", glow: "34,181,115" },
  pink: { bg: "bg-accent-pink/12", text: "text-accent-pink", glow: "244,114,182" },
  gold: { bg: "bg-accent-gold/12", text: "text-accent-gold", glow: "212,165,55" },
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  accent = "blue",
  className,
  index = 0,
  href,
}: FeatureCardProps) {
  const styles = ACCENT_STYLES[accent];

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
  }

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -8 }}
      onMouseMove={handleMouseMove}
      style={{ "--spot-color": styles.glow } as CSSProperties}
      className={cn(
        "glass group relative overflow-hidden rounded-3xl p-8 shadow-soft transition-shadow duration-300 hover:shadow-glow",
        href && "cursor-pointer",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(var(--spot-color), 0.12), transparent 65%)",
        }}
      />

      <div
        className={cn(
          "relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
          styles.bg,
          styles.text,
        )}
      >
        <Icon className="h-8 w-8" strokeWidth={1.6} />
      </div>

      <h3 className="relative mb-2.5 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="relative text-sm leading-relaxed text-muted">{description}</p>

      <ArrowUpRight
        className={cn(
          "absolute right-7 top-7 h-5 w-5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100",
          styles.text,
        )}
      />
    </motion.div>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {card}
    </Link>
  );
}
