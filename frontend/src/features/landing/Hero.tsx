"use client";

import { motion } from "framer-motion";
import { ArrowDown, MessageSquare, PlayCircle } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#F8FBFF] pt-24 pb-20 dark:bg-[#020617] lg:pt-28">

      {/* subtle background */}
      <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-[0.04]" />

      <div className="container-page relative">

        <div className="grid items-center gap-10 lg:grid-cols-[44%_56%]">

          {/* LEFT */}

          <div className="z-10">

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .6 }}
              className="inline-flex items-center rounded-full border border-[#2E4DB7]/20 bg-white px-6 py-2 text-xs font-semibold tracking-[0.25em] text-[#2E4DB7] shadow-sm dark:border-[#5B8CFF]/30 dark:bg-[#0F172A] dark:text-[#5B8CFF]"
            >
              EST. 2001 • VTU AFFILIATED • NAAC A GRADE
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .7 }}
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
              transition={{ delay: .2 }}
              className="mt-8 max-w-lg text-lg leading-8 text-slate-700 dark:text-slate-300"
            >
              Growing Ahead Of Time — explore GAT&apos;s buildings,
              laboratories, classrooms and facilities using an
              AI-guided assistant, indoor navigation,
              immersive 360° virtual tours and an interactive
              3D campus map.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .35 }}
              className="mt-12 flex flex-wrap gap-5"
            >
              <Button
                href="/tour"
                size="lg"
                variant="primary"
                icon={<PlayCircle className="h-5 w-5" />}
              >
                Explore Virtual Tour
              </Button>

              <Button
                href="/chat"
                size="lg"
                variant="secondary"
                icon={<MessageSquare className="h-5 w-5" />}
              >
                Ask the AI Assistant
              </Button>

            </motion.div>

          </div>

          {/* RIGHT IMAGE */}

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: .8 }}
            className="relative h-[760px] overflow-hidden rounded-[42px]"
          >

            <Image
              src="/images/background1.jpeg"
              alt="Global Academy of Technology"
              fill
              priority
              className="object-cover object-center"
            />

            {/* soft fade */}

            <div className="absolute inset-0 bg-gradient-to-r from-[#F8FBFF] via-white/15 to-transparent dark:from-[#020617] dark:via-black/15" />

          </motion.div>

        </div>

      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{
          repeat: Infinity,
          duration: 2,
        }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#2E4DB7]"
      >
        <ArrowDown size={24} />
      </motion.div>

    </section>
  );
}