import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Pricing } from "@/components/sections/Pricing";
import { pricingTiers } from "@/content/pricing";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing — Rent Sync",
  description:
    "Simple pricing by portfolio size for landlords and property managers who want clean rent operations and full visibility.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — Rent Sync",
    description:
      "Tiered pricing by units managed: Starter 1–10, Growth 11–50, Scale 51–150, Enterprise 150+ custom.",
    url: "/pricing",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Rent Sync",
    description:
      "Tiered pricing by units managed: Starter 1–10, Growth 11–50, Scale 51–150, Enterprise 150+ custom.",
    images: ["/opengraph-image"],
  },
};

const comparison = [
  { feature: "Units included", values: ["1–10", "11–50", "51–150", "150+ custom"] },
  { feature: "Rent reminders & collection", values: [true, true, true, true] },
  { feature: "Tenant records & history", values: [true, true, true, true] },
  { feature: "Invoices & receipts (auto)", values: [true, true, true, true] },
  { feature: "Financial reports & exports", values: [false, true, true, true] },
  { feature: "Multi-property dashboard", values: [false, true, true, true] },
  { feature: "Role-based access", values: [false, false, true, true] },
  { feature: "Maintenance tracking", values: [false, false, true, true] },
  { feature: "Priority / SLA support", values: [false, false, true, true] },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <section className="bg-white py-16 lg:py-16">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Pricing</p>
            <h1 className="mt-3 max-w-3xl font-heading text-h1 text-ink">Simple pricing by portfolio size</h1>
            <p className="mt-4 max-w-2xl text-body-lg text-gray-500">
              Flexible plans for owners and managers who want clarity, control, and a cleaner rent process.
            </p>
          </div>
        </section>

        {/* Reuse homepage pricing cards — heading now h2 via section below */}
        <Pricing />

        {/* Comparison table */}
        <section className="bg-gray-100 py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-h2 text-ink">Compare all tiers</h2>
              <p className="mt-3 text-body text-gray-500">
                Compare the plan that fits your portfolio today and scale as your operations grow.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-xl border border-black/5 bg-white shadow-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Pricing tier comparison by feature</caption>
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-heading text-sm font-semibold text-ink">Feature</th>
                    {pricingTiers.map((t) => (
                      <th scope="col" key={t.name} className="px-6 py-4 font-heading text-sm font-semibold text-ink">
                        {t.name}
                        {t.highlighted && (
                          <span className="ml-2 rounded-full bg-burgundy-600 px-2 py-0.5 text-xs font-semibold text-white">
                            Popular
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {comparison.map((row) => (
                    <tr key={row.feature} className="hover:bg-gray-50/50">
                      <th scope="row" className="px-6 py-4 text-left text-small font-medium text-ink">{row.feature}</th>
                      {row.values.map((v, i) => (
                        <td key={i} className="px-6 py-4 text-small text-gray-500">
                          {typeof v === "boolean" ? (
                            v ? (
                              <Check className="h-5 w-5 text-burgundy-600" aria-label="Included" />
                            ) : (
                              <X className="h-5 w-5 text-gray-500/40" aria-label="Not included" />
                            )
                          ) : (
                            v
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 rounded-xl border border-black/5 bg-white p-6 text-center shadow-card">
              <p className="text-small text-gray-500">
                Ready? <a href={siteConfig.appUrl} className="font-medium text-burgundy-600 hover:text-burgundy-700 underline-offset-4 hover:underline">Sign In → Dashboard</a> or see <Link href="/faqs" className="font-medium text-burgundy-600 hover:text-burgundy-700 underline-offset-4 hover:underline">FAQs</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
