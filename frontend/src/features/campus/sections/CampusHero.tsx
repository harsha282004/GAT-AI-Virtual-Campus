"use client";

import { motion } from "framer-motion";
import { Building2, Compass, Sparkles } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui";
import { useTranslation } from "@/hooks";

export function CampusHero({ onJump }: { onJump: (id: string) => void }) {
  const { t } = useTranslation();

  return (
    <section id="hero" className="relative flex min-h-[92vh] items-center overflow-hidden">
      <Image
        src="/images/background1.jpeg"
        alt="Global Academy of Technology campus"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Neutral (no colour cast) readability scrim. A left-to-right black
          gradient keeps the heading/CTA column legible while the right side
          stays close to the natural photo; a soft bottom fade covers the
          scroll cue. The campus building, sky and greenery keep their real
          colours — no blue tint, no grayscale, no heavy darkening. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/5"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent"
      />

      <div className="container-page relative z-10 py-32 text-white">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("Campus Intelligence")}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
        >
          {t("Explore GAT Beyond the Buildings")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75"
        >
          {t(
            "Discover academics, facilities, resources, learning environments and the campus itself through an interactive digital experience.",
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <Button
            variant="primary"
            size="lg"
            icon={<Compass className="h-5 w-5" />}
            onClick={() => onJump("academics")}
          >
            {t("Explore Academics")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<Building2 className="h-5 w-5" />}
            onClick={() => onJump("facilities")}
          >
            {t("Explore Facilities")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            icon={<Sparkles className="h-5 w-5" />}
            onClick={() => onJump("ai-explorer")}
            className="border-white/40 bg-white/10 text-white hover:border-white hover:bg-white hover:text-brand"
          >
            {t("Ask GAT AI")}
          </Button>
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={() => onJump("glance")}
        aria-label={t("Scroll to campus overview")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-white/60 transition-colors hover:text-white"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em]">{t("Scroll")}</span>
        <span className="flex h-9 w-5 items-start justify-center rounded-full border border-white/40 p-1">
          <motion.span
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="h-1.5 w-1.5 rounded-full bg-white"
          />
        </span>
      </motion.button>
    </section>
  );
}
