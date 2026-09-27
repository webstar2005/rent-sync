import type { PricingTier } from "@/types";

export const pricingTiers: PricingTier[] = [
  {
    id: "basic",
    name: "Basic",
    price: "KES 2,000",
    billingUnit: "/month",
    description: "For landlords running 5–20 units.",
    features: [
      "Up to 20 units",
      "Automated monthly invoicing",
      "Tenant records & lease terms",
      "M-Pesa and bank payment matching",
      "Arrears reporting",
    ],
    ctaLabel: "Get Started",
  },
  {
    id: "standard",
    name: "Standard",
    price: "KES 4,000",
    billingUnit: "/month",
    description: "For portfolios of 21–50 units.",
    features: [
      "Up to 50 units",
      "Everything in Basic",
      "Collection rate reporting (12 months)",
      "CSV statement exports",
      "Maintenance request tracking",
    ],
    ctaLabel: "Get Started",
    highlighted: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "KES 6,500",
    billingUnit: "/month",
    description: "For managers handling 51–100 units.",
    features: [
      "Up to 100 units",
      "Everything in Standard",
      "Per-tenant statements with running balance",
      "Unmatched payment reconciliation queue",
      "Priority support",
    ],
    ctaLabel: "Get Started",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    billingUnit: "",
    description: "For 100+ units and estates.",
    features: [
      "Unlimited units",
      "Everything in Premium",
      "Bulk tenant import to migrate your portfolio",
      "Dedicated onboarding",
      "Custom payment channel setup",
      "Service-level agreement",
    ],
    ctaLabel: "Contact Us",
  },
];

export const pricingFootnote =
  "Plans differ in two things: how many units you can manage, and which features you get. " +
  "Units are counted from what you declare on each property, so one 50-unit block counts as 50 " +
  "units. Fewer than 5 units? Get in touch and we will price it for you.";
