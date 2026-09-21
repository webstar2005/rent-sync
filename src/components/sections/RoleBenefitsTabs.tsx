"use client";

import { Building2, Home, Users } from "lucide-react";
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
      { title: "Know who paid — no calls needed", desc: "Automatic reminders and live payment status per unit, so you stop chasing." },
      { title: "One view for every unit", desc: "Tenant records, lease terms, and full history searchable — no more folder piles." },
      { title: "Rent due before it becomes arrears", desc: "Alerts before due date, receipts the moment M-Pesa or bank clears." },
    ],
  },
  managers: {
    label: "Property Managers",
    icon: Building2,
    headline: "Run multiple estates from one login",
    sub: "For managers handling owners' portfolios — 10 to 150+ units, same ledger.",
    benefits: [
      { title: "Owner-ready statements", desc: "Arrears by property and collection rate over time — exportable, no manual math." },
      { title: "Built for teams", desc: "Owner / manager / staff roles, per-organization isolation — every row scoped by org." },
      { title: "From chat to cleared", desc: "Maintenance open → in-progress → resolved, linked to unit + tenant for triage." },
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
            Rent Sync is category-original (Section 4a) — not copied. Landlords and property managers share the same core, with workflows tuned to how each works.
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

                  <p className="mt-6 flex items-center gap-2 text-xs text-gray-500">
                    <Users className="h-4 w-4 text-burgundy-600" aria-hidden="true" />
                    Third segment — Real Estate Agencies / Housing Estates — only if product supports it (Section 4a). Confirm with client.
                  </p>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </section>
  );
}
