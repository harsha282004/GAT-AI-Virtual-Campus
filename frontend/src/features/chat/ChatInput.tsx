"use client";

import { Mic, SendHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-2xl border border-gat-navy/15 bg-white p-2 dark:border-white/15 dark:bg-gat-navy-light"
    >
      <button
        type="button"
        disabled
        title="Voice input arrives in a future phase"
        aria-label="Voice input (coming soon)"
        className="flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl text-gat-navy/30 dark:text-white/30"
      >
        <Mic className="h-4 w-4" />
      </button>

      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask about admissions, academics, facilities…"
        className="flex-1 bg-transparent px-1 text-sm text-gat-navy placeholder:text-gat-navy/40 focus:outline-none dark:text-white dark:placeholder:text-white/40"
      />

      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gat-maroon text-white transition-colors hover:bg-gat-maroon-light disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}
