import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Building2, Users, Receipt, BarChart3, Wrench, Check, Send, Search, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Features — Rent Sync",
  description:
    "Six workflows for landlords and property managers: rent reminders, tenant records, instant invoices, financial reports, multi-property dashboard, and maintenance tracking.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Features — Rent Sync",
    description:
      "Six workflows for landlords and property managers: rent reminders, tenant records, instant invoices, financial reports, multi-property dashboard, and maintenance tracking.",
    url: "/features",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync Features" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Features — Rent Sync",
    description:
      "Six workflows for landlords and property managers: rent reminders, tenant records, instant invoices, financial reports, multi-property dashboard, and maintenance tracking.",
    images: ["/opengraph-image"],
  },
};

const detailed = [
  {
    icon: Bell,
    title: "Automated Rent Reminders & Collection",
    desc: "Send automatic payment reminders and collect rent via mobile money or bank transfer, without manual follow-ups.",
    points: [
      "Scheduled reminders before due date and on the day",
      "STK Push / paybill for M-Pesa plus bank transfer recording",
      "Automatic status update when payment clears — one less spreadsheet",
    ],
  },
  {
    icon: Users,
    title: "Digital Tenant Records",
    desc: "Keep tenant details, lease terms, and full payment history organized and searchable in one dashboard.",
    points: [
      "Lease start/end, deposit, unit link, and contact — in one profile",
      "Full payment timeline per tenant — filter by month, property, or status",
      "Search across buildings in seconds, not scrolls",
    ],
  },
  {
    icon: Receipt,
    title: "Instant Invoices & Receipts",
    desc: "Invoices and receipts generate and send automatically the moment a payment clears.",
    points: [
      "Monthly invoice auto-generation from each unit's rent amount",
      "Receipt sent on payment — branded PDF, optional SMS",
      "Reference tied to tenant + unit + period for clean audits",
    ],
  },
  {
    icon: BarChart3,
    title: "Real-Time Financial Reports",
    desc: "Track income, arrears, and occupancy across the whole portfolio with exportable statements.",
    points: [
      "Arrears by property, collection rate over time, occupancy — plain SQL, no guessing",
      "Exportable statements for owners and accountants",
      "From live views → materialized views when you scale — no rebuild",
    ],
  },
  {
    icon: Building2,
    title: "Multi-Property Dashboard",
    desc: "Manage multiple buildings or units from one login, with role-based access for staff.",
    points: [
      "One org, many properties — every row scoped by organization_id (RLS)",
      "Owner / manager / staff roles — confirm exact boundaries before ship",
      "Switch properties without switching accounts",
    ],
  },
  {
    icon: Wrench,
    title: "Maintenance Request Tracking",
    desc: "Tenants submit maintenance issues in-app and track resolution status without back-and-forth calls.",
    points: [
      "Open → in_progress → resolved workflow",
      "Linked to unit + tenant for context",
      "Staff view for triage — owner sees summary",
    ],
  },
];

function DetailVisual({ title }: { title: string }) {
  if (title.includes("Rent Reminders")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="h-2 w-16 rounded bg-ink" />
          <span className="rounded-full bg-burgundy-600 px-2 py-1 text-xs font-semibold text-white">Auto sequence</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-burgundy-600 shadow-sm"><Bell className="h-3.5 w-3.5" /></span>
            <div className="flex-1"><span className="block h-2 w-20 rounded bg-ink/70" /><span className="mt-1 block h-1.5 w-12 rounded bg-gray-500/40" /></div>
            <span className="text-xs text-gray-500">Day -3</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-burgundy-50 px-3 py-2 ring-1 ring-burgundy-600/20">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-burgundy-600 text-white"><Send className="h-3.5 w-3.5" /></span>
            <div className="flex-1"><span className="block h-2 w-24 rounded bg-ink" /><span className="mt-1 block h-1.5 w-16 rounded bg-gray-500/40" /></div>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-burgundy-600">STK Push</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" /></span>
            <div className="flex-1"><span className="block h-2 w-16 rounded bg-ink" /><span className="mt-1 block h-1.5 w-10 rounded bg-gray-500/40" /></div>
            <span className="text-xs font-semibold text-emerald-700">Paid → Auto receipt</span>
          </div>
        </div>
      </div>
    );
  }
  if (title.includes("Tenant Records")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex items-center gap-2 rounded-lg border border-black/5 bg-gray-100 px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-gray-500" />
          <span className="h-2 flex-1 rounded bg-white" />
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">Filter</span>
        </div>
        <div className="mt-3 rounded-lg border border-black/5 bg-gray-100 p-2">
          <div className="flex gap-2"><span className="h-10 w-10 rounded-full bg-burgundy-50" /><div className="flex-1"><span className="block h-2 w-20 rounded bg-ink" /><span className="mt-1 block h-1.5 w-12 rounded bg-gray-500/40" /><span className="mt-2 inline-flex gap-1"><span className="h-1 w-8 rounded bg-burgundy-600" /><span className="h-1 w-6 rounded bg-gray-500/30" /></span></div><span className="h-6 rounded-full bg-white px-2 text-xs text-gray-500">Unit 4B</span></div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-xs"><span className="rounded bg-white px-1 py-1 text-center text-gray-500">Lease</span><span className="rounded bg-ink px-1 py-1 text-center text-white">Payments</span><span className="rounded bg-white px-1 py-1 text-center text-gray-500">Docs</span></div>
          <div className="mt-2 space-y-1"><span className="block h-1.5 w-full rounded bg-white" /><span className="block h-1.5 w-3/4 rounded bg-white" /></div>
        </div>
      </div>
    );
  }
  if (title.includes("Invoices")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex justify-between"><span className="h-2 w-16 rounded bg-ink" /><span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Receipt #4821</span></div>
        <div className="mt-3 rounded-lg bg-gray-100 p-3">
          <div className="flex justify-between text-xs"><span className="text-gray-500">Invoice KES 12,000</span><span className="font-semibold text-ink">Due 5 Apr</span></div>
          <div className="mt-2 h-1 w-full rounded bg-white"><span className="block h-1 w-full bg-emerald-500" /></div>
          <div className="mt-2 flex items-center justify-between rounded bg-white px-2 py-1.5 text-xs"><span className="flex items-center gap-1 text-gray-500"><Receipt className="h-3 w-3 text-burgundy-600" /> PDF</span><span className="text-burgundy-600">Send → <ArrowRight className="inline h-3 w-3" /></span></div>
        </div>
        <div className="absolute bottom-2 right-3 rounded-full bg-ink px-2 py-1 text-xs text-white">Auto on payment</div>
      </div>
    );
  }
  if (title.includes("Financial Reports")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex justify-between"><span className="h-2 w-20 rounded bg-ink" /><span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">Export CSV</span></div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-1 flex-col items-center gap-1"><span className="w-full rounded-t bg-burgundy-600" style={{ height: 48 }} /><span className="text-xs text-gray-500">Ow A</span></div>
          <div className="flex flex-1 flex-col items-center gap-1"><span className="w-full rounded-t bg-burgundy-600/60" style={{ height: 32 }} /><span className="text-xs text-gray-500">Ow B</span></div>
          <div className="flex flex-1 flex-col items-center gap-1"><span className="w-full rounded-t bg-ink" style={{ height: 64 }} /><span className="text-xs text-gray-500">Ow C</span></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded bg-burgundy-50 py-1 text-burgundy-600">KES 1.2M</span><span className="rounded bg-gray-100 py-1 text-gray-500">KES 240k arrears</span><span className="rounded bg-emerald-50 py-1 text-emerald-700">94% occ</span></div>
      </div>
    );
  }
  if (title.includes("Multi-Property")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-gray-100 p-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 shadow-sm">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink"><Building2 className="h-3.5 w-3.5 text-burgundy-600" /> All properties ▾</span><span className="rounded-full bg-burgundy-50 px-2 py-0.5 text-xs text-burgundy-600">Org scoped</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white p-2 shadow-sm"><span className="block h-2 w-14 rounded bg-ink" /><span className="mt-1 block h-1 w-8 rounded bg-gray-500/30" /><span className="mt-2 inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">Owner</span></div>
          <div className="rounded-lg bg-white p-2 shadow-sm"><span className="block h-2 w-12 rounded bg-ink" /><span className="mt-1 block h-1 w-6 rounded bg-gray-500/30" /><span className="mt-2 inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Manager</span></div>
          <div className="rounded-lg bg-white p-2 shadow-sm"><span className="block h-2 w-10 rounded bg-ink" /><span className="mt-1 block h-1 w-6 rounded bg-gray-500/30" /><span className="mt-2 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Staff</span></div>
          <div className="rounded-lg bg-ink p-2 text-white"><span className="block h-2 w-12 rounded bg-white" /><span className="mt-1 block h-1 w-8 rounded bg-white/60" /><span className="mt-2 text-xs text-white/70">RLS per org_id</span></div>
        </div>
      </div>
    );
  }
  // Maintenance
  return (
    <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
      <div className="flex gap-2 text-xs">
        <div className="flex-1 rounded-lg bg-gray-100 p-2"><p className="font-semibold text-ink">Open</p><div className="mt-2 rounded bg-white p-2 shadow-sm"><span className="block h-2 w-12 rounded bg-ink" /><span className="mt-1 block h-1 w-8 rounded bg-gray-500/30" /></div></div>
        <div className="flex-1 rounded-lg bg-amber-50 p-2"><p className="font-semibold text-amber-700">In progress</p><div className="mt-2 rounded bg-white p-2 shadow-sm"><span className="block h-2 w-10 rounded bg-ink" /><span className="mt-1 flex items-center gap-1 text-gray-500"><Wrench className="h-3 w-3" /> Assigned</span></div></div>
        <div className="flex-1 rounded-lg bg-emerald-50 p-2"><p className="font-semibold text-emerald-700">Resolved</p><div className="mt-2 flex items-center gap-1 rounded bg-white p-2 shadow-sm"><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="h-2 w-12 rounded bg-ink" /></div></div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-xs text-gray-500"><span className="h-1 flex-1 rounded-full bg-gray-100"><span className="block h-1 w-2/3 bg-burgundy-600" /></span> Tap to move</div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {/* Header */}
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Features</p>
            <h1 className="mt-3 max-w-3xl font-heading text-h1 text-ink">
              Everything to run rent — without the chase
            </h1>
            <p className="mt-4 max-w-2xl text-body-lg text-gray-500">
              Six core workflows built around how landlords and property managers actually operate — from reminders to maintenance.
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href={siteConfig.appUrl}
                className="inline-flex h-11 items-center justify-center rounded-full bg-burgundy-600 px-7 text-sm font-semibold text-white shadow-cta hover:bg-burgundy-700"
              >
                Sign In
              </a>
            </div>
          </div>
        </section>

        {/* Detailed per-feature */}
        <section className="bg-gray-100 py-12 lg:py-16">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="grid gap-6 lg:gap-8">
              {detailed.map(({ icon: Icon, title, desc, points }) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-black/5 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover lg:p-8"
                >
                  <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
                    <div className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-600">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="font-heading text-h3 text-ink">{title}</h2>
                        <p className="mt-2 max-w-3xl text-body text-gray-500">{desc}</p>
                        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-small leading-relaxed text-gray-900 marker:text-burgundy-600">
                          {points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                        <p className="mt-3 hidden text-xs text-gray-500 group-hover:block">Built to mirror the real workflow your team uses every month.</p>
                      </div>
                    </div>
                    <div className="transition-transform duration-300 group-hover:scale-[1.01]">
                      <DetailVisual title={title} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-black/5 bg-white p-8 text-center shadow-card">
              <h3 className="font-heading text-h4 text-ink">Ready to see your tenants pay?</h3>
              <p className="mx-auto mt-2 max-w-xl text-small text-gray-500">
                Open your live dashboard — rent, arrears, and payment history, instantly.
              </p>
              <a
                href={siteConfig.appUrl}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta hover:bg-burgundy-700"
              >
                Sign In
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
