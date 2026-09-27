import type { Metadata } from "next";
import {
  BarChart3,
  Building2,
  Users,
  Receipt,
  Wrench,
  Zap,
  Check,
  Search,
  ArrowRight,
  Landmark,
  FileSpreadsheet,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { siteConfig } from "@/content/site";

const title = "Features — Rent Sync";
const description =
  "Six workflows for landlords and property managers in Kenya: automated monthly invoicing, automatic payment matching, arrears and collection reports, tenant records, a multi-property dashboard, and maintenance tracking.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/features" },
  openGraph: {
    title,
    description,
    url: "/features",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync Features" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
};

const detailed = [
  {
    icon: Receipt,
    title: "Automated Monthly Invoicing",
    desc: "Next month's rent is billed to every active tenant automatically, dated from the rent-due day you set on each property.",
    points: [
      "One invoice per tenant per month, uniquely numbered so a re-run can never double-bill",
      "Due date follows each property's rent-due day, any day from 1 to 28",
      "Invoices past their due date flip to overdue on their own — partially paid ones are left for reconciliation, not overwritten",
      "Generate next month on demand, or leave it to the built-in scheduler, which bills every landlord every few hours and catches up a missed month on its own",
    ],
  },
  {
    icon: Zap,
    title: "Payments Matched Automatically",
    desc: "Register your M-Pesa paybill, till, or bank account and incoming payments are matched to the right tenant and invoice the moment they clear.",
    points: [
      "Paybill, till, and bank channels registered to your account and verified against PayHero",
      "Matched to the tenant, then to their oldest open invoice — fully paid invoices settle, part payments mark partial",
      "Every callback is written to an audit log before any processing, so no payment is ever silently lost",
      "Retried callbacks are de-duplicated on the transaction reference, so a flaky network cannot credit a tenant twice",
      "Anything that cannot be matched is still recorded and queued for you to reconcile by hand — never dropped",
    ],
  },
  {
    icon: BarChart3,
    title: "Arrears & Collection Reports",
    desc: "Arrears by property, collection rate month by month, and a per-tenant statement with a running balance.",
    points: [
      "Arrears broken down per property — invoiced, collected, and still outstanding",
      "Collection rate across the last 1 to 24 months, so a bad month is visible next to a good one",
      "Per-tenant statement with a running balance, for disputes and handovers",
      "CSV export on every report, sanitised so a tenant name cannot inject a formula into your spreadsheet",
    ],
  },
  {
    icon: Users,
    title: "Digital Tenant Records",
    desc: "Lease start and end, unit, phone, and the full invoice and payment history in one profile.",
    points: [
      "Lease dates, unit number, phone, and agreed monthly rent in one place",
      "Complete invoice and payment history per tenant, filterable by month or status",
      "Bulk-import tenants from CSV or Excel, with per-row validation and a report of what was skipped",
      "Mark a tenant moved out and their history is kept — moving out is a status change, never a delete",
    ],
  },
  {
    icon: Building2,
    title: "Multi-Property Dashboard",
    desc: "Every building, unit, tenant, invoice, and payment behind a single login.",
    points: [
      "One login across every property you own — no separate account per building",
      "Your records are scoped to your account; another landlord on the platform cannot see or affect them",
      "Collected versus outstanding shown per property at a glance",
      "A needs-attention list sorted overdue first, then by amount owed",
    ],
  },
  {
    icon: Wrench,
    title: "Maintenance Request Tracking",
    desc: "Log a repair against a unit, move it from open to in progress to resolved, and get nudged when something drags.",
    points: [
      "Open → in progress → resolved → closed, linked to the unit and the tenant",
      "Urgent items still open after 48 hours are flagged as escalated so they do not quietly rot",
      "A single action queue across all your properties",
      "Requests stay on record even if the tenant linked to them is later deleted",
    ],
  },
];

function DetailVisual({ title }: { title: string }) {
  if (title.includes("Invoicing")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="h-2 w-16 rounded bg-ink" />
          <span className="rounded-full bg-burgundy-600 px-2 py-1 text-xs font-semibold text-white">
            Auto-generated
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
            <span className="text-xs font-medium text-ink">Unit 4B — J. Mwangi</span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Due 5th
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
            <span className="text-xs font-medium text-ink">Unit 2A — A. Odhiambo</span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Due 5th
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
            <span className="text-xs font-medium text-ink">Unit 1C — K. Njoroge</span>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-burgundy-600">
              Overdue
            </span>
          </div>
        </div>
        <div className="absolute bottom-2 right-3 rounded-full bg-ink px-2 py-1 text-xs text-white">
          Runs monthly
        </div>
      </div>
    );
  }
  if (title.includes("Payments Matched")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="h-2 w-16 rounded bg-ink" />
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
            PayHero callback
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm">
              <Landmark className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1">
              <span className="block h-2 w-24 rounded bg-ink" />
              <span className="mt-1 block h-1.5 w-16 rounded bg-gray-500/40" />
            </div>
            <span className="text-xs text-gray-500">Received</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-burgundy-600/20 bg-burgundy-50 px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-burgundy-600 text-white">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1">
              <span className="block h-2 w-20 rounded bg-ink" />
              <span className="mt-1 block h-1.5 w-14 rounded bg-gray-500/40" />
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-burgundy-600">
              Matched
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1">
              <span className="block h-2 w-20 rounded bg-ink" />
              <span className="mt-1 block h-1.5 w-12 rounded bg-gray-500/40" />
            </div>
            <span className="text-xs font-semibold text-emerald-700">Invoice paid</span>
          </div>
        </div>
      </div>
    );
  }
  if (title.includes("Collection Reports")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="h-2 w-20 rounded bg-ink" />
          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
            <FileSpreadsheet className="h-3 w-3" /> CSV
          </span>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full rounded-t bg-burgundy-600" style={{ height: 52 }} />
            <span className="text-xs text-gray-500">Oct</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full rounded-t bg-burgundy-600/60" style={{ height: 34 }} />
            <span className="text-xs text-gray-500">Nov</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full rounded-t bg-ink" style={{ height: 66 }} />
            <span className="text-xs text-gray-500">Dec</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <span className="rounded bg-burgundy-50 py-1 text-burgundy-600">96% collected</span>
          <span className="rounded bg-gray-100 py-1 text-gray-500">KES 240k arrears</span>
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
          <div className="flex gap-2">
            <span className="h-10 w-10 rounded-full bg-burgundy-50" />
            <div className="flex-1">
              <span className="block h-2 w-20 rounded bg-ink" />
              <span className="mt-1 block h-1.5 w-12 rounded bg-gray-500/40" />
              <span className="mt-2 inline-flex gap-1">
                <span className="h-1 w-8 rounded bg-burgundy-600" />
                <span className="h-1 w-6 rounded bg-gray-500/30" />
              </span>
            </div>
            <span className="h-6 rounded-full bg-white px-2 text-xs text-gray-500">Unit 4B</span>
          </div>
          <div className="mt-2 space-y-1">
            <span className="block h-1.5 w-full rounded bg-white" />
            <span className="block h-1.5 w-3/4 rounded bg-white" />
          </div>
        </div>
      </div>
    );
  }
  if (title.includes("Multi-Property")) {
    return (
      <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-gray-100 p-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 shadow-sm">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Building2 className="h-3.5 w-3.5 text-burgundy-600" /> All properties ▾
          </span>
          <span className="rounded-full bg-burgundy-50 px-2 py-0.5 text-xs text-burgundy-600">
            Your account only
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <span className="block h-2 w-14 rounded bg-ink" />
            <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <span className="block h-1 w-4/5 bg-burgundy-600" />
            </span>
          </div>
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <span className="block h-2 w-12 rounded bg-ink" />
            <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <span className="block h-1 w-3/5 bg-burgundy-600" />
            </span>
          </div>
          <div className="rounded-lg bg-ink p-2 text-white">
            <span className="flex items-center justify-between">
              <span className="block h-2 w-16 rounded bg-white" />
              <span className="text-xs text-white/70">needs attention</span>
            </span>
          </div>
        </div>
      </div>
    );
  }
  // Maintenance
  return (
    <div className="relative h-[190px] overflow-hidden rounded-xl border border-black/5 bg-white p-3" aria-hidden="true">
      <div className="flex gap-2 text-xs">
        <div className="flex-1 rounded-lg bg-gray-100 p-2">
          <p className="font-semibold text-ink">Open</p>
          <div className="mt-2 rounded bg-white p-2 shadow-sm">
            <span className="block h-2 w-12 rounded bg-ink" />
            <span className="mt-1 block h-1 w-8 rounded bg-gray-500/30" />
          </div>
        </div>
        <div className="flex-1 rounded-lg bg-amber-50 p-2">
          <p className="font-semibold text-amber-700">In progress</p>
          <div className="mt-2 rounded bg-white p-2 shadow-sm">
            <span className="block h-2 w-10 rounded bg-ink" />
            <span className="mt-1 flex items-center gap-1 text-gray-500">
              <Wrench className="h-3 w-3" /> Assigned
            </span>
          </div>
        </div>
        <div className="flex-1 rounded-lg bg-emerald-50 p-2">
          <p className="font-semibold text-emerald-700">Resolved</p>
          <div className="mt-2 flex items-center gap-1 rounded bg-white p-2 shadow-sm">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="h-2 w-12 rounded bg-ink" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-xs text-gray-500">
        <span className="h-1 flex-1 rounded-full bg-gray-100">
          <span className="block h-1 w-2/3 bg-burgundy-600" />
        </span>
        Escalates at 48h
      </div>
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
              Six core workflows built around how landlords and property managers actually operate — from
              invoicing to maintenance.
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href={siteConfig.appUrl}
                className="inline-flex h-11 items-center justify-center rounded-full bg-burgundy-600 px-7 text-sm font-semibold text-white shadow-cta hover:bg-burgundy-700"
              >
                Get Started <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
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
                Get Started
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
