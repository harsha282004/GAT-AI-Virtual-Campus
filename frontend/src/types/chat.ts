export type ChatRole = "user" | "assistant";

export interface ChatSource {
  label: string;
  domain: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  sources?: ChatSource[];
  pending?: boolean;
}
