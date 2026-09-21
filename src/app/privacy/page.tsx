import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Rent Sync",
  description: "How Rent Sync handles the personal information we collect from leads, tenants, and property teams.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — Rent Sync",
    description: "How Rent Sync handles the personal information we collect from leads, tenants, and property teams.",
    url: "/privacy",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync Privacy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — Rent Sync",
    description: "How Rent Sync handles the personal information we collect from leads, tenants, and property teams.",
    images: ["/opengraph-image"],
  },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-prose px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Legal</p>
          <h1 className="mt-3 font-heading text-h1 text-ink">Privacy Policy</h1>
          <p className="mt-4 text-small text-gray-500">
            Last updated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}.
          </p>

          <div className="prose prose-neutral mt-10 max-w-none text-body text-gray-900">
            <h2 className="font-heading text-h3 text-ink">What information we collect</h2>
            <p className="text-body text-gray-500">
              We collect information you provide directly to us, including your name, email address, phone number, company or property details, and any notes you include in a demo or contact form. We may also collect usage information about how visitors interact with our website to help improve the experience.
            </p>
            <h2 className="mt-8 font-heading text-h3 text-ink">How we use it</h2>
            <p className="text-body text-gray-500">
              We use the information to respond to enquiries, provide product information, support onboarding, manage customer relationships, and improve our website and services. Where you opt in, we may also send product updates and relevant communications.
            </p>
            <h2 className="mt-8 font-heading text-h3 text-ink">How we protect data</h2>
            <p className="text-body text-gray-500">
              We apply reasonable administrative, technical, and organisational safeguards to protect personal information from unauthorised access, disclosure, alteration, or destruction. Sensitive information used inside the Rent Sync product app is handled separately under the platform’s access controls and security policies.
            </p>
            <h2 className="mt-8 font-heading text-h3 text-ink">Your rights</h2>
            <p className="text-body text-gray-500">
              You may request access to, correction of, or deletion of your personal information, and you may opt out of marketing communications at any time. To exercise these rights, contact us using the details below.
            </p>
            <h2 className="mt-8 font-heading text-h3 text-ink">Contact</h2>
            <p className="text-body text-gray-500">
              Questions: <a href="mailto:hello@rentsync.co.ke" className="text-burgundy-600 hover:text-burgundy-700 underline-offset-4 hover:underline">hello@rentsync.co.ke</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
