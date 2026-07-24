"use client";

import { motion } from "framer-motion";
import { ArrowDown, MessageSquare, PlayCircle } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui";

export function Hero() {
  return (
    <section className="relative flex h-screen min-h-[720px] items-center overflow-hidden">
      {/* Campus image slot — drop the official photo at public/images/campus-hero.jpg
          (update the src below) to replace this placeholder illustration. */}
      <Image
        src="/images/campus-hero.svg"
        alt="Global Academy of Technology campus"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-hero-overlay" />

      <div className="container-page relative px-6 sm:px-10 lg:px-16">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand shadow-soft backdrop-blur-sm"
        >
          Est. 2001 · VTU Affiliated · NAAC A Grade
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl"
        >
          Global Academy of Technology
          <span className="text-gradient-brand block">
            Reimagined as an Intelligent Virtual Campus
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: "easeOut" }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-muted"
        >
          Explore the entire campus through AI-powered assistance, 360° immersive tours, indoor
          navigation, interactive 3D mapping, and intelligent campus guidance.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.34, ease: "easeOut" }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Button href="/tour" size="lg" variant="primary" icon={<PlayCircle className="h-5 w-5" />}>
            Explore Virtual Tour
          </Button>
          <Button href="/chat" size="lg" variant="secondary" icon={<MessageSquare className="h-5 w-5" />}>
            Ask AI Assistant
          </Button>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-brand/50"
      >
        <ArrowDown className="h-5 w-5" />
      </motion.div>
    </section>
  );
}
