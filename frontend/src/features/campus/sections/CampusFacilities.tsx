"use client";

import { useMemo, useState } from "react";

import { SectionTitle } from "@/components/ui";
import { useCampusScenes, useTranslation } from "@/hooks";
import { cn } from "@/utils";

import { FacilityCard } from "../components/FacilityCard";
import {
  CAMPUS_FACILITIES,
  FACILITY_CATEGORIES,
  type CampusFacility,
  type FacilityCategory,
} from "../data/campusFacilities";

export function CampusFacilities() {
  const { t } = useTranslation();
  const { resolveNode } = useCampusScenes();
  const [active, setActive] = useState<FacilityCategory | "all">("all");

  const nodeFor = (f: CampusFacility) => (f.panoramaFile ? resolveNode(f.panoramaFile) : undefined);

  const visible = useMemo(
    () =>
      active === "all"
        ? CAMPUS_FACILITIES
        : CAMPUS_FACILITIES.filter((f) => f.category === active),
    [active],
  );

  return (
    <section id="facilities" className="section-padding bg-canvas">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("Explore Campus Facilities")}
          title={t("Walk the campus, room by room")}
          subtitle={t(
            "Departments, laboratories, halls and offices — identified from the 360° tour's own signage. Scenes marked 360° can be explored in the Virtual Tour.",
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
          {FACILITY_CATEGORIES.map((cat) => (
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((facility, index) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              hasScene={nodeFor(facility) !== undefined}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
