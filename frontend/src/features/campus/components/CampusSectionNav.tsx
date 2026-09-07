"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";

import { cn } from "@/utils";

export interface CampusSection {
  id: string;
  label: string;
}

/**
 * Slim dot-rail in-page nav so the Campus page reads as one continuous
 * experience. Each dot expands to its label on hover; the whole rail is
 * hidden below `xl` where vertical scroll is the primary navigation. Kept
 * narrow so it never overlaps the centred content column.
 */
export function CampusSectionNav({
  sections,
  activeId,
  onNavigate,
}: {
  sections: CampusSection[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setVisible(y > 520));

  return (
    <motion.nav
      aria-label="Campus sections"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : 12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 xl:block",
        !visible && "pointer-events-none",
      )}
    >
      <ul className="flex flex-col gap-2.5">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <li key={section.id} className="group flex items-center justify-end gap-2">
              <span
                className={cn(
                  "pointer-events-none whitespace-nowrap rounded-lg bg-ink/90 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-white/90 dark:text-ink",
                )}
              >
                {section.label}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(section.id)}
                aria-label={section.label}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border transition-all",
                  active
                    ? "scale-125 border-brand bg-brand"
                    : "border-hairline bg-white/70 hover:border-brand/60 hover:bg-brand/40 dark:bg-white/20",
                )}
              />
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
