import type { Config } from "tailwindcss";

// Design tokens sourced from the CPC App Brand System document.
// Do not introduce additional colours/fonts without updating that source of truth.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#172B3A", // Deep Navy
        secondary: "#E8DED0", // Warm Sand
        accent: "#C8755B", // Muted Terracotta
        sage: "#A7B5A0", // Soft Sage
        background: "#FAF9F6", // Warm White
        surface: "#FFFFFF",
        textPrimary: "#263238", // Charcoal
        textSecondary: "#66727A", // Slate
        border: "#E4E2DD", // Soft Grey
        success: "#5E8065",
        warning: "#C28A45",
        error: "#B85C5C",
      },
      fontFamily: {
        display: ["var(--font-dm-serif)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "44px", fontWeight: "400" }],
        h1: ["32px", { lineHeight: "38px", fontWeight: "400" }],
        h2: ["26px", { lineHeight: "32px", fontWeight: "400" }],
        h3: ["20px", { lineHeight: "26px", fontWeight: "600" }],
        h4: ["17px", { lineHeight: "23px", fontWeight: "600" }],
        bodyLg: ["17px", { lineHeight: "26px", fontWeight: "400" }],
        body: ["15px", { lineHeight: "23px", fontWeight: "400" }],
        small: ["13px", { lineHeight: "18px", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "6px",
        input: "8px",
        button: "10px",
        card: "14px",
        feature: "18px",
        sheet: "20px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(23, 43, 58, 0.06)",
      },
      spacing: {
        4.5: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
