"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import type { AppLanguage } from "@/store/languageStore";
import { useLanguageStore } from "@/store/languageStore";
import { cn } from "@/utils";

const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "hi", label: "हिन्दी" },
];

/** Navbar "Language" item — a small popover, not a page (Requirement 3).
 * Reads/writes the shared languageStore so Features.tsx's "Multi-language
 * Support" card can open this same dropdown (isPickerOpen) without a
 * second implementation. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const isOpen = useLanguageStore((state) => state.isPickerOpen);
  const openPicker = useLanguageStore((state) => state.openPicker);
  const closePicker = useLanguageStore((state) => state.closePicker);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePicker();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen, closePicker]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? closePicker() : openPicker())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "relative flex items-center gap-1.5 px-4 py-2 text-[16px] font-medium text-[#2E4DB7] transition-colors duration-300 hover:text-[#2E4DB7] dark:text-[#5B8CFF] dark:hover:text-[#5B8CFF]",
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="relative z-10">{t("Language")}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute left-1/2 top-full z-50 mt-2 w-40 -translate-x-1/2 rounded-2xl border border-hairline bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95"
          >
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.code === language;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setLanguage(option.code);
                    closePicker();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    selected
                      ? "bg-[#2E4DB7]/10 text-[#2E4DB7] dark:bg-[#5B8CFF]/10 dark:text-[#5B8CFF]"
                      : "text-slate-700 hover:bg-[#2E4DB7]/5 dark:text-slate-300 dark:hover:bg-[#5B8CFF]/10",
                  )}
                >
                  {option.label}
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
