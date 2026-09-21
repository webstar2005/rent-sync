"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on route change / escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Lock scroll
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors",
        scrolled ? "border-white/10 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/80" : "border-transparent bg-ink"
      )}
    >
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-6 px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-md -ml-1 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-burgundy-600 text-white">
            <span className="font-heading text-xs font-bold tracking-widest">RS</span>
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-white">{siteConfig.name}</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {siteConfig.navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={siteConfig.appUrl}
            className="inline-flex h-10 items-center justify-center rounded-full bg-burgundy-600 px-6 text-sm font-semibold text-white shadow-cta transition-colors hover:bg-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Sign In
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 md:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile panel */}
      <div
        id="mobile-nav"
        hidden={!open}
        className={cn(
          "border-t border-white/10 bg-ink md:hidden",
          !open && "hidden"
        )}
      >
        <div className="mx-auto max-w-content px-6 py-6">
          <nav aria-label="Mobile primary" className="flex flex-col gap-1">
            {siteConfig.navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid gap-3">
            <a
              href={siteConfig.appUrl}
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-burgundy-600 text-sm font-semibold text-white shadow-cta hover:bg-burgundy-700"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
