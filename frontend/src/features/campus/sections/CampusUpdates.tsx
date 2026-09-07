"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, FileWarning, Megaphone, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionTitle } from "@/components/ui";
import { useTranslation } from "@/hooks";

import { CAMPUS_UPDATES, UPDATE_KIND_LABEL, type UpdateKind } from "../data/campusUpdates";

const KIND_ICON: Record<UpdateKind, LucideIcon> = {
  calendar: CalendarClock,
  circular: Megaphone,
  newsletter: Newspaper,
  exam: FileWarning,
};

export function CampusUpdates() {
  const { t } = useTranslation();
  const updates = CAMPUS_UPDATES;

  return (
    <section id="updates" className="section-padding bg-canvas">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("What's Happening at GAT")}
          title={t("Campus updates & academic notices")}
          subtitle={t(
            "The latest official calendars of events, circulars and publications from the institution.",
          )}
        />

        {updates.length === 0 ? (
          <p className="mx-auto max-w-md rounded-3xl border border-dashed border-hairline bg-white p-10 text-center text-sm text-muted dark:bg-[#0F172A]">
            {t("No upcoming campus events are currently available.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {updates.map((update, index) => {
              const Icon = KIND_ICON[update.kind];
              return (
                <motion.a
                  key={update.id}
                  href={update.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
                  className="group flex flex-col rounded-3xl border border-hairline bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow dark:bg-[#0F172A]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
                      <Icon className="h-3.5 w-3.5" />
                      {t(UPDATE_KIND_LABEL[update.kind])}
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ink">
                    {t(update.title)}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {t(update.summary)}
                  </p>
                  <p className="mt-4 text-xs font-medium text-muted">{update.period}</p>
                </motion.a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
