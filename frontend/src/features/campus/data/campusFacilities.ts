/**
 * GAT campus facilities catalogue — DATA SOURCE OF TRUTH.
 *
 * Every entry is transcribed from verified project data:
 *   - data/campus_spatial/*.json  (department_locations, laboratory_locations,
 *     facility_locations, room_locations) — each `verified: true`, with an
 *     `evidence` string citing the panorama signage it was read from
 *   - the `rooms` table (11 rows) exposed by GET /api/v1/rooms
 *   - CLAUDE.md "Content facts to use verbatim" (auditorium 450-seat,
 *     2 seminar halls 90+, hostel with separate blocks, campus bus routes)
 *
 * `panoramaFile` is the Main-Building 360° scene the entity was identified
 * from (e.g. "first-floor/01.jpg"). At runtime the Facilities section
 * resolves it against GET /api/v1/tour/scenes?building_id=6 by matching the
 * scene `image_path` suffix, giving a real node_id for the "Enter 360°" and
 * "Get Directions" actions. When it cannot be resolved, those actions are
 * hidden — never shown broken. Entries WITHOUT a `panoramaFile` are real
 * facilities documented in GAT content but not yet mapped to a captured
 * scene; they show "Ask AI" only.
 *
 * Images are real GAT campus photography from frontend/public/images/ used
 * as illustrative section imagery. Nothing here is fabricated.
 */

export type FacilityCategory =
  | "departments"
  | "laboratories"
  | "library"
  | "auditorium"
  | "administration"
  | "computing"
  | "campus-life";

export interface CampusFacility {
  id: string;
  name: string;
  category: FacilityCategory;
  /** Main Building floor, human label. */
  floor?: string;
  /** Main-Building 360° scene file this entity was identified from. */
  panoramaFile?: string;
  /** Illustrative photo (real GAT photography). */
  image: string;
  description: string;
  /** Pre-filled question for the "Ask AI" action. */
  askAi: string;
  /** Related department id in academicPrograms.ts, when applicable. */
  programmeId?: string;
}

export const FACILITY_CATEGORIES: {
  id: FacilityCategory;
  label: string;
  icon: string;
}[] = [
  { id: "departments", label: "Departments", icon: "building" },
  { id: "laboratories", label: "Laboratories", icon: "flask" },
  { id: "library", label: "Library", icon: "book" },
  { id: "auditorium", label: "Auditorium & Halls", icon: "presentation" },
  { id: "computing", label: "Computing", icon: "cpu" },
  { id: "administration", label: "Administration", icon: "briefcase" },
  { id: "campus-life", label: "Campus Life", icon: "users" },
];

const IMG = (n: number | string) => `/images/${n}`;

export const CAMPUS_FACILITIES: CampusFacility[] = [
  // ---- Departments (Main Building) ----
  {
    id: "dept-cse",
    name: "Department of Computer Science & Engineering",
    category: "departments",
    floor: "First Floor",
    panoramaFile: "first-floor/01.jpg",
    image: IMG("1.png"),
    description:
      "CSE department wing on the first floor — HOD office, staff rooms and classrooms 202, 203, 203A and 213, shared with ISE.",
    askAi: "Tell me about the Computer Science & Engineering department at GAT.",
    programmeId: "cse",
  },
  {
    id: "dept-ise",
    name: "Department of Information Science & Engineering",
    category: "departments",
    floor: "First Floor",
    panoramaFile: "first-floor/15.jpg",
    image: IMG("2.png"),
    description:
      "ISE department area on the first floor with the coordinator/HOD office, ISE Lab and classrooms 207 and 208.",
    askAi: "Tell me about the Information Science & Engineering department at GAT.",
    programmeId: "ise",
  },
  {
    id: "dept-eee",
    name: "Department of Electrical & Electronics Engineering",
    category: "departments",
    floor: "Second Floor",
    panoramaFile: "second-floor/01.jpg",
    image: IMG("3.png"),
    description:
      "EEE department on the second floor with the Measurements & Control Systems Lab and Power System Simulation Lab.",
    askAi: "Tell me about the Electrical & Electronics Engineering department at GAT.",
    programmeId: "eee",
  },
  {
    id: "dept-ece",
    name: "Department of Electronics & Communication Engineering",
    category: "departments",
    floor: "Third Floor",
    panoramaFile: "third-floor/12.jpg",
    image: IMG("4.png"),
    description:
      "ECE department area on the third floor, including staff rooms and room 417B.",
    askAi: "Tell me about the Electronics & Communication Engineering department at GAT.",
    programmeId: "ece",
  },
  {
    id: "dept-aids",
    name: "Artificial Intelligence & Data Science",
    category: "departments",
    floor: "Third Floor",
    panoramaFile: "third-floor/32.jpg",
    image: IMG("5.png"),
    description: "AI & DS programme area on the third floor of the Main Building.",
    askAi: "Tell me about the Artificial Intelligence & Data Science programme at GAT.",
    programmeId: "aids",
  },
  {
    id: "dept-aiml",
    name: "Artificial Intelligence & Machine Learning",
    category: "departments",
    floor: "Ground Floor",
    panoramaFile: "ground-floor/gf_29.jpg",
    image: IMG("6.png"),
    description: "AI & ML programme area on the ground floor of the Main Building.",
    askAi: "Tell me about the Artificial Intelligence & Machine Learning programme at GAT.",
    programmeId: "aiml",
  },

  // ---- Laboratories ----
  {
    id: "lab-alan-turing",
    name: "Alan Turing Lab (Computer Lab-1)",
    category: "laboratories",
    floor: "First Floor",
    panoramaFile: "first-floor/31.jpg",
    image: IMG("7.png"),
    description: "CSE computer laboratory (room 205), one of several labs named after computing pioneers.",
    askAi: "What computer labs does the CSE department at GAT have?",
    programmeId: "cse",
  },
  {
    id: "lab-charles-babbage",
    name: "Charles Babbage Lab",
    category: "laboratories",
    floor: "First Floor",
    panoramaFile: "first-floor/23.jpg",
    image: IMG("8.png"),
    description: "CSE laboratory in room 210 on the first floor.",
    askAi: "Tell me about the computing laboratories at GAT.",
    programmeId: "cse",
  },
  {
    id: "lab-ivan-sutherland",
    name: "Ivan Sutherland Lab",
    category: "laboratories",
    floor: "First Floor",
    panoramaFile: "first-floor/25.jpg",
    image: IMG("9.png"),
    description: "CSE graphics / systems laboratory on the first floor.",
    askAi: "Tell me about the computing laboratories at GAT.",
    programmeId: "cse",
  },
  {
    id: "lab-chemistry",
    name: "Chemistry Lab",
    category: "laboratories",
    floor: "Ground Floor",
    panoramaFile: "ground-floor/gf_15.jpg",
    image: IMG("10.png"),
    description: "Department of Chemistry laboratory (LAB-2, room 112) on the ground floor.",
    askAi: "Where is the Chemistry lab at GAT?",
  },
  {
    id: "lab-electrical-machines",
    name: "Electrical Machines Lab",
    category: "laboratories",
    floor: "Ground Floor",
    panoramaFile: "ground-floor/gf_24.jpg",
    image: IMG("11.png"),
    description: "EEE Electrical Machines Lab (room 110A) on the ground floor.",
    askAi: "Tell me about the EEE laboratories at GAT.",
    programmeId: "eee",
  },
  {
    id: "lab-big-data",
    name: "Big Data Research & Analytics Lab",
    category: "laboratories",
    floor: "Second Floor",
    panoramaFile: "second-floor/29.jpg",
    image: IMG("12.png"),
    description: "CSE Big Data research and analytics laboratory (room 305) on the second floor.",
    askAi: "Tell me about research labs in the CSE department at GAT.",
    programmeId: "cse",
  },
  {
    id: "lab-intel-intelligent-systems",
    name: "Intel Intelligent Systems Lab",
    category: "laboratories",
    floor: "First Floor",
    panoramaFile: "first-floor/32.jpg",
    image: IMG("13.png"),
    description: "CSE (AI & ML) laboratory (room 204) on the first floor.",
    askAi: "Tell me about the AI & ML laboratories at GAT.",
    programmeId: "cse-aiml",
  },

  // ---- Computing ----
  {
    id: "server-room",
    name: "Server Room",
    category: "computing",
    floor: "Ground Floor",
    panoramaFile: "ground-floor/gf_31.jpg",
    image: IMG("14.png"),
    description: "Central server room for campus computing infrastructure.",
    askAi: "What computing infrastructure does GAT have?",
  },
  {
    id: "lab-edsger-dijkstra",
    name: "Edsger Dijkstra Lab / Cloud Lab on AWS",
    category: "computing",
    floor: "First Floor",
    panoramaFile: "first-floor/30.jpg",
    image: IMG("15.jpg"),
    description: "CSE cloud computing laboratory (AWS) on the first floor.",
    askAi: "Does GAT have a cloud computing lab?",
    programmeId: "cse",
  },

  // ---- Auditorium & Halls ----
  {
    id: "auditorium",
    name: "Main Auditorium",
    category: "auditorium",
    image: IMG("campus1.jpg"),
    description:
      "450-seat main auditorium hall used for institutional events, seminars and cultural programmes.",
    askAi: "Tell me about the auditorium at GAT.",
  },
  {
    id: "seminar-halls",
    name: "Seminar Halls",
    category: "auditorium",
    image: IMG("campus2.jpeg"),
    description: "Two seminar halls with 90+ seats each, including the CSE Seminar Hall.",
    askAi: "How many seminar halls does GAT have and what is their capacity?",
  },

  // ---- Library ----
  {
    id: "library-reading-hall",
    name: "Central Library — Reading Hall",
    category: "library",
    image: IMG("campus3.jpg"),
    description: "Main reading hall of the GAT central library.",
    askAi: "Tell me about the library at GAT.",
  },
  {
    id: "library-reference",
    name: "Library — Reference Section",
    category: "library",
    image: IMG("campus4.jpeg"),
    description: "Reference collection and journals section of the central library.",
    askAi: "What resources are available in the GAT library?",
  },

  // ---- Administration ----
  {
    id: "principal-office",
    name: "Principal's Office",
    category: "administration",
    floor: "Ground Floor",
    panoramaFile: "ground-floor/gf_04.jpg",
    image: IMG("16.jpeg"),
    description:
      "Principal's chamber, administrative office and secretary office on the ground floor of the Main Building.",
    askAi: "Where is the Principal's office at GAT?",
  },
  {
    id: "admissions-office",
    name: "Admission Department / Enquiry",
    category: "administration",
    floor: "Ground Floor",
    panoramaFile: "ground-floor/gf_14.jpg",
    image: IMG("1.png"),
    description: "Admissions enquiry and counselling office on the ground floor.",
    askAi: "How do I contact the GAT admissions office?",
  },
  {
    id: "training-placement",
    name: "Training & Placement Cell",
    category: "administration",
    floor: "Third Floor",
    panoramaFile: "third-floor/18.jpg",
    image: IMG("2.png"),
    description: "Training & Placement Cell on the third floor of the Main Building.",
    askAi: "Tell me about placements at GAT.",
  },

  // ---- Campus Life (documented in GAT content; no captured 360° scene) ----
  {
    id: "hostel",
    name: "Hostel",
    category: "campus-life",
    image: IMG("3.png"),
    description: "On-campus hostel with separate blocks for boys and girls.",
    askAi: "Tell me about the hostel facilities at GAT.",
  },
  {
    id: "transport",
    name: "Campus Transport",
    category: "campus-life",
    image: IMG("4.png"),
    description:
      "Institutional bus routes serving Majestic, Shivajinagar, Kengeri and Jayanagar.",
    askAi: "What are the campus bus routes for GAT?",
  },
  {
    id: "sports",
    name: "Sports & Physical Education",
    category: "campus-life",
    floor: "First Floor",
    panoramaFile: "first-floor/15.jpg",
    image: IMG("5.png"),
    description:
      "Physical Education Director's office on the first floor, coordinating campus sports.",
    askAi: "What sports facilities does GAT have?",
  },
];
