import { ArrowRight, Check } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { contact } from "@/content/contact";
import { payment } from "@/content/payment";
import { pricingTiers } from "@/content/pricing";
import { siteConfig } from "@/content/site";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pay for Your Rent Sync Subscription",
  description:
    "Pay your Rent Sync subscription by M-Pesa Send Money to 0790 325 943, then submit your confirmation code to activate your account.",
  path: "/pay",
  imageAlt: "Rent Sync M-Pesa subscription payment instructions",
});

/** Enterprise is priced by conversation, so it has no fixed amount to send. */
const payable = pricingTiers.filter((t) => t.billingUnit);

export default function PayPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Pay", path: "/pay" }])} />
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">
                Payment
              </p>
              <h1 className="mt-3 font-heading text-h1 text-ink">Switch your account on</h1>
              <p className="mt-4 text-body-lg text-gray-500">
                Rent Sync subscriptions are paid by {payment.method} straight to our business
                number. There is no card form and no paybill to look up — it is a transfer to a
                phone number, and we confirm it by hand.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-gray-100 py-12 lg:py-16">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
              {/* Amount to send */}
              <div>
                <h2 className="font-heading text-h3 text-ink">How much to send</h2>
                <p className="mt-2 text-small text-gray-500">
                  Send the monthly amount for your band. If you have fewer than 5 units, message
                  us first and we will price it for you.
                </p>
                <ul className="mt-6 space-y-3">
                  {payable.map((tier) => (
                    <li
                      key={tier.id}
                      id={tier.id}
                      className="scroll-mt-28 rounded-xl border border-black/[.04] bg-white p-5 shadow-card"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-heading text-h4 text-ink">{tier.name}</span>
                        <span className="font-heading text-h4 text-burgundy-600">
                          {tier.price}
                          <span className="text-small font-normal text-gray-500">
                            {tier.billingUnit}
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-small text-gray-500">{tier.description}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-small text-gray-500">
                  Running 100+ units?{" "}
                  <a href={contact.phoneHref} className="font-medium text-burgundy-600 hover:underline">
                    Call {contact.phone}
                  </a>{" "}
                  and we will put a custom plan together.
                </p>
              </div>

              {/* The number, and the steps */}
              <div>
                <h2 className="font-heading text-h3 text-ink">Where to send it</h2>
                <div className="mt-6 rounded-xl border border-burgundy-600/20 bg-burgundy-50 p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-700">
                    Send Money to
                  </p>
                  <p className="mt-2 font-heading text-h3 break-words text-ink">
                    {payment.phone}
                  </p>
                  <p className="mt-3 text-small leading-relaxed text-gray-700">
                    {payment.expectNameNote}
                  </p>
                </div>

                <ol className="mt-8 space-y-4">
                  {payment.steps.map((step, i) => (
                    <li key={step} className="flex gap-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-burgundy-600 text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="pt-0.5 text-body leading-relaxed text-gray-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <h2 className="font-heading text-h3 text-ink">Then tell us it went through</h2>
              <p className="mt-3 text-body text-gray-500">
                A Send Money transfer carries no reference we can read, so we cannot match it to
                your account on our own. Hand us the two things below and we will match it against
                our statement and switch you on.
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
