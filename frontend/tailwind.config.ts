import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
 content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
  "./app/**/*.{js,ts,jsx,tsx,mdx}",
  "./components/**/*.{js,ts,jsx,tsx,mdx}",
],
  theme: {
    extend: {
      borderRadius: {
  xl: "1rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  full: "9999px",
},
      colors: {
        // Official GAT brand palette — do not add other blue shades here.
        brand: {
          DEFAULT: "#2344D4",
          dark: "#1B36AE",
        },
        // These four resolve through CSS variables (see globals.css) so they
        // automatically flip between light/dark — do not hardcode hex here.
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        hairline: "rgb(var(--color-hairline) / <alpha-value>)",
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
  soft:
    "0 2px 8px -2px rgba(22,33,62,0.06), 0 16px 36px -16px rgba(35,68,212,0.16)",

  glow:
    "0 0 0 1px rgba(35,68,212,0.15), 0 18px 44px -14px rgba(35,68,212,0.30)",

  hero:
    "0 35px 80px rgba(35,68,212,0.18)",

  navbar:
    "0 12px 35px rgba(15,23,42,0.08)",
},
      keyframes: {
  "fade-in-up": {
    "0%": {
      opacity: "0",
      transform: "translateY(16px)",
    },
    "100%": {
      opacity: "1",
      transform: "translateY(0)",
    },
  },

  float: {
    "0%,100%": {
      transform: "translateY(0px)",
    },
    "50%": {
      transform: "translateY(-8px)",
    },
  },
      },
      animation: {
  "fade-in-up": "fade-in-up 0.6s ease-out both",
  float: "float 6s ease-in-out infinite",
},
    },
  },
  plugins: [],
};

export default config;
