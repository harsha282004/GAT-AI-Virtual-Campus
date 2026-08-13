"use client";

import { motion } from "framer-motion";
import { Building2, Compass, Home, MapIcon, MessageSquare, PlayCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui";

const SUGGESTED_ROUTES = [
  { label: "Campus Overview", href: "/campus", icon: Building2 },
  { label: "Virtual Tour", href: "/tour", icon: PlayCircle },
  { label: "3D Campus Map", href: "/map", icon: MapIcon },
];

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-[0.04]" />

      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-3xl"
      />

      <motion.span
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-6 py-2 text-xs font-semibold tracking-[0.25em] text-brand shadow-sm dark:bg-[#0F172A]"
      >
        <Compass className="h-3.5 w-3.5" />
        LOST ON CAMPUS
      </motion.span>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="relative mt-6 font-display text-[96px] font-black leading-none tracking-tight text-gradient-brand sm:text-[140px]"
      >
        404
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="relative mt-4 max-w-md text-lg leading-8 text-muted"
      >
        This path doesn&apos;t lead anywhere on the GAT campus. The page may have moved, or the
        link might be outdated.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="relative mt-10 flex flex-wrap items-center justify-center gap-4"
      >
        <Button href="/" size="lg" variant="primary" icon={<Home className="h-5 w-5" />}>
          Back to Home
        </Button>
        <Button href="/chat" size="lg" variant="outline" icon={<MessageSquare className="h-5 w-5" />}>
          Ask the AI Assistant
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45 }}
        className="relative mt-16 w-full max-w-2xl"
      >
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Or try one of these
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUGGESTED_ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-white px-4 py-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-glow dark:bg-[#0F172A]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                <route.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium text-ink/80">{route.label}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
