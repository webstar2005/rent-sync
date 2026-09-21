import { siteConfig } from "@/content/site";

export function CtaBanner() {
  return (
    <section className="bg-gray-100 py-16 lg:py-20">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-8 shadow-card lg:flex lg:items-center lg:justify-between lg:gap-8 lg:p-10">
          {/* subtle burgundy tint — blends with white/gray-100 system instead of stark ink band */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-burgundy-50 opacity-80 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gray-100 blur-2xl"
          />

          <div className="relative max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Get started in minutes</p>
            <h2 className="mt-2 font-heading text-h2 text-ink">Ready to clear the arrears backlog?</h2>
            <p className="mt-3 max-w-xl text-body text-gray-500">
              Join landlords and property managers who replaced spreadsheets with one clean dashboard. Start free — no credit card required.
            </p>
          </div>
          <div className="relative mt-8 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0">
            <a
              href={siteConfig.appUrl}
              className="inline-flex h-12 items-center justify-center rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta transition hover:bg-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
