import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { RoleBenefitsTabs } from "@/components/sections/RoleBenefitsTabs";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { FaqAccordion } from "@/components/sections/FaqAccordion";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <RoleBenefitsTabs />
        <FeatureGrid />
        <CtaBanner />
        <FaqAccordion limit={5} />
      </main>
      <Footer />
    </>
  );
}
