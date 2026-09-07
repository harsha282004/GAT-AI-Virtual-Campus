"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Book,
  Calendar,
  FlaskConical,
  GraduationCap,
  Megaphone,
  Newspaper,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { SectionTitle } from "@/components/ui";
import { useTranslation } from "@/hooks";
import { cn } from "@/utils";

import {
  ACADEMIC_RESOURCES,
  RESOURCE_CATEGORIES,
  type ResourceCategory,
} from "../data/academicResources";

const ICONS: Record<string, LucideIcon> = {
  book: Book,
  calendar: Calendar,
  megaphone: Megaphone,
  newspaper: Newspaper,
  flask: FlaskConical,
  graduation: GraduationCap,
};

export function AcademicResources() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ResourceCategory | "all">("all");

  const visible = useMemo(
    () =>
      active === "all"
        ? ACADEMIC_RESOURCES
        : ACADEMIC_RESOURCES.filter((r) => r.category === active),
    [active],
  );

  return (
    <section id="resources" className="section-padding bg-white dark:bg-[#0B1220]">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("Academic Resources")}
          title={t("Official documents, one click away")}
          subtitle={t(
            "Syllabi, calendars, circulars, newsletters and accreditation data — every link points to the authoritative GAT source.",
          )}
        />

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all",
              active === "all"
                ? "bg-brand text-white shadow-soft"
                : "border border-hairline bg-white text-muted hover:text-ink dark:bg-[#0F172A]",
            )}
          >
            {t("All")}
          </button>
          {RESOURCE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                active === cat.id
                  ? "bg-brand text-white shadow-soft"
                  : "border border-hairline bg-white text-muted hover:text-ink dark:bg-[#0F172A]",
              )}
            >
              {t(cat.label)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((resource, index) => {
            const cat = RESOURCE_CATEGORIES.find((c) => c.id === resource.category);
            const Icon = ICONS[cat?.icon ?? "book"] ?? Book;
            return (
              <motion.a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
                className="group flex flex-col rounded-3xl border border-hairline bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow dark:bg-[#0F172A]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {t(resource.title)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {t(resource.description)}
                </p>
                {resource.meta && (
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-brand/70">
                    {resource.meta}
                  </p>
                )}
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
