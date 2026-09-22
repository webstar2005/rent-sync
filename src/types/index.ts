/**
 * Content data shapes — data-driven site (docs/PLAN.md Section 5)
 * Components read from src/content/*.ts rather than hardcoding copy inline.
 */

export type Feature = {
  icon: string;
  title: string;
  description: string;
  audience?: string;
};

export type PricingTier = {
  name: string;
  price: string;
  billingUnit: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

export type Testimonial = {
  quote: string;
  name: string;
  role?: string;
  company?: string;
  rating?: number;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type SiteConfig = {
  name: string;
  tagline: string;
  navLinks: { label: string; href: string }[];
  stats?: { label: string; value: string }[];
  appUrl?: string;
};
