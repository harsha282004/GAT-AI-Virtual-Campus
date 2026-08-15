"use client";

import { motion } from "framer-motion";
import { ArrowDown, GraduationCap, MapPin, MessageSquare, PlayCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui";

const TRUST_STATS = [
  { icon: GraduationCap, label: "Est. 2001" },
  { icon: ShieldCheck, label: "NAAC A Grade" },
  { icon: MapPin, label: "10-Acre Campus" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#F8FBFF] pt-24 pb-20 dark:bg-[#020617] lg:pt-28">
      {/* Full-bleed background video. poster is the video's own first frame
          (extracted from this exact file, not an unrelated photo), so
          whatever's visible before/while the video loads already matches
          it — no swap from a different image once playback starts, and no
          separate <Image> element left in the DOM to flash on remount
          (e.g. navigating Campus -> Home). */}
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/videos/campus1-poster.jpg"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      >
        <source src="/videos/campus1.mp4" type="video/mp4" />
      </video>
      {/* floating decorative orbs */}
      <motion.div
        animate={{ y: [0, -18, 0], x: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[6%] top-24 h-24 w-24 rounded-full bg-[#2344D4]/20 blur-2xl dark:bg-[#5B8CFF]/20"
      />
      <motion.div
        animate={{ y: [0, 16, 0], x: [0, -12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        className="pointer-events-none absolute left-[40%] top-8 h-16 w-16 rounded-2xl bg-accent-gold/20 blur-2xl"
      />
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        className="pointer-events-none absolute right-[8%] top-1/3 h-20 w-20 rounded-full bg-accent-purple/20 blur-2xl"
      />

      <div className="container-page relative">
        <div className="grid items-center gap-10 lg:grid-cols-[44%_56%]">
          {/* LEFT */}

          <div className="z-10">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center rounded-full border border-[#2E4DB7]/20 bg-white px-6 py-2 text-xs font-semibold tracking-[0.25em] text-[#2E4DB7] shadow-sm dark:border-[#5B8CFF]/30 dark:bg-[#0F172A] dark:text-[#5B8CFF]"
            >
              EST. 2001 • VTU AFFILIATED • NAAC A GRADE
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="mt-5 max-w-2xl text-[48px] font-black leading-[0.95] tracking-tight text-[#17306D] dark:text-white lg:text-[58px] xl:text-[64px]"
            >
              Global Academy
              <br />
              of Technology,
              <br />
              <span className="text-[#2E4DB7] dark:text-[#5B8CFF]">
                reimagined as
                <br />
                a virtual campus.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 max-w-lg text-lg leading-8 text-[#BFDBFE]"
            >
              Growing Ahead Of Time — explore GAT&apos;s buildings, laboratories, classrooms and
              facilities using an AI-guided assistant, indoor navigation, immersive 360° virtual
              tours and an interactive 3D campus map.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-12 flex flex-wrap gap-5"
            >
              <Button href="/tour" size="lg" variant="primary" icon={<PlayCircle className="h-5 w-5" />}>
                Explore Virtual Tour
              </Button>

              <Button href="/chat" size="lg" variant="secondary" icon={<MessageSquare className="h-5 w-5" />}>
                Ask the AI Assistant
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-hairline pt-8"
            >
              {TRUST_STATS.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2E4DB7]/10 text-white dark:bg-[#5B8CFF]/10">
                    <stat.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-white">{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#2E4DB7]"
      >
        <ArrowDown size={24} />
      </motion.div>
    </section>
  );
}
