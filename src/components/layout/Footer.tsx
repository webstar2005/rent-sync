import Link from "next/link";
import { siteConfig } from "@/content/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white/60">
      <div className="mx-auto max-w-content px-6 py-14 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-burgundy-600 text-white">
                <span className="font-heading text-xs font-bold tracking-widest">RS</span>
              </span>
              <span className="font-heading text-lg font-bold tracking-tight text-white">{siteConfig.name}</span>
            </Link>
            <p className="mt-4 max-w-sm text-small leading-relaxed text-white/60">
              Software for landlords and property managers to track rent, tenants, and payments — all in one place.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-widest text-white">Product</h4>
            <ul className="mt-4 space-y-3 text-small">
              <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/faqs" className="hover:text-white transition-colors">FAQs</Link></li>
              <li><a href={siteConfig.appUrl} className="hover:text-white transition-colors">Sign In → Dashboard</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-widest text-white">Landlord</h4>
            <ul className="mt-4 space-y-3 text-small">
              <li><Link href="/features" className="hover:text-white transition-colors">Why Rent Sync</Link></li>
              <li><a href={siteConfig.appUrl} className="hover:text-white transition-colors">Open Dashboard</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-widest text-white">Legal</h4>
            <ul className="mt-4 space-y-3 text-small">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
            {siteConfig.social && siteConfig.social.length > 0 && (
              <div className="mt-8">
                <p className="font-heading text-sm font-semibold uppercase tracking-widest text-white">Follow</p>
                <ul className="mt-3 flex gap-4 text-small">
                  {siteConfig.social.map((s) => (
                    <li key={s.label}>
                      <a href={s.href} className="hover:text-white transition-colors underline-offset-4 hover:underline">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs leading-relaxed text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {siteConfig.name}. All rights reserved.</p>
          <p>Built for property teams in Kenya and beyond.</p>
        </div>
      </div>
    </footer>
  );
}
