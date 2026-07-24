export type DocumentDomain =
  | "admissions"
  | "academics"
  | "facilities"
  | "navigation"
  | "general";

export interface CampusDocument {
  id: number;
  campus_id: number | null;
  title: string;
  content: string;
  domain: DocumentDomain;
  source: string | null;
  created_at: string;
  updated_at: string;
}
