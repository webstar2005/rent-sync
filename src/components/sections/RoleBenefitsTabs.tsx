"use client";

import { Building2, Home } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

type Benefit = { title: string; desc: string };

const audienceContent: Record<
  string,
  { label: string; icon: typeof Home; headline: string; sub: string; benefits: Benefit[] }
> = {
  landlords: {
    label: "Landlords",
    icon: Home,
    headline: "Self-manage without the spreadsheet spiral",
    sub: "For owners handling their own units — 1 to 20, same Rent Sync clarity.",
    benefits: [
      {
        title: "Know who has paid",
        desc: "Incoming M-Pesa and bank payments match to the right tenant automatically, so you stop making calls to check.",
      },
      {
        title: "Invoices go out on their own",
        desc: "Next month's rent is billed to every active tenant automatically, on the due day you set per property.",
      },
      {
        title: "Arrears you can act on",
        desc: "Overdue invoices are flagged the moment they pass their date and sorted by amount outstanding.",
      },
    ],
  },
  managers: {
    label: "Property Managers",
    icon: Building2,
    headline: "Run multiple estates from one login",
    sub: "For managers handling owners' portfolios — 10 to 150+ units, same ledger.",
    benefits: [
      {
        title: "Owner-ready statements",
        desc: "Arrears by property and collection rate over 12 months, exportable as CSV for whoever asks.",
      },
      {
        title: "One portfolio, one login",
        desc: "Every property, unit, tenant, and payment in one place — and your records stay scoped to your account.",
      },
      {
        title: "Repairs tracked to the unit",
        desc: "Log maintenance against a unit, move it through open to resolved, and get flagged when an urgent job drags.",
      },
    ],
  },
};

export function RoleBenefitsTabs() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Built for how you work</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">Two audiences, one ledger</h2>
          <p className="mt-4 text-body text-gray-500">
            Landlords and property managers share the same core — a single record of who owes what, and who has
            paid — with the views each of you actually works from.
          </p>
        </div>

        <Tabs defaultValue="landlords" className="mx-auto mt-10 max-w-4xl">
          <div className="flex justify-center">
            <TabsList aria-label="Audience benefits">
              <TabsTrigger value="landlords">
                <span className="inline-flex items-center gap-2">
                  <Home className="h-4 w-4" aria-hidden="true" /> Landlords
                </span>
              </TabsTrigger>
              <TabsTrigger value="managers">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" aria-hidden="true" /> Property Managers
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {(["landlords", "managers"] as const).map((key) => {
            const data = audienceContent[key];
            const Icon = data.icon;
            return (
              <TabsContent key={key} value={key}>
                <div className="rounded-2xl border border-black/5 bg-gray-100 p-8 shadow-card lg:p-10">
                  <div className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-heading text-h3 text-ink">{data.headline}</h3>
                      <p className="mt-2 text-body text-gray-500">{data.sub}</p>
                    </div>
                  </div>

                  <ul className="mt-6 grid gap-4 pt-6 sm:grid-cols-3">
                    {data.benefits.map((b) => (
                      <li key={b.title} className="rounded-xl border border-black/5 bg-white p-5">
                        <p className="font-heading text-small font-semibold text-ink">{b.title}</p>
                        <p className="mt-1.5 text-small leading-relaxed text-gray-500">{b.desc}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </section>
  );
}
