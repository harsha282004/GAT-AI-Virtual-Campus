"use client";

import { motion } from "framer-motion";
import {
  Building2,
  DoorOpen,
  GraduationCap,
  Landmark,
  LayoutGrid,
  Library,
  MapPinned,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import { Card } from "@/components/ui";
import { useChatConversation } from "@/hooks";

interface SuggestedQuestion {
  icon: ComponentType<{ className?: string }>;
  label: string;
}

// Prompts only — these are not pre-written answers. Clicking one sends it
// through the exact same useChatConversation().sendMessage() path typed
// questions use, so every answer still comes from the existing RAG/chat
// backend (Section 2).
const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { icon: DoorOpen, label: "Where is Room 101 (C103)?" },
  { icon: Building2, label: "Where is the CSE Department?" },
  { icon: Users, label: "Who is the HOD of CSE?" },
  { icon: Library, label: "Where is the Library?" },
  { icon: Landmark, label: "Where is the Auditorium?" },
  { icon: Building2, label: "Where is the Admin Block?" },
  { icon: Building2, label: "Where is the CSE Block?" },
  { icon: MapPinned, label: "How can I reach a particular room?" },
  { icon: LayoutGrid, label: "What facilities are available on campus?" },
  { icon: GraduationCap, label: "Where is the Main Building?" },
];

export function SuggestedQuestions() {
  const { sendMessage, isAssistantTyping } = useChatConversation();

  return (
    <Card className="flex h-fit flex-col gap-1">
      <p className="font-display text-sm font-semibold text-ink">Suggested Questions</p>
      <p className="mb-3 text-xs text-muted">Tap a question to ask the GAT Assistant</p>

      <div className="flex flex-col gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <motion.button
            key={question.label}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => sendMessage(question.label)}
            disabled={isAssistantTyping}
            className="flex items-center gap-2.5 rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-left text-sm text-ink/80 transition-colors hover:border-brand hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0F172A]"
          >
            <question.icon className="h-4 w-4 shrink-0 text-brand" />
            {question.label}
          </motion.button>
        ))}
      </div>
    </Card>
  );
}
