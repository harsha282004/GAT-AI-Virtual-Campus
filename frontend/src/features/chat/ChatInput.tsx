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
      className="flex items-center gap-2 rounded-2xl border border-hairline bg-white p-2"
    >
      <button
        type="button"
        disabled
        title="Voice input arrives in a future phase"
        aria-label="Voice input (coming soon)"
        className="flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl text-ink/25"
      >
        <Mic className="h-4 w-4" />
      </button>

      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask about admissions, academics, facilities…"
        className="flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-muted focus:outline-none"
      />

      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}
