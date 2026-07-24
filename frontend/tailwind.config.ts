import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gat: {
          navy: {
            DEFAULT: "#0b1e3d",
            light: "#13294e",
            dark: "#071328",
          },
          maroon: {
            DEFAULT: "#7a1f2b",
            light: "#9b2b3a",
            dark: "#551620",
          },
          gold: {
            DEFAULT: "#d4af37",
            light: "#e6c568",
            dark: "#a9862a",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gat-hero": "radial-gradient(120% 120% at 50% 0%, #13294e 0%, #0b1e3d 45%, #071328 100%)",
        "gat-cta": "linear-gradient(135deg, #7a1f2b 0%, #551620 100%)",
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(212,175,55,0.35), 0 8px 30px -8px rgba(212,175,55,0.35)",
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
