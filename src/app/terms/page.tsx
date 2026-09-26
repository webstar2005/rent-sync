import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — Rent Sync",
  description: "The terms governing use of the Rent Sync website and property management platform.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service — Rent Sync",
    description: "The terms governing use of the Rent Sync website and property management platform.",
    url: "/terms",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync Terms" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Rent Sync",
    description: "The terms governing use of the Rent Sync website and property management platform.",
    images: ["/opengraph-image"],
  },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-prose px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Legal</p>
          <h1 className="mt-3 font-heading text-h1 text-ink">Terms of Service</h1>
          <p className="mt-4 text-small text-gray-500">
            Last updated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}.
          </p>

          <div className="prose prose-neutral mt-10 max-w-none text-body text-gray-900">
            <h2 className="font-heading text-h3 text-ink">Use of the site</h2>
            <p className="text-body text-gray-500">
              This website is for informational and commercial purposes. It does not replace the separate terms governing use of the Rent Sync product application or any customer agreement entered into with us.
            </p>
            <h2 className="mt-8 font-heading text-h3 text-ink">Provided information</h2>
            <p className="text-body text-gray-500">
              Any information supplied through our website is provided voluntarily. We use it to respond to your enquiry, support the sales process, and improve our service offering.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
