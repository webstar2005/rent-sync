"use client";

import Link from "next/link";
import { faqs } from "@/content/faqs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";

export function FaqAccordion({ limit = 5, showLink = true }: { limit?: number; showLink?: boolean }) {
  const items = faqs.slice(0, limit);

  return (
    <section id="faqs" className="bg-gray-100 py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">FAQs</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">Questions, answered</h2>
          <p className="mt-4 text-body text-gray-500">
            Expand one at a time to get fast answers about setup, payments, security, and portfolio management.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <Accordion defaultValue="faq-0">
            {items.map((faq, i) => (
              <AccordionItem key={faq.question} value={`faq-${i}`}>
                <AccordionTrigger value={`faq-${i}`}>{faq.question}</AccordionTrigger>
                <AccordionContent value={`faq-${i}`}>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {showLink && faqs.length > limit && (
            <p className="mt-6 text-center">
              <Link
                href="/faqs"
                className="inline-flex items-center gap-1 text-sm font-semibold text-burgundy-600 hover:text-burgundy-700 underline-offset-4 hover:underline"
              >
                See all FAQs →
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
