export type ChatRole = "user" | "assistant";

export interface ChatSource {
  label: string;
  domain: string;
}

export interface ChatNavigationInfo {
  from_label: string;
  to_label: string;
  total_distance: number;
  estimated_walk_time_minutes: number;
  is_accessible: boolean;
  turn_by_turn: string[];
}

export interface ChatPanoramaInfo {
  node_id: number;
  title: string | null;
  image_path: string;
  distance: number | null;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  sources?: ChatSource[];
  pending?: boolean;
  navigation?: ChatNavigationInfo | null;
  panorama?: ChatPanoramaInfo | null;
  error?: boolean;
}

// --- POST /api/v1/chat contract (Phase 7) — field names match the
// backend's ChatRequest/ChatResponse schemas exactly, same convention as
// every other file in this directory. ---

export interface ChatApiRequest {
  message: string;
  session_id?: string | null;
}

export interface ChatApiSource {
  title: string | null;
  source_url: string | null;
  page: number | null;
}

export interface ChatApiResponse {
  answer: string;
  status: string;
  confidence: number;
  confidence_level: string;
  selected_agent: string;
  tool_used: string | null;
  sources: ChatApiSource[];
  navigation: ChatNavigationInfo | null;
  panorama: ChatPanoramaInfo | null;
  session_id: string | null;
}
