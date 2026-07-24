"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-purple/12 text-accent-purple">
        <Bot className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-brand/5 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
            className="h-1.5 w-1.5 rounded-full bg-brand/50"
          />
        ))}
      </div>
    </div>
  );
}
