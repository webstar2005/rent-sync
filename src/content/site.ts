import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
  name: "Rent Sync",
  tagline: "Run Your Rental Portfolio Without the Spreadsheet Chaos",
  // Single-landlord sale — no public pricing tier; Sign In goes to live dashboard (property-app)
  navLinks: [
    { label: "Features", href: "/features" },
    { label: "FAQs", href: "/faqs" },
  ],
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://app.rentsync.africa"
      : "http://localhost:5173"),
};
