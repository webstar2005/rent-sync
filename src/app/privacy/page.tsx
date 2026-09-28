import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { pageMetadata } from "@/lib/seo";

// Stays noindex: the page keeps its original intent, and noindex is why it is absent from the
// sitemap. Only the duplicated title is fixed.
export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Rent Sync handles the personal information we collect from visitors, tenants, and property teams.",
  path: "/privacy",
  imageAlt: "Rent Sync privacy policy",
  noindex: true,
});

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
              We collect information you provide directly to us — for example, your name, email address, and company or property details during onboarding. We may also collect usage information about how visitors interact with our website to help improve the experience.
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
              You may request access to, correction of, or deletion of your personal information, and you may opt out of marketing communications at any time. To exercise these rights, get in touch through the Rent Sync dashboard.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
