"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@/hooks";
import { useChatStore } from "@/store";

import { ChatWindow } from "./ChatWindow";

// Pages with their own already-crowded floating UI (Virtual Tour's
// minimap/controls/immersive-toggle) or that already show the full chat
// (the /chat page itself) — the bubble would either duplicate or visually
// collide with existing chrome there, so it's hidden on those routes
// rather than stacked on top.
const HIDDEN_ON_PREFIXES = ["/chat", "/tour"];

/** Site-wide floating AI entry point — a persistent bubble (bottom-left,
 * every page except the ones above) that opens a compact chat panel
 * without navigating away, the same UX pattern as WhatsApp's Meta AI
 * circle. Reuses the exact same ChatWindow/RAG pipeline/chat store as the
 * full /chat page — this is an additional entry point, not a second
 * chatbot, so a conversation started here continues seamlessly if the
 * user later opens /chat (same persisted session/messages). */
export function FloatingAssistant() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAssistantTyping = useChatStore((state) => state.isAssistantTyping);

  const hidden = HIDDEN_ON_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (hidden) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-3 sm:bottom-6 sm:left-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="h-[70vh] max-h-[560px] w-[92vw] max-w-[380px]"
          >
            <ChatWindow className="h-full" onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        whileTap={{ scale: 0.92 }}
        aria-label={t("Chat with GAT Assistant")}
        title={t("Chat with GAT Assistant")}
        aria-expanded={open}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow transition-transform hover:-translate-y-0.5"
      >
        {isAssistantTyping && !open && (
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/50" />
        )}
        <Sparkles className="relative h-6 w-6" />
      </motion.button>
    </div>
  );
}
