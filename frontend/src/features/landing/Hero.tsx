"use client";

import { motion } from "framer-motion";
import { ArrowDown, MessageSquare, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui";

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-gat-hero pt-24">
      {/* Decorative glow accents — no external image dependency */}
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-gat-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-gat-maroon/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="container-page relative px-6 py-20 sm:px-10 lg:px-16">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-gat-gold-light"
        >
          Est. 2001 · VTU Affiliated · NAAC A Grade
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-3xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl"
        >
          Global Academy of Technology,
          <span className="text-gradient-gold block">reimagined as a virtual campus.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-xl text-lg text-white/70"
        >
          Growing Ahead Of Time — explore GAT&apos;s buildings, labs, and facilities with an
          AI-guided assistant, indoor navigation, a 360° panorama tour, and a 3D campus map.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Button href="/tour" size="lg" variant="secondary" icon={<PlayCircle className="h-5 w-5" />}>
            Explore Virtual Tour
          </Button>
          <Button
            href="/chat"
            size="lg"
            variant="outline"
            className="border-white/25 text-white hover:bg-white/10"
            icon={<MessageSquare className="h-5 w-5" />}
          >
            Ask the AI Assistant
          </Button>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
      >
        <ArrowDown className="h-5 w-5" />
      </motion.div>
    </section>
  );
}
