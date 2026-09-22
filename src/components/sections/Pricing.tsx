"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { pricingTiers } from "@/content/pricing";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";

export function Pricing() {
  const [hovered, setHovered] = React.useState<string | null>(null);

  return (
    <section id="pricing" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Pricing</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">Simple pricing by portfolio size</h2>
          <p className="mt-4 text-body text-gray-500">
            Clear, flexible pricing for landlords and operators managing a handful of units or a growing portfolio.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-4" onMouseLeave={() => setHovered(null)}>
          {pricingTiers.map((tier) => {
            const isActive = hovered ? hovered === tier.name : !!tier.highlighted;
            return (
            <div
              key={tier.name}
              onMouseEnter={() => setHovered(tier.name)}
              onFocusCapture={() => setHovered(tier.name)}
              className={cn(
                "group relative flex flex-col rounded-2xl border p-6 transition-all duration-200 lg:p-7",
                isActive
                  ? "border-burgundy-600 bg-white shadow-card ring-1 ring-burgundy-600"
                  : "border-black/5 bg-white shadow-card hover:border-burgundy-600 hover:shadow-card-hover hover:ring-1 hover:ring-burgundy-600"
              )}
            >
              {tier.highlighted && isActive && (
                <span className="absolute -top-3 left-6 rounded-full bg-burgundy-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Most popular
                </span>
              )}

              <h3 className="font-heading text-h4 text-ink">{tier.name}</h3>
              <p className="mt-1 text-small text-gray-500">{tier.description}</p>

              <div className="mt-5">
                <span className="font-heading text-2xl font-bold text-ink">{tier.price}</span>
                {tier.billingUnit && <span className="text-small text-gray-500">{tier.billingUnit}</span>}
              </div>

              <ul className="mt-6 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-small leading-relaxed text-gray-900">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy-600" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={siteConfig.appUrl}
                className={cn(
                  "mt-8 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-burgundy-600 text-white shadow-cta hover:bg-burgundy-700 focus-visible:ring-burgundy-600"
                    : "border border-ink/10 bg-white text-ink hover:bg-gray-100 focus-visible:ring-ink"
                )}
              >
                {tier.ctaLabel}
              </a>
            </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-small text-gray-500">
          Need 150+ units? Manage a growing portfolio — <a href={siteConfig.appUrl} className="font-medium text-burgundy-600 hover:text-burgundy-700 underline-offset-4 hover:underline">get started</a>.
        </p>
      </div>
    </section>
  );
}
