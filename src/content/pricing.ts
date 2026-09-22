import type { PricingTier } from "@/types";

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    price: "KES 2,500",
    billingUnit: "/month",
    description: "For landlords with 1–10 units.",
    features: ["Up to 10 units", "Rent reminders & collection", "Tenant records", "Invoices & receipts"],
    ctaLabel: "Start Free",
  },
  {
    name: "Growth",
    price: "KES 6,000",
    billingUnit: "/month",
    description: "For growing portfolios, 11–50 units.",
    features: [
      "Up to 50 units",
      "Everything in Starter",
      "Financial reports & exports",
      "Multi-property dashboard",
    ],
    ctaLabel: "Start Free",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "KES 15,000",
    billingUnit: "/month",
    description: "For 51–150 units with advanced needs.",
    features: [
      "Up to 150 units",
      "Everything in Growth",
      "Role-based access",
      "Maintenance request tracking",
      "Priority support",
    ],
    ctaLabel: "Start Free",
  },
  {
    name: "Enterprise",
    price: "Custom",
    billingUnit: "",
    description: "For 150+ units. Tailored to your operations.",
    features: ["Unlimited units", "Custom integrations", "Dedicated support", "SLA & onboarding"],
    ctaLabel: "Get Started",
  },
];
