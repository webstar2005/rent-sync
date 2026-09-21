"use client";

import { Bell, Building2, Users, Receipt, BarChart3, Wrench, LucideIcon, Check, Send, Search as SearchIcon } from "lucide-react";
import { motion } from "framer-motion";
import { features } from "@/content/features";
import { CardIcon } from "@/components/ui/Card";

const iconMap: Record<string, LucideIcon> = {
  bell: Bell,
  users: Users,
  receipt: Receipt,
  "bar-chart": BarChart3,
  building: Building2,
  wrench: Wrench,
};

function FeatureVisual({ title }: { title: string }) {
  // Each visual is purely illustrative and intentionally abstract to keep the design clean.
  if (title.includes("Rent Reminders")) {
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border border-black/5 bg-gradient-to-br from-gray-100 to-white p-3">
        <div className="absolute right-3 top-3 rounded-full bg-burgundy-600 px-2 py-1 text-xs font-semibold text-white">Auto</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Send className="h-3 w-3" aria-hidden /></span>
            <div className="flex-1"><span className="block h-2 w-24 rounded bg-ink/80" /><span className="mt-1 block h-1.5 w-16 rounded bg-gray-500/40" /></div>
            <span className="h-5 rounded-full bg-emerald-50 px-2 text-xs font-semibold text-emerald-700">Sent</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm opacity-80">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Bell className="h-3 w-3" aria-hidden /></span>
            <div className="flex-1"><span className="block h-2 w-20 rounded bg-ink/60" /><span className="mt-1 block h-1.5 w-12 rounded bg-gray-500/30" /></div>
            <span className="text-xs text-gray-500">2d left</span>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-burgundy-50 opacity-60 blur-xl" aria-hidden />
      </div>
    );
  }
  if (title.includes("Tenant Records")) {
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border border-black/5 bg-white p-3">
        <div className="flex items-center gap-2 rounded-md border border-black/5 bg-gray-100 px-2 py-1.5">
          <SearchIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden />
          <span className="h-2 w-20 rounded bg-gray-500/20" />
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between rounded-md bg-gray-100 px-2 py-1.5"><span className="h-2 w-16 rounded bg-ink" /><span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">4B</span></div>
          <div className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 shadow-sm"><span className="h-2 w-20 rounded bg-ink" /><span className="h-1 w-8 rounded-full bg-burgundy-50" /></div>
          <div className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 shadow-sm"><span className="h-2 w-14 rounded bg-ink" /><span className="h-1 w-6 rounded-full bg-burgundy-50" /></div>
        </div>
      </div>
    );
  }
  if (title.includes("Invoices")) {
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border border-black/5 bg-white p-3">
        <div className="rounded-md border border-black/5 bg-gray-100 p-2">
          <div className="flex justify-between"><span className="h-2 w-12 rounded bg-ink" /><span className="h-5 w-12 rounded bg-emerald-50 text-center text-xs font-semibold text-emerald-700">Paid</span></div>
          <div className="mt-2 space-y-1"><span className="block h-1.5 w-full rounded bg-white" /><span className="block h-1.5 w-3/4 rounded bg-white" /></div>
          <div className="mt-2 flex gap-1"><span className="h-1 w-8 rounded bg-burgundy-600" /><span className="h-1 w-6 rounded bg-gray-500/30" /></div>
        </div>
        <div className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs shadow-sm">
          <Receipt className="h-3 w-3 text-burgundy-600" aria-hidden /> Receipt sent
        </div>
      </div>
    );
  }
  if (title.includes("Financial Reports")) {
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border border-black/5 bg-white p-3">
        <div className="flex h-full items-end gap-2">
          <div className="flex flex-1 flex-col gap-1"><span className="h-16 rounded-t bg-burgundy-600" style={{ height: 56 }} /><span className="text-center text-xs text-gray-500">NOV</span></div>
          <div className="flex flex-1 flex-col gap-1"><span className="h-20 rounded-t bg-ink" style={{ height: 72 }} /><span className="text-center text-xs text-gray-500">DEC</span></div>
          <div className="flex flex-1 flex-col gap-1"><span className="h-12 rounded-t bg-burgundy-600/60" style={{ height: 44 }} /><span className="text-center text-xs text-gray-500">JAN</span></div>
          <div className="flex flex-col gap-1"><span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-ink">94%</span><span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">KES 842k</span></div>
        </div>
        <div className="absolute right-2 top-2 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">Export ↥</div>
      </div>
    );
  }
  if (title.includes("Multi-Property")) {
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border border-black/5 bg-gray-100 p-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white p-2 shadow-sm"><span className="block h-2 w-12 rounded bg-ink" /><span className="mt-1 block h-1 w-8 rounded bg-gray-500/30" /><span className="mt-2 inline-block rounded-full bg-burgundy-50 px-1.5 py-0.5 text-xs text-burgundy-600">12 units</span></div>
          <div className="rounded-md bg-white p-2 shadow-sm"><span className="block h-2 w-10 rounded bg-ink" /><span className="mt-1 block h-1 w-6 rounded bg-gray-500/30" /><span className="mt-2 inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">8 units</span></div>
          <div className="rounded-md bg-ink p-2 text-white"><span className="block h-2 w-10 rounded bg-white" /><span className="mt-1 block h-1 w-8 rounded bg-white/60" /><span className="mt-2 inline-block rounded-full bg-white/20 px-1.5 py-0.5 text-xs text-white">Staff: 3</span></div>
          <div className="rounded-md bg-white p-2 shadow-sm"><span className="block h-2 w-8 rounded bg-ink" /><span className="mt-1 block h-1 w-6 rounded bg-gray-500/30" /></div>
        </div>
      </div>
    );
  }
  // Maintenance
  return (
    <div className="relative h-32 overflow-hidden rounded-lg border border-black/5 bg-white p-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-gray-100 p-2"><p className="font-semibold text-ink">Open</p><span className="mt-1 block rounded bg-white px-1 py-1 text-gray-500">Leak 4B</span></div>
        <div className="rounded-md bg-amber-50 p-2"><p className="font-semibold text-amber-700">In progress</p><span className="mt-1 block rounded bg-white px-1 py-1 text-gray-500">Door 2A</span></div>
        <div className="rounded-md bg-emerald-50 p-2"><p className="font-semibold text-emerald-700">Resolved</p><span className="mt-1 flex items-center gap-1 rounded bg-white px-1 py-1 text-gray-500"><Check className="h-3 w-3 text-emerald-600" aria-hidden /> Paid</span></div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 h-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full w-2/3 bg-burgundy-600" /></div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" className="bg-gray-100 py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Features</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">Everything to run rent — without the chase</h2>
          <p className="mt-4 text-body text-gray-500">
            Six core workflows built around how landlords and property managers actually work — from rent collection to maintenance follow-up.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {features.map((feature, i) => {
            const Icon = iconMap[feature.icon] ?? Bell;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group"
              >
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/[.04] bg-white shadow-card transition-shadow hover:shadow-card-hover">
                  <div className="p-2">
                    <div className="transition-transform duration-300 group-hover:scale-[1.01]" aria-hidden="true">
                      <FeatureVisual title={feature.title} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-6 pt-2 lg:p-8 lg:pt-2">
                    <CardIcon>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </CardIcon>
                    <h3 className="mt-5 font-heading text-h4 text-ink">{feature.title}</h3>
                    <p className="mt-2 text-small leading-relaxed text-gray-500">{feature.description}</p>
                    <p className="mt-3 hidden text-xs text-gray-500 group-hover:block">Built to fit the way your team manages rent and maintenance.</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
