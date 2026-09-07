/**
 * Official GAT academic-resource links — DATA SOURCE OF TRUTH.
 *
 * Every URL here was found in the project's own crawl corpus
 * (data/raw/website/, data/raw/pdfs/, data/metadata/source_manifest.json)
 * during the Phase 0 audit. HTML pages verified HTTP 200; PDFs are linked
 * via their landing page where a direct hotlink is server-rejected.
 * Nothing here is fabricated.
 */

const GAT = "https://www.gat.ac.in";

export type ResourceCategory =
  | "syllabus"
  | "calendar"
  | "circulars"
  | "newsletter"
  | "research"
  | "programs";

export interface AcademicResource {
  id: string;
  category: ResourceCategory;
  title: string;
  description: string;
  /** Authoritative page or document. */
  url: string;
  /** Small caption shown under the title. */
  meta?: string;
}

export const RESOURCE_CATEGORIES: {
  id: ResourceCategory;
  label: string;
  icon: string;
}[] = [
  { id: "syllabus", label: "Syllabus & Schemes", icon: "book" },
  { id: "calendar", label: "Academic Calendar", icon: "calendar" },
  { id: "circulars", label: "Circulars", icon: "megaphone" },
  { id: "newsletter", label: "Newsletter", icon: "newspaper" },
  { id: "research", label: "Research & Rankings", icon: "flask" },
  { id: "programs", label: "Programmes", icon: "graduation" },
];

export const ACADEMIC_RESOURCES: AcademicResource[] = [
  // syllabus
  {
    id: "syllabus-hub",
    category: "syllabus",
    title: "Department Schemes & Syllabi",
    description:
      "Scheme and syllabus documents for every engineering department, on the official department pages.",
    url: `${GAT}/undergraduate-programs.html`,
    meta: "Official department pages",
  },
  {
    id: "pg-programs",
    category: "syllabus",
    title: "Postgraduate Programme Details",
    description: "M.Tech and MBA programme structure and curriculum.",
    url: `${GAT}/postgraduate-programs.html`,
    meta: "M.Tech · MBA",
  },
  // calendar
  {
    id: "academic-calendar",
    category: "calendar",
    title: "Academic Calendar",
    description:
      "Official academic calendar with semester dates, assessment windows and holidays.",
    url: `${GAT}/academic-calendar.html`,
    meta: "gat.ac.in/academic-calendar",
  },
  {
    id: "calendar-events-pdf",
    category: "calendar",
    title: "Calendar of Events (Even Semester)",
    description: "Tentative calendar of events for even-semester classes.",
    url: `${GAT}/documents/Calender Of Eevents 2nd Semester.pdf`,
    meta: "PDF",
  },
  // circulars
  {
    id: "academic-circulars",
    category: "circulars",
    title: "Academic Circulars",
    description:
      "All current examination, attendance and academic circulars issued by the institution.",
    url: `${GAT}/academic-circulars.html`,
    meta: "gat.ac.in/academic-circulars",
  },
  {
    id: "examinations",
    category: "circulars",
    title: "Examinations",
    description: "SEE timetables, application forms, notifications and exam regulations.",
    url: `${GAT}/examinations.html`,
    meta: "Examination cell",
  },
  // newsletter
  {
    id: "newsletter-cell",
    category: "newsletter",
    title: "Magazine & Newsletter Cell",
    description: "GAT's institutional magazine and newsletter publications.",
    url: `${GAT}/documents/Magazine and Newsletter Cell_new.pdf`,
    meta: "PDF",
  },
  // research
  {
    id: "nirf",
    category: "research",
    title: "NIRF",
    description: "National Institutional Ranking Framework data and disclosures.",
    url: `${GAT}/nirf.html`,
    meta: "gat.ac.in/nirf",
  },
  {
    id: "naac",
    category: "research",
    title: "NAAC Accreditation",
    description: "NAAC accreditation status (A grade) and self-study documents.",
    url: `${GAT}/naac.html`,
    meta: "A grade",
  },
  {
    id: "nba",
    category: "research",
    title: "NBA Accreditation",
    description: "Programme-level NBA accreditation details.",
    url: `${GAT}/nba-accrediation.html`,
    meta: "Programme accreditation",
  },
  {
    id: "iqac",
    category: "research",
    title: "IQAC",
    description: "Internal Quality Assurance Cell reports and quality initiatives.",
    url: `${GAT}/iqac.html`,
    meta: "Quality assurance",
  },
  // programs
  {
    id: "ug-programs",
    category: "programs",
    title: "Undergraduate Programmes",
    description: "All B.E. programmes offered at GAT.",
    url: `${GAT}/undergraduate-programs.html`,
    meta: "B.E.",
  },
  {
    id: "phd",
    category: "programs",
    title: "Ph.D Research Programme",
    description: "VTU-recognised research centres and doctoral admission process.",
    url: `${GAT}/phd-program.html`,
    meta: "Doctoral",
  },
  {
    id: "placements",
    category: "programs",
    title: "Placements",
    description: "Training & Placement Cell information and recruiter details.",
    url: `${GAT}/placements.html`,
    meta: "T&P Cell",
  },
];
