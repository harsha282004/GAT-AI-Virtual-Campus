"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button, SectionTitle } from "@/components/ui";
import { useTranslation } from "@/hooks";
import { cn } from "@/utils";

import { CAMPUS_FACILITIES } from "../data/campusFacilities";
import {
  ACADEMIC_PROGRAMMES,
  PROGRAMME_LEVELS,
  type AcademicProgramme,
  type ProgrammeLevel,
} from "../data/academicPrograms";

export function AcademicJourney({
  onAskAi,
  onExploreCampus,
}: {
  onAskAi: (question: string) => void;
  onExploreCampus: () => void;
}) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<ProgrammeLevel>("UG");
  const [selectedId, setSelectedId] = useState<string>("cse");

  const programmes = useMemo(
    () => ACADEMIC_PROGRAMMES.filter((p) => p.level === level),
    [level],
  );

  const selected: AcademicProgramme | undefined =
    programmes.find((p) => p.id === selectedId) ?? programmes[0];

  const hasCampusPresence =
    selected !== undefined &&
    CAMPUS_FACILITIES.some((f) => f.programmeId === selected.id);

  function pickLevel(next: ProgrammeLevel) {
    setLevel(next);
    const first = ACADEMIC_PROGRAMMES.find((p) => p.level === next);
    if (first) setSelectedId(first.id);
  }

  return (
    <section id="academics" className="section-padding bg-canvas">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("Your Academic Journey")}
          title={t("Departments, schemes and official syllabi")}
          subtitle={t(
            "Pick a department to open its official page, scheme & syllabus documents, and ask the GAT AI about it. Course-level details live in the official syllabus documents.",
          )}
        />

        {/* Level selector */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {PROGRAMME_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => pickLevel(lvl.id)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                level === lvl.id
                  ? "bg-brand text-white shadow-soft"
                  : "border border-hairline bg-white text-muted hover:border-brand/40 hover:text-ink dark:bg-[#0F172A]",
              )}
            >
              {t(lvl.label)}
            </button>
          ))}
        </div>

        {/* Department selector */}
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {programmes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-all",
                selected?.id === p.id
                  ? "bg-brand/10 text-brand ring-1 ring-brand/30"
                  : "text-muted hover:bg-brand/5 hover:text-ink",
              )}
            >
              {p.code}
            </button>
          ))}
        </div>

        {/* Selected programme card */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft dark:bg-[#0F172A]"
            >
              <div className="border-b border-hairline bg-brand/5 p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {selected.code}
                    </span>
                    <h3 className="font-display text-2xl font-semibold text-ink">
                      {selected.name}
                    </h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{selected.blurb}</p>
              </div>

              <div className="p-7">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("Scheme & Syllabus")}
                </h4>
                <div className="mb-6 flex flex-wrap gap-2">
                  {selected.schemes.map((scheme) => (
                    <a
                      key={scheme.year}
                      href={selected.officialPage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 rounded-xl border border-hairline px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand/40 hover:bg-brand/5"
                      title={t("Opens the official GAT department page, which hosts every scheme & syllabus PDF")}
                    >
                      <FileText className="h-4 w-4 text-brand" />
                      {scheme.year === "Current"
                        ? t("Current Scheme")
                        : `${scheme.year} ${t("Scheme")}`}
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    href={selected.officialPage}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="primary"
                    size="sm"
                    icon={<BookOpen className="h-4 w-4" />}
                  >
                    {t("View Scheme & Syllabus")}
                  </Button>
                  {selected.brochure && (
                    <Button
                      href={selected.brochure}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outline"
                      size="sm"
                      icon={<FileText className="h-4 w-4" />}
                    >
                      {t("Department Brochure")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Sparkles className="h-4 w-4" />}
                    onClick={() =>
                      onAskAi(`Tell me about the ${selected.name} department at GAT.`)
                    }
                  >
                    {t("Ask AI")}
                  </Button>
                  {hasCampusPresence && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Building2 className="h-4 w-4" />}
                      onClick={onExploreCampus}
                    >
                      {t("Find it on campus")}
                    </Button>
                  )}
                </div>

                <p className="mt-5 text-xs leading-relaxed text-muted">
                  {t(
                    "Opens the official GAT department page, which lists every scheme & syllabus document. Per-semester subject lists, course codes and credits live inside those documents — GAT does not expose them as structured data.",
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
