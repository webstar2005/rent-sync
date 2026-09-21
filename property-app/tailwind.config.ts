import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        burgundy: { 50: "#F7E9EB", 600: "#7A1428", 700: "#5C0F1F" },
        ink: "#0D0D0D",
        gray: { 100: "#F5F5F5", 500: "#6B6B6B", 900: "#1A1A1A" },
        background: "#FFFFFF",
        foreground: "#1A1A1A",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      fontSize: {
        h1: ["3rem", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        h2: ["2.25rem", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.015em" }],
        h3: ["1.5rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        h4: ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.7", fontWeight: "400" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7", fontWeight: "400" }],
        small: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        xs: ["0.75rem", { lineHeight: "1.5", fontWeight: "500", letterSpacing: "0.04em" }],
      },
      borderRadius: { sm: "6px", DEFAULT: "8px", md: "8px", lg: "12px", xl: "16px", "2xl": "20px", full: "9999px" },
      boxShadow: {
        soft: "0 2px 10px rgba(13, 13, 13, 0.06)",
        card: "0 4px 24px rgba(13, 13, 13, 0.06)",
        "card-hover": "0 8px 32px rgba(13, 13, 13, 0.10)",
        cta: "0 4px 14px rgba(122, 20, 40, 0.25)",
      },
      maxWidth: { content: "72rem" },
    },
  },
  plugins: [],
};
export default config;
