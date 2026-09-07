"use client";

import { motion } from "framer-motion";

import { useCampusStats } from "@/hooks";
import { useTranslation } from "@/hooks";

import { CountUp } from "../components/CountUp";

interface StatDef {
  key:
    | "buildings"
    | "floors"
    | "tour_scenes"
    | "nodes"
    | "rooms"
    | "edges";
  label: string;
}

const STAT_DEFS: StatDef[] = [
  { key: "buildings", label: "Buildings" },
  { key: "floors", label: "Floors" },
  { key: "tour_scenes", label: "360° Scenes" },
  { key: "nodes", label: "Mapped Locations" },
  { key: "rooms", label: "Rooms" },
  { key: "edges", label: "Walkable Paths" },
];

export function CampusAtAGlance() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCampusStats(1);

  return (
    <section
      id="glance"
      className="section-padding relative overflow-hidden bg-brand-gradient text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)",
        }}
      />
      <div className="container-page relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            {t("Campus at a Glance")}
          </span>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {t("The digital campus, by the numbers")}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70">
            {t(
              "Every figure below is read live from the campus database that powers the 360° tour, navigation graph and AI assistant.",
            )}
          </p>
        </motion.div>

        {isError ? (
          <p className="text-center text-sm text-white/70">
            {t("Live campus statistics are unavailable right now.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-6">
            {STAT_DEFS.map((stat, index) => (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: index * 0.06 }}
                className="rounded-3xl border border-white/15 bg-white/10 px-4 py-8 text-center backdrop-blur-sm"
              >
                <p className="font-display text-3xl font-bold sm:text-4xl">
                  {isLoading || !data ? (
                    <span className="opacity-40">&mdash;</span>
                  ) : (
                    <CountUp value={data[stat.key]} />
                  )}
                </p>
                <p className="mt-2 text-xs text-white/70 sm:text-sm">{t(stat.label)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
