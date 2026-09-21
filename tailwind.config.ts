import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/content/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        burgundy: {
          50: "#F7E9EB",
          600: "#7A1428",
          700: "#5C0F1F",
        },
        ink: "#0D0D0D",
        gray: {
          100: "#F5F5F5",
          500: "#6B6B6B",
          900: "#1A1A1A",
        },
        background: "#FFFFFF",
        foreground: "#1A1A1A",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      fontSize: {
        // Type scale — heading + body
        "h1": ["3rem", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }], // 48px
        "h2": ["2.25rem", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.015em" }], // 36px
        "h3": ["1.5rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }], // 24px
        "h4": ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }], // 20px
        "body": ["1rem", { lineHeight: "1.7", fontWeight: "400" }], // 16px
        "body-lg": ["1.125rem", { lineHeight: "1.7", fontWeight: "400" }], // 18px
        "small": ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }], // 14px
        "xs": ["0.75rem", { lineHeight: "1.5", fontWeight: "500", letterSpacing: "0.04em" }], // 12px
      },
      borderRadius: {
        "sm": "6px",
        "DEFAULT": "8px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
        "2xl": "20px",
        "full": "9999px",
      },
      boxShadow: {
        "soft": "0 2px 10px rgba(13, 13, 13, 0.06)",
        "card": "0 4px 24px rgba(13, 13, 13, 0.06)",
        "card-hover": "0 8px 32px rgba(13, 13, 13, 0.10)",
        "cta": "0 4px 14px rgba(122, 20, 40, 0.25)",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      maxWidth: {
        "content": "72rem", // 1152px — matches 1280 - gutters
      },
    },
  },
  plugins: [],
};

export default config;
