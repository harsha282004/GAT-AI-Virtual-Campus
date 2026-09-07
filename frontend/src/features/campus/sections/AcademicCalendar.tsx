"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Flag,
  GraduationCap,
  PartyPopper,
  Presentation,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button, SectionTitle } from "@/components/ui";
import { useTranslation } from "@/hooks";

const GAT = "https://www.gat.ac.in";

/**
 * GAT does NOT publish structured academic-calendar dates anywhere in this
 * project — only PDF/HTML documents. So this timeline shows the *typical
 * shape* of a semester (no invented dates) and links straight to the
 * authoritative calendar for the actual schedule.
 */
const PHASES: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Flag, title: "Semester Begins", detail: "Commencement of classes and registration." },
  {
    icon: Presentation,
    title: "Instruction & Activities",
    detail: "Regular teaching, labs, technical events and department activities.",
  },
  {
    icon: ClipboardCheck,
    title: "Internal Assessment (CIA)",
    detail: "Continuous internal assessment tests across the semester.",
  },
  {
    icon: PartyPopper,
    title: "Events & Fests",
    detail: "Cultural, sports and technical festivals as scheduled.",
  },
  {
    icon: GraduationCap,
    title: "Semester-End Examinations (SEE)",
    detail: "Practical and theory end-semester examinations.",
  },
  {
    icon: Flag,
    title: "Semester Ends",
    detail: "Results, semester break and preparation for the next term.",
  },
];

export function AcademicCalendar({ onAskAi }: { onAskAi: (question: string) => void }) {
  const { t } = useTranslation();

  return (
    <section id="calendar" className="section-padding bg-white dark:bg-[#0B1220]">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("Academic Calendar")}
          title={t("How a GAT semester unfolds")}
          subtitle={t(
            "The stages every semester moves through. Exact dates change each term — always confirm against the official calendar.",
          )}
        />

        <div className="relative mx-auto max-w-3xl">
          <div className="absolute bottom-4 left-[19px] top-4 w-0.5 bg-hairline sm:left-1/2 sm:-translate-x-1/2" />
          <ul className="space-y-6">
            {PHASES.map((phase, index) => {
              const Icon = phase.icon;
              const left = index % 2 === 0;
              return (
                <motion.li
                  key={phase.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className={`relative flex items-start gap-4 sm:w-1/2 ${
                    left ? "sm:pr-10" : "sm:ml-auto sm:flex-row-reverse sm:pl-10 sm:text-right"
                  }`}
                >
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-soft">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="rounded-2xl border border-hairline bg-white p-4 shadow-soft dark:bg-[#0F172A]">
                    <p className="font-display text-sm font-semibold text-ink">
                      {t(phase.title)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{t(phase.detail)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Button
            href={`${GAT}/academic-calendar.html`}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            size="md"
            icon={<CalendarDays className="h-5 w-5" />}
          >
            {t("View Official Calendar")}
          </Button>
          <Button
            href={`${GAT}/documents/Calender Of Eevents 2nd Semester.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="md"
            icon={<FileText className="h-5 w-5" />}
          >
            {t("Calendar of Events (PDF)")}
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={<Sparkles className="h-5 w-5" />}
            onClick={() => onAskAi("When does the current semester begin at GAT?")}
          >
            {t("Ask AI about dates")}
          </Button>
        </div>
      </div>
    </section>
  );
}
