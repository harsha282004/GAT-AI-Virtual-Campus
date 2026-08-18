"use client";

import { useCallback } from "react";

import { translate } from "@/lib/i18n/translations";
import { useLanguageStore } from "@/store/languageStore";

/** `t(text)` looks `text` (the literal English source string) up in the
 * selected language's dictionary — see lib/i18n/translations.ts for why
 * there's no separate English dictionary and how missing keys fall back. */
export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const t = useCallback((text: string) => translate(language, text), [language]);
  return { t, language };
}
