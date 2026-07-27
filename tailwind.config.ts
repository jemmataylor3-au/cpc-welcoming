import type { Config } from "tailwindcss";

// Design tokens from the Charlestown Presbyterian Church Style Guide
// (August 2023, v1.1). Tagline: "Gospel Truth. God's Love. Real Change."
//
// Accessibility note carried over from the brand guide: green (#5DBE80)
// and teal (#67BAB4) are mid-tone. White text on either fails WCAG AA for
// body copy, so those two are used as backgrounds with navy/ink text, or
// as small accents only — never as a background for white body text.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Primary palette ---
        ink: "#0E1F27",
        navy: "#103349",
        moss: "#53796E",
        green: "#5DBE80",
        teal: "#67BAB4",
        // --- Alternate palette (backgrounds / bridging tones) ---
        sand: "#F1E0D8",
        clay: "#ECBEB4",
        mauve: "#AC8691",
        orchid: "#CC9DBD",
        wine: "#98454B",

        // --- Semantic roles used throughout the app ---
        primary: "#103349", // navy — nav, headers, primary buttons
        secondary: "#F1E0D8", // sand — warm surfaces, tags
        accent: "#5DBE80", // green — highlights, CTAs (navy text on it)
        sage: "#67BAB4", // teal — secondary highlights
        background: "#FDF9F7", // light sand tint — page background
        surface: "#FFFFFF",
        textPrimary: "#103349", // navy, per guide's text-on-light
        textSecondary: "#53796E", // moss — passes AA on white (~4.9:1)
        border: "#E7DED9",

        // --- System feedback (guide permits colours for system feedback) ---
        success: "#5DBE80", // brand green
        warning: "#C28A45",
        error: "#98454B", // brand wine
      },
      fontFamily: {
        // Two faces only, per the guide's max-two-fonts rule.
        // League Spartan covers headings and UI chrome (buttons, labels,
        // nav); Merriweather carries body prose.
        display: ["var(--font-league-spartan)", "Helvetica Neue", "Arial", "sans-serif"],
        sans: ["var(--font-league-spartan)", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["var(--font-merriweather)", "Georgia", "serif"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "44px", fontWeight: "700" }],
        h1: ["32px", { lineHeight: "38px", fontWeight: "700" }],
        h2: ["26px", { lineHeight: "32px", fontWeight: "700" }],
        h3: ["20px", { lineHeight: "26px", fontWeight: "600" }],
        h4: ["17px", { lineHeight: "23px", fontWeight: "600" }],
        bodyLg: ["17px", { lineHeight: "27px", fontWeight: "400" }],
        body: ["15px", { lineHeight: "24px", fontWeight: "400" }],
        small: ["13px", { lineHeight: "19px", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      letterSpacing: {
        eyebrow: "0.18em", // the "PRESBYTERIAN CHURCH" spaced-caps treatment
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
        card: "0 2px 8px rgba(16, 51, 73, 0.07)",
      },
      spacing: {
        4.5: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
