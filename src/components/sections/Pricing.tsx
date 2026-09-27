"use client";

import { Check } from "lucide-react";
import { pricingTiers, pricingFootnote } from "@/content/pricing";
import { contact } from "@/content/contact";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section id="pricing" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Pricing</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">Priced by the units you manage</h2>
          <p className="mt-4 text-body text-gray-500">
            One plan, every feature. Pick the band that matches your portfolio and change it as you grow.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover lg:p-7",
                tier.highlighted
                  ? "border-burgundy-600 ring-1 ring-burgundy-600"
                  : "border-black/[.04]"
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-burgundy-600 px-3 py-1 text-xs font-semibold text-white shadow-soft">
                  Most popular
                </span>
              )}

              <h3 className="font-heading text-h4 text-ink">{tier.name}</h3>
              <p className="mt-1.5 min-h-[2.5rem] text-small leading-relaxed text-gray-500">
                {tier.description}
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-heading text-2xl font-bold text-ink">{tier.price}</span>
                {tier.billingUnit && (
                  <span className="text-small text-gray-500">{tier.billingUnit}</span>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-small leading-relaxed text-gray-900">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy-600" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.name === "Enterprise" ? contact.phoneHref : siteConfig.appUrl}
                className={cn(
                  "mt-8 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  tier.highlighted
                    ? "bg-burgundy-600 text-white shadow-cta hover:bg-burgundy-700 focus-visible:ring-burgundy-600"
                    : "border border-ink/10 bg-white text-ink hover:bg-gray-100 focus-visible:ring-ink"
                )}
              >
                {tier.ctaLabel}
              </a>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-small leading-relaxed text-gray-500">
          {pricingFootnote}
        </p>
      </div>
    </section>
  );
}
