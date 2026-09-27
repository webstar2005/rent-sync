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

/**
 * Real, publishable testimonials only — with the client's permission to use the
 * name. Never invent quotes to fill a slot (docs/PLAN.md Section 4, row 6).
 * The shape is kept here so `src/content/testimonials.ts` and a
 * `components/sections/Testimonials.tsx` can be reintroduced the moment genuine
 * quotes exist; the fabricated set that used to sit in the repo was deleted
 * rather than shipped.
 */
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
