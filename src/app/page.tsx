import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { RoleBenefitsTabs } from "@/components/sections/RoleBenefitsTabs";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { Pricing } from "@/components/sections/Pricing";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Contact } from "@/components/sections/Contact";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { faqs } from "@/content/faqs";
import { JsonLd } from "@/components/JsonLd";
import { applicationSchema, faqPageSchema } from "@/lib/seo";

// The homepage accordion renders five of the six questions, so only those five are marked up.
// Schema describing a question that is not on this page is invalid, and the sixth is behind a link
// to /faqs.
const HOMEPAGE_FAQ_LIMIT = 5;

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <JsonLd data={applicationSchema} />
        <JsonLd data={faqPageSchema(faqs.slice(0, HOMEPAGE_FAQ_LIMIT))} />
        <Hero />
        <RoleBenefitsTabs />
        <FeatureGrid />
        <Pricing />
        <CtaBanner />
        <Contact />
        <FaqAccordion limit={HOMEPAGE_FAQ_LIMIT} />
      </main>
      <Footer />
    </>
  );
}
