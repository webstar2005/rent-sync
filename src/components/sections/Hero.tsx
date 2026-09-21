"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* subtle gradient accent */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-0 h-[420px] w-[600px] rounded-full bg-burgundy-50 opacity-60 blur-[80px]" />
        <div className="absolute -bottom-32 -left-32 h-[380px] w-[380px] rounded-full bg-gray-100 blur-[60px]" />
      </div>

      <div className="relative mx-auto max-w-content px-6 py-16 lg:flex lg:items-center lg:gap-12 lg:px-8 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <p className="inline-flex items-center rounded-full border border-burgundy-600/10 bg-burgundy-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-burgundy-600">
            For landlords &amp; property managers
          </p>
          <h1 className="mt-5 font-heading text-[2.2rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-h1">
            Run Your Rental Portfolio Without the Spreadsheet Chaos
          </h1>
          <p className="mt-5 max-w-xl text-body-lg text-gray-500">
            Software for landlords and property managers to track rent, tenants, and payments — all in one place. Invoices, arrears, and occupancy — clear at a glance.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/features"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta transition hover:bg-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2"
            >
              See How It Works <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </motion.div>

        {/* Visual — abstract dashboard mock (no competitor mimic) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mt-10 w-full lg:mt-0"
          aria-hidden="true"
        >
          <div className="relative mx-auto max-w-[520px]">
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-card lg:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-burgundy-600" />
                  <span className="h-3 w-3 rounded-full bg-gray-100" />
                  <span className="h-3 w-3 rounded-full bg-gray-100" />
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">Portfolio Overview</span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-gray-100 p-4">
                  <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Collected</p>
                  <p className="mt-1 font-heading text-lg font-bold text-ink">KES 842k</p>
                  <p className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white"><span className="block h-full w-[78%] bg-burgundy-600" /></p>
                </div>
                <div className="rounded-xl bg-gray-100 p-4">
                  <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Arrears</p>
                  <p className="mt-1 font-heading text-lg font-bold text-ink">KES 41k</p>
                  <p className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white"><span className="block h-full w-[18%] bg-ink" /></p>
                </div>
                <div className="rounded-xl bg-ink p-4 text-white">
                  <p className="text-xs font-medium uppercase tracking-widest text-white/60">Occupancy</p>
                  <p className="mt-1 font-heading text-lg font-bold text-white">94%</p>
                  <p className="mt-1 text-xs text-white/60">42 / 45 units</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-center justify-between text-small">
                  <span className="font-medium text-gray-900">Apartment 4B — J. Mwangi</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Paid</span>
                </div>
                <div className="flex items-center justify-between text-small">
                  <span className="font-medium text-gray-900">Unit 2A — A. Odhiambo</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Due in 3 days</span>
                </div>
                <div className="flex items-center justify-between text-small">
                  <span className="font-medium text-gray-900">Maison 12 — K. Njoroge</span>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-burgundy-600">Overdue</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live — updates automatically
              </div>
            </div>

            {/* shadow accent */}
            <div className="absolute -z-10 -bottom-4 left-6 right-6 h-10 rounded-full bg-ink/10 blur-2xl" aria-hidden="true" />
          </div>

          <p className="sr-only">Abstract portfolio overview showing collected rent, arrears, occupancy and tenant payment statuses.</p>
        </motion.div>
      </div>
    </section>
  );
}
