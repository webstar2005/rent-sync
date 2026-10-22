import { ArrowRight, Check } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { contact } from "@/content/contact";
import { payment } from "@/content/payment";
import { siteConfig } from "@/content/site";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { PayForm } from "@/components/sections/PayForm";

export const metadata = pageMetadata({
  title: "Pay for Your Rent Sync Subscription",
  description:
    "Pay your Rent Sync subscription with an M-Pesa prompt to your phone — approve it with your PIN and your account activates automatically. Send Money also available.",
  path: "/pay",
  imageAlt: "Rent Sync M-Pesa subscription payment instructions",
});

export default function PayPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Pay", path: "/pay" }])} />
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Payment</p>
              <h1 className="mt-3 font-heading text-h1 text-ink">Switch your account on</h1>
              <p className="mt-4 text-body-lg text-gray-500">
                Pay your Rent Sync subscription with an <strong>M-Pesa prompt</strong> sent straight
                to your phone — enter your PIN and your account activates automatically. Prefer{" "}
                {payment.method} to {payment.phone}? That still works too.
              </p>
            </div>
          </div>
        </section>

        <PayForm />

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <h2 className="font-heading text-h3 text-ink">After payment</h2>
              <p className="mt-3 text-body text-gray-500">
                <strong>M-Pesa prompt:</strong> your account activates the moment you approve the
                prompt on your phone — no further action needed.
              </p>
              <p className="mt-3 text-body text-gray-500">
                <strong>Send Money:</strong> a Send Money transfer carries no reference we can read,
                so we cannot match it to your account on our own. Hand us the confirmation code from
                your SMS and we will match it against our statement and switch you on.
              </p>

              <ul className="mt-6 space-y-3">
                {payment.required.map((item) => (
                  <li key={item} className="flex gap-2.5 text-body text-gray-900">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-burgundy-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-xl border border-black/[.04] bg-gray-100 p-6">
                <p className="text-body leading-relaxed text-gray-700">
                  Sign in to Rent Sync and submit the code from your billing page. Your account
                  unlocks as soon as we have confirmed the transfer. {payment.activationNote}
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={siteConfig.appUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta transition hover:bg-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2"
                  >
                    Sign in to submit your code
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <a
                    href={contact.whatsappHref}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 bg-white px-8 text-sm font-semibold text-ink transition hover:border-burgundy-600 hover:bg-burgundy-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                  >
                    WhatsApp us instead
                  </a>
                </div>
              </div>

              <p className="mt-8 text-small leading-relaxed text-gray-500">
                Questions about the amount, or paying on behalf of someone else? Email{" "}
                <a href={contact.emailHref} className="font-medium text-burgundy-600 hover:underline">
                  {contact.email}
                </a>{" "}
                or call {contact.phone}.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
