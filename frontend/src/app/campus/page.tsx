"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AcademicCalendar,
  AcademicJourney,
  AcademicResources,
  AiCampusExplorer,
  CampusAtAGlance,
  CampusFacilities,
  CampusHero,
  CampusSectionNav,
  CampusUpdates,
  EnterVirtualCampusCTA,
  type CampusSection,
} from "@/features/campus";
import { useCampusExplorer } from "@/hooks";

const SECTIONS: CampusSection[] = [
  { id: "glance", label: "At a Glance" },
  { id: "academics", label: "Academics" },
  { id: "resources", label: "Resources" },
  { id: "facilities", label: "Facilities" },
  { id: "calendar", label: "Calendar" },
  { id: "updates", label: "Updates" },
  { id: "ai-explorer", label: "Ask GAT AI" },
  { id: "enter", label: "Virtual Tour" },
];

export default function CampusPage() {
  const explorer = useCampusExplorer();
  const [activeId, setActiveId] = useState<string>("glance");
  const observerRef = useRef<IntersectionObserver | null>(null);

  const jumpTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** Called by any section's "Ask AI" button — send it to the shared
   * Explorer and bring that section into view. */
  const askAi = useCallback(
    (question: string) => {
      explorer.ask(question);
      // Let the answer panel mount before scrolling to it.
      window.setTimeout(() => jumpTo("ai-explorer"), 60);
    },
    [explorer, jumpTo],
  );

  // Track which section is in view for the sticky nav.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    observerRef.current = observer;
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <CampusSectionNav sections={SECTIONS} activeId={activeId} onNavigate={jumpTo} />

      <CampusHero onJump={jumpTo} />
      <CampusAtAGlance />
      <AcademicJourney onAskAi={askAi} onExploreCampus={() => jumpTo("facilities")} />
      <AcademicResources />
      <CampusFacilities />
      <AcademicCalendar onAskAi={askAi} />
      <CampusUpdates />
      <AiCampusExplorer explorer={explorer} />
      <EnterVirtualCampusCTA />
    </>
  );
}
