import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Official GAT brand palette — do not add other blue shades here.
        brand: {
          DEFAULT: "#2344D4",
          dark: "#1B36AE",
        },
        canvas: "#F7FBFF",
        ink: "#16213E",
        muted: "#5D6E84",
        hairline: "#E7EEF8",
        // Feature-card accent colors only — the rest of the UI stays brand-blue.
        accent: {
          purple: "#7C6FEB",
          orange: "#F59E42",
          green: "#22B573",
          pink: "#F472B6",
          gold: "#D4A537",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-overlay":
          "linear-gradient(180deg, rgba(247,251,255,0.10) 0%, rgba(247,251,255,0.55) 60%, #F7FBFF 100%)",
        "brand-gradient": "linear-gradient(135deg, #2344D4 0%, #1B36AE 100%)",
        "canvas-gradient": "linear-gradient(180deg, #F7FBFF 0%, #EAF1FF 100%)",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(22,33,62,0.06), 0 16px 36px -16px rgba(35,68,212,0.16)",
        glow: "0 0 0 1px rgba(35,68,212,0.15), 0 18px 44px -14px rgba(35,68,212,0.30)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
