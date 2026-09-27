import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
  name: "Rent Sync",
  tagline: "Run Your Rental Portfolio Without the Spreadsheet Chaos",
  // Sign In goes to the live dashboard (property-app). Public pricing is published
  // in src/content/pricing.ts, so enterprise enquiries route through contact.ts.
  navLinks: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQs", href: "/faqs" },
  ],
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://app.rentsync.africa"
      : "http://localhost:5173"),
};
