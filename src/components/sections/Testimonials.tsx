import { testimonials } from "@/content/testimonials";

export function Testimonials() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Testimonials</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">What property teams say</h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote key={t.name} className="rounded-xl border border-black/5 bg-white p-6 shadow-card">
              <p className="text-body text-gray-900">“{t.quote}”</p>
              <footer className="mt-4">
                <p className="text-sm font-semibold text-ink">{t.name}</p>
                {(t.role || t.company) && (
                  <p className="text-xs text-gray-500">
                    {[t.role, t.company].filter(Boolean).join(" · ")}
                  </p>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
