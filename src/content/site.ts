import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
  name: "Rent Sync",
  tagline: "Run Your Rental Portfolio Without the Spreadsheet Chaos",
  // Single-landlord sale — no public pricing tier; Sign In goes to live dashboard (property-app)
  navLinks: [
    { label: "Features", href: "/features" },
    { label: "FAQs", href: "/faqs" },
  ],
  // Live dashboard URL — dev: Vite on :5173, prod: app.rentsync.co.ke (or your domain)
  // Change to your deployed property-app URL before handing to landlord
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173",
};
