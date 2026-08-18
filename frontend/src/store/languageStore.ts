import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppLanguage = "en" | "kn" | "hi";

interface LanguageState {
  language: AppLanguage;
  /** Transient (not persisted) — lets the Home page's "Multi-language
   * Support" card (Features.tsx) open the navbar's LanguageSwitcher
   * dropdown without a dedicated language-selection page/route. */
  isPickerOpen: boolean;
  setLanguage: (language: AppLanguage) => void;
  openPicker: () => void;
  closePicker: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "en",
      isPickerOpen: false,
      setLanguage: (language) => set({ language }),
      openPicker: () => set({ isPickerOpen: true }),
      closePicker: () => set({ isPickerOpen: false }),
    }),
    {
      name: "gat-language",
      partialize: (state) => ({ language: state.language }),
    },
  ),
);
