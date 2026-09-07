/**
 * "What's Happening at GAT" — DATA SOURCE OF TRUTH.
 *
 * GAT does not publish a live events/news feed anywhere in this project
 * (no such page was crawled). Rather than show a bare empty state, this
 * section surfaces the real, official campus updates that DO exist in the
 * project corpus: the tentative calendars of events, academic circulars
 * and the institutional newsletter. Every URL is from the project's own
 * crawl (data/raw/pdfs/, data/raw/website/, source_manifest.json).
 * Nothing here is a fabricated event.
 */

const GAT = "https://www.gat.ac.in";

export type UpdateKind = "calendar" | "circular" | "newsletter" | "exam";

export interface CampusUpdate {
  id: string;
  kind: UpdateKind;
  title: string;
  summary: string;
  /** Term / period the document relates to, as printed on the source. */
  period: string;
  url: string;
}

export const UPDATE_KIND_LABEL: Record<UpdateKind, string> = {
  calendar: "Calendar of Events",
  circular: "Academic Circular",
  newsletter: "Newsletter",
  exam: "Examinations",
};

export const CAMPUS_UPDATES: CampusUpdate[] = [
  {
    id: "coe-even",
    kind: "calendar",
    title: "Tentative Calendar of Events — 2nd Semester",
    summary:
      "Week-by-week plan of instruction, internal assessments and activities for even-semester classes.",
    period: "Even Semester",
    url: `${GAT}/documents/Calender Of Eevents 2nd Semester.pdf`,
  },
  {
    id: "coe-8-even",
    kind: "calendar",
    title: "Tentative Calendar of Events — 8th Semester (Even)",
    summary: "Schedule of activities and assessments for the final even semester.",
    period: "8th Sem · Even",
    url: `${GAT}/documents/Tentative Calendar of Events of 8th Sem - Even.pdf`,
  },
  {
    id: "coe-4-6-even",
    kind: "calendar",
    title: "Calendar of Events — 4th & 6th Semester (Even) 2025-2026",
    summary: "Combined calendar of events for the 4th and 6th even semesters.",
    period: "4th & 6th Sem · 2025-26",
    url: `${GAT}/documents/4th& 6th Even CoE . 2025-2026.pdf`,
  },
  {
    id: "acad-calendar-3-5-7",
    kind: "calendar",
    title: "Academic Calendar 2026-27 (3rd, 5th, 7th Semester)",
    summary: "Official academic calendar for odd-semester classes for the 2026-27 year.",
    period: "3/5/7 Sem · 2026-27",
    url: `${GAT}/academic-calendar.html`,
  },
  {
    id: "circulars-hub",
    kind: "circular",
    title: "Academic Circulars",
    summary:
      "All current attendance, examination and academic notices issued by the institution.",
    period: "Current",
    url: `${GAT}/academic-circulars.html`,
  },
  {
    id: "see-timetable-ug",
    kind: "exam",
    title: "SEE Timetables & Examination Notifications",
    summary:
      "Semester-end examination timetables, application forms and make-up examination notifications.",
    period: "June 2026 session",
    url: `${GAT}/examinations.html`,
  },
  {
    id: "newsletter",
    kind: "newsletter",
    title: "Magazine & Newsletter Cell",
    summary: "GAT's institutional magazine and newsletter publications.",
    period: "Ongoing",
    url: `${GAT}/documents/Magazine and Newsletter Cell_new.pdf`,
  },
];
