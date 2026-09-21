import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { RoleBenefitsTabs } from "@/components/sections/RoleBenefitsTabs";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { LeadForm } from "@/components/sections/LeadForm";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <RoleBenefitsTabs />
        <FeatureGrid />
        {/* Pricing removed for single-landlord sale — kept in repo at /pricing but not shown on homepage */}
        <CtaBanner />
        <FaqAccordion limit={5} />
        <LeadForm />
      </main>
      <Footer />
    </>
  );
}
