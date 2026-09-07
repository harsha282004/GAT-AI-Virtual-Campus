/**
 * GAT academic programme catalogue — DATA SOURCE OF TRUTH.
 *
 * Every field here is transcribed from official GAT sources already present
 * in this project:
 *   - department / programme pages crawled into data/raw/website/
 *     (all verified HTTP 200 during the Phase 0 audit)
 *   - scheme & syllabus PDF links found in the <a href> of those same pages
 *   - department names as tagged in data/processed/chunks.jsonl `department`
 *
 * There is NO structured per-semester subject / course-code / credit data
 * anywhere in the project (verified: the AI itself refuses "subjects in 3rd
 * year ISE"). So this catalogue deliberately stops at
 * department -> scheme year -> official syllabus document. It never invents
 * subject lists.
 *
 * `officialPage` is always a real HTTP 200 page that itself hosts the
 * scheme/syllabus links, so it is the ONLY destination the UI navigates to
 * for scheme & syllabus. Several direct PDF URLs under `SchemeDoc.url`
 * (notably `/documents/cs/*Syllabus.pdf`) return an S3 "AccessDenied" XML
 * error when opened directly, so those URLs are retained here only as
 * reference to the known file locations — they are NOT used as click
 * targets. Brochure PDFs were verified browser-accessible (HTTP 200).
 */

const GAT = "https://www.gat.ac.in";

export type ProgrammeLevel = "UG" | "PG" | "Doctoral";

export interface SchemeDoc {
  /** VTU / autonomous scheme year, e.g. "2024". "Current" is used when the
   * source page does not label the scheme by year. */
  year: string;
  /** Direct link to the official scheme & syllabus PDF, when one is listed
   * on the department page. Undefined -> use `officialPage`. */
  url?: string;
}

export interface AcademicProgramme {
  id: string;
  /** Short department code used for the selector chips. */
  code: string;
  name: string;
  level: ProgrammeLevel;
  /** Official department / programme page (always HTTP 200). */
  officialPage: string;
  /** Official department brochure PDF, when listed. */
  brochure?: string;
  /** Scheme & syllabus documents listed on the official page, newest first. */
  schemes: SchemeDoc[];
  /** One-line description, paraphrased from the official page's vision text.
   * Kept factual and generic; no fabricated specifics. */
  blurb: string;
}

export const ACADEMIC_PROGRAMMES: AcademicProgramme[] = [
  {
    id: "cse",
    code: "CSE",
    name: "Computer Science & Engineering",
    level: "UG",
    officialPage: `${GAT}/computer-science-engineering.html`,
    brochure: `${GAT}/documents/CSE_Brochure.pdf`,
    schemes: [
      { year: "2025", url: `${GAT}/documents/cs/25Syllabus.pdf` },
      { year: "2024", url: `${GAT}/documents/cs/24Syllabus.pdf` },
      { year: "2023", url: `${GAT}/documents/cs/23Syllabus.pdf` },
      { year: "2022", url: `${GAT}/documents/cs/22Syllabus.pdf` },
    ],
    blurb:
      "Core computing programme covering software engineering, systems, data and AI, with lab facilities named after computing pioneers.",
  },
  {
    id: "ise",
    code: "ISE",
    name: "Information Science & Engineering",
    level: "UG",
    officialPage: `${GAT}/information-science-engineering.html`,
    brochure: `${GAT}/documents/ISE_Brochure.pdf`,
    schemes: [{ year: "2024", url: `${GAT}/documents/2024-25_Batch_Scheme.pdf` }],
    blurb:
      "Information systems, data engineering and applied software development, based on the first floor of the Main Building.",
  },
  {
    id: "cse-aiml",
    code: "CSE (AI & ML)",
    name: "Computer Science & Engineering (AI & ML)",
    level: "UG",
    officialPage: `${GAT}/computer-science-engineering-ai-ml.html`,
    brochure: `${GAT}/documents/CSE_AIML_BROCHURE.pdf`,
    schemes: [
      { year: "2024", url: `${GAT}/documents/cs_ai_ml/2024 scheme & syllabus.pdf` },
      { year: "2023", url: `${GAT}/documents/cs_ai_ml/2023 scheme syllabus 2 1.pdf` },
      { year: "2022", url: `${GAT}/documents/cs_ai_ml/2022 scheme and syllabus.pdf` },
    ],
    blurb:
      "CSE degree with an artificial-intelligence and machine-learning specialisation track.",
  },
  {
    id: "aiml",
    code: "AI & ML",
    name: "Artificial Intelligence & Machine Learning",
    level: "UG",
    officialPage: `${GAT}/artificial-intelligence-machine-learning.html`,
    schemes: [
      { year: "2024", url: `${GAT}/documents/ai_ml/AIML_ Syllabus 2024 (3-8 Sem).pdf` },
      { year: "2023", url: `${GAT}/documents/ai_ml/AIML_2023 Scheme & Syllabus (3-7 Sem).pdf` },
      { year: "2022", url: `${GAT}/documents/ai_ml/AIML_2022 Scheme & Syllabus.pdf` },
    ],
    blurb: "Dedicated AI & ML engineering programme covering intelligent systems and data.",
  },
  {
    id: "aids",
    code: "AI & DS",
    name: "Artificial Intelligence & Data Science",
    level: "UG",
    officialPage: `${GAT}/artificial-intelligence-data-science.html`,
    schemes: [
      { year: "2024", url: `${GAT}/documents/AI&DS Scheme and syllabus 2024.pdf` },
      { year: "2023", url: `${GAT}/documents/AI&DS Scheme and syllabus 2023.pdf` },
    ],
    blurb: "Data science and AI engineering, located on the third floor of the Main Building.",
  },
  {
    id: "ece",
    code: "ECE",
    name: "Electronics & Communication Engineering",
    level: "UG",
    officialPage: `${GAT}/electronics-communication-engineering.html`,
    brochure: `${GAT}/documents/ECE_Brochure.pdf`,
    schemes: [{ year: "2023", url: `${GAT}/documents/ece2023.pdf` }],
    blurb:
      "Electronics, embedded systems, signal processing and communication engineering.",
  },
  {
    id: "eee",
    code: "EEE",
    name: "Electrical & Electronics Engineering",
    level: "UG",
    officialPage: `${GAT}/electrical-electronics-engineering.html`,
    brochure: `${GAT}/documents/EEE-Brochure.pdf`,
    schemes: [
      { year: "2023", url: `${GAT}/documents/2023_BATCH_I_to_VIII_Sem_SCHEME_1.pdf` },
    ],
    blurb:
      "Power systems, control, machines and electronics — with lab facilities on the second floor.",
  },
  {
    id: "mech",
    code: "MECH",
    name: "Mechanical Engineering",
    level: "UG",
    officialPage: `${GAT}/mechanical-engineering.html`,
    schemes: [
      { year: "2023", url: `${GAT}/documents/Approved_1st_to_8th_Semester_Scheme_2023.pdf` },
    ],
    blurb: "Design, thermal, manufacturing and materials engineering.",
  },
  {
    id: "civil",
    code: "CIVIL",
    name: "Civil Engineering",
    level: "UG",
    officialPage: `${GAT}/civil-engineering.html`,
    brochure: `${GAT}/documents/Civil_Brochure.pdf`,
    schemes: [{ year: "Current" }],
    blurb: "Structures, geotechnical, transportation, water resources and construction.",
  },
  {
    id: "aero",
    code: "AERO",
    name: "Aeronautical Engineering",
    level: "UG",
    officialPage: `${GAT}/aeronautical-engineering.html`,
    brochure: `${GAT}/documents/Aero_Brochure.pdf`,
    schemes: [{ year: "Current" }],
    blurb: "Aerodynamics, propulsion, structures and aircraft systems.",
  },
  {
    id: "mba",
    code: "MBA",
    name: "Master of Business Administration",
    level: "PG",
    officialPage: `${GAT}/master-of-business-administration.html`,
    schemes: [{ year: "Current" }],
    blurb: "Two-year postgraduate management programme.",
  },
  {
    id: "mtech-cse",
    code: "M.Tech CSE",
    name: "M.Tech — Computer Science & Engineering",
    level: "PG",
    officialPage: `${GAT}/master-of-computer-science-and-engineering.html`,
    schemes: [{ year: "Current", url: `${GAT}/documents/Masters of Computer Science Engg.pdf` }],
    blurb: "Postgraduate specialisation in advanced computer science.",
  },
  {
    id: "mtech-struct",
    code: "M.Tech Struct.",
    name: "M.Tech — Structural Engineering",
    level: "PG",
    officialPage: `${GAT}/master-of-structural-engineering.html`,
    schemes: [{ year: "Current", url: `${GAT}/documents/Masters of Structural Engg.pdf` }],
    blurb: "Postgraduate specialisation in structural and earthquake engineering.",
  },
  {
    id: "phd",
    code: "Ph.D",
    name: "Doctoral Research Programmes",
    level: "Doctoral",
    officialPage: `${GAT}/phd-program.html`,
    schemes: [{ year: "Current" }],
    blurb: "VTU-recognised research centres across engineering and management departments.",
  },
];

export const PROGRAMME_LEVELS: { id: ProgrammeLevel; label: string }[] = [
  { id: "UG", label: "Undergraduate" },
  { id: "PG", label: "Postgraduate" },
  { id: "Doctoral", label: "Doctoral" },
];
