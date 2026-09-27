import type { Feature } from "@/types";

/**
 * Every claim here must be something the app actually does today. The product
 * deliberately ships no SMS/WhatsApp layer, no reminder sender, no receipt
 * generation, and no occupancy metric — so do not describe them here.
 * See docs/PLAN.md Section 11.6 (SMS removed) and 11.4 (PayHero, inbound only).
 */
export const features: Feature[] = [
  {
    icon: "receipt",
    title: "Automated Monthly Invoicing",
    description:
      "Next month's rent is billed to every active tenant automatically, dated from the rent-due day you set per property. The platform runs this for you, and a missed run catches up on the next one rather than skipping rent.",
  },
  {
    icon: "zap",
    title: "Payments Matched Automatically",
    description:
      "Register your M-Pesa paybill, till, or bank account and incoming payments are matched to the right tenant and invoice the moment they clear.",
  },
  {
    icon: "bar-chart",
    title: "Arrears & Collection Reports",
    description:
      "Arrears by property, collection rate across 12 months, and a per-tenant statement with a running balance — all exportable as CSV.",
  },
  {
    icon: "users",
    title: "Digital Tenant Records",
    description:
      "Lease start and end, unit, phone, and the full payment history in one profile — searchable across every building you manage.",
  },
  {
    icon: "building",
    title: "Multi-Property Dashboard",
    description:
      "Every building, unit, tenant, invoice, and payment behind one login, with your records scoped to your own account and no one else's.",
  },
  {
    icon: "wrench",
    title: "Maintenance Request Tracking",
    description:
      "Log a repair against a unit, move it from open to in progress to resolved, and get flagged when an urgent job starts dragging.",
  },
];
