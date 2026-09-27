import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { faqs } from "@/content/faqs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
import { siteConfig } from "@/content/site";
import { contact } from "@/content/contact";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQs — Rent Sync",
  description: "Common questions about Rent Sync — rent collection, tenant payments, data security, managing multiple properties, and pricing.",
  alternates: { canonical: "/faqs" },
  openGraph: {
    title: "FAQs — Rent Sync",
    description: "Common questions about Rent Sync — rent collection, tenant payments, data security, managing multiple properties, and pricing.",
    url: "/faqs",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync FAQs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQs — Rent Sync",
    description: "Common questions about Rent Sync — rent collection, tenant payments, data security, managing multiple properties, and pricing.",
    images: ["/opengraph-image"],
  },
};

export default function FaqsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Support</p>
            <h1 className="mt-3 max-w-3xl font-heading text-h1 text-ink">Frequently asked questions</h1>
            <p className="mt-4 max-w-2xl text-body-lg text-gray-500">
              Straight answers on setup, rent collection, security, and the day-to-day workflow for property teams.
            </p>
          </div>
        </section>

        <section className="bg-gray-100 py-12 lg:py-16">
          <div className="mx-auto max-w-content px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <Accordion defaultValue="faq-0">
                {faqs.map((faq, i) => (
                  <AccordionItem key={faq.question} value={`faq-${i}`}>
                    <AccordionTrigger value={`faq-${i}`}>{faq.question}</AccordionTrigger>
                    <AccordionContent value={`faq-${i}`}>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="mt-8 rounded-xl border border-black/5 bg-white p-6 text-center shadow-card">
                <h3 className="font-heading text-h4 text-ink">Still need help?</h3>
                <p className="mt-2 text-small text-gray-500">
                  Call <a href={contact.phoneHref} className="font-medium text-burgundy-600 hover:underline">{contact.phone}</a> or email{" "}
                  <a href={contact.emailHref} className="font-medium text-burgundy-600 hover:underline">{contact.email}</a>{" "}
                  and we will help you get set up.
                </p>
                <a
                  href={siteConfig.appUrl}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta hover:bg-burgundy-700"
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
