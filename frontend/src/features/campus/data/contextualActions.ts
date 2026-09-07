import type { ChatApiResponse } from "@/types";

import { ACADEMIC_PROGRAMMES } from "./academicPrograms";
import { CAMPUS_FACILITIES } from "./campusFacilities";

export interface CampusAction {
  kind: "syllabus" | "department" | "tour" | "source";
  label: string;
  /** External link (syllabus/department/source). */
  href?: string;
  /** Internal action target (tour) — resolved by the caller. */
  facilityId?: string;
  nodeId?: number;
}

/**
 * Derives "next step" actions for an AI answer PURELY from data we already
 * know is real (the programme + facility catalogues and the resolved
 * scene-node map). The chat endpoint's `navigation`/`panorama` fields are
 * not relied on (Phase 9 left them unpopulated for chat). Nothing is
 * fabricated: an action only appears when a catalogue entry's name is
 * clearly referenced in the question or answer AND its target exists.
 */
export function deriveCampusActions(
  question: string,
  response: ChatApiResponse | null,
  resolveNode: (panoramaFile: string) => number | undefined,
): CampusAction[] {
  const haystack = `${question} ${response?.answer ?? ""}`.toLowerCase();
  const actions: CampusAction[] = [];
  const seen = new Set<string>();

  const add = (a: CampusAction, dedupeKey: string) => {
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    actions.push(a);
  };

  // Programme references -> syllabus + department page
  for (const p of ACADEMIC_PROGRAMMES) {
    const names = [p.name.toLowerCase(), p.code.toLowerCase()];
    const hit = names.some((n) => n.length > 2 && haystack.includes(n));
    if (!hit) continue;
    add(
      { kind: "department", label: `${p.code} department page`, href: p.officialPage },
      `dept-${p.id}`,
    );
    // Always the department page — it hosts every scheme & syllabus PDF and is
    // reliably browser-accessible; several direct PDF URLs return AccessDenied.
    add(
      { kind: "syllabus", label: `${p.code} scheme & syllabus`, href: p.officialPage },
      `syllabus-${p.id}`,
    );
    if (actions.length >= 4) break;
  }

  // Facility references -> 360° + directions (only if a real scene resolves)
  for (const f of CAMPUS_FACILITIES) {
    if (actions.length >= 5) break;
    const key = f.name.toLowerCase().replace(/department of |[()]/g, "").trim();
    const shortKey = key.split(" ").slice(0, 3).join(" ");
    if (shortKey.length < 5 || !haystack.includes(shortKey)) continue;
    if (!f.panoramaFile) continue;
    const nodeId = resolveNode(f.panoramaFile);
    if (nodeId === undefined) continue;
    add(
      { kind: "tour", label: `View ${f.name} in 360°`, facilityId: f.id, nodeId },
      `tour-${f.id}`,
    );
  }

  // Always: the official sources the answer was grounded in
  for (const s of response?.sources ?? []) {
    if (!s.source_url || actions.length >= 7) continue;
    const looksLikeFilename =
      !s.title || s.title === s.source_url || /\.(pdf|docx?|pptx?)$/i.test(s.title);
    const label = looksLikeFilename ? "Official GAT source" : (s.title as string);
    add({ kind: "source", label, href: s.source_url }, `src-${s.source_url}`);
  }

  return actions;
}
