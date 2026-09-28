import type { Metadata } from "next";
import { contact } from "@/content/contact";
import { pricingTiers } from "@/content/pricing";
import { siteConfig } from "@/content/site";

export const SITE_URL = "https://rentsync.africa";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Builds the metadata every page used to write out by hand.
 *
 * Two things this fixes. The root layout sets a title template of "%s | Rent Sync", and each page
 * also put " - Rent Sync" in its own title, so every one of them rendered "Features - Rent Sync |
 * Rent Sync" in the search results. Titles passed here are the bare page name and the template
 * supplies the brand once. Second, canonical, Open Graph and Twitter were duplicated per page and
 * had already drifted out of sync with each other.
 *
 * Keep titles under roughly 60 characters and descriptions under 160, or search engines truncate them.
 */
export function pageMetadata({
  title,
  description,
  path,
  imageAlt,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  imageAlt: string;
  /** For pages that should stay out of the index, e.g. legal copy that is deliberately noindex. */
  noindex?: boolean;
}): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const ogImage = {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: imageAlt,
  };

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_KE",
      siteName: siteConfig.name,
      url,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: siteConfig.name,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    "Property management software for Kenyan landlords: rent collection, tenant records, automated invoicing and arrears tracking.",
  email: contact.email,
  telephone: `+${contact.phoneHref.replace("tel:", "").replace(/\D/g, "")}`,
  areaServed: { "@type": "Country", name: contact.region },
  address: { "@type": "PostalAddress", addressCountry: "KE" },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: contact.phone,
      email: contact.email,
      availableLanguage: ["en"],
    },
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: siteConfig.name,
  description: siteConfig.tagline,
  inLanguage: "en-KE",
  publisher: { "@id": ORGANIZATION_ID },
};

type Faq = { question: string; answer: string };

/**
 * FAQPage markup. Pass exactly the questions the page renders - Google rejects schema that describes
 * content which is not visible on that page, so the homepage takes its five and /faqs takes all six.
 */
export function faqPageSchema(items: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/**
 * The app itself, with one Offer per fixed-price plan.
 *
 * Prices are parsed out of src/content/pricing.ts rather than written here, so the schema cannot
 * quietly disagree with the page a visitor sees. Enterprise is skipped: "Custom" is not a number,
 * and an Offer with no price is not a valid offer, so it would only add a dangling entry.
 */
export const applicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: siteConfig.name,
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Property management software for Kenyan landlords: track rent, tenants and M-Pesa payments, automate monthly invoicing and see arrears at a glance.",
  publisher: { "@id": ORGANIZATION_ID },
  offers: pricingTiers.flatMap((tier) => {
    const amount = tier.price.match(/[\d,]+/)?.[0]?.replace(/,/g, "");
    if (!amount) return [];
    return [
      {
        "@type": "Offer",
        name: `${tier.name} plan`,
        price: amount,
        priceCurrency: "KES",
        description: `${tier.description} ${tier.price}${tier.billingUnit}`.trim(),
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
      },
    ];
  }),
};

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.path === "/" ? SITE_URL : `${SITE_URL}${crumb.path}`,
    })),
  };
}
