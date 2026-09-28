import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Pricing } from "@/components/sections/Pricing";
import { Contact } from "@/components/sections/Contact";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { JsonLd } from "@/components/JsonLd";
import { applicationSchema, breadcrumbSchema, pageMetadata } from "@/lib/seo";

// Bare title: the root layout's "%s | Rent Sync" template adds the brand once.
export const metadata = pageMetadata({
  title: "Pricing & Plans for Kenyan Landlords",
  description:
    "Rent Sync pricing for Kenyan landlords: plans from KES 2,000/month for 5-20 units, priced by the units you manage, with features that grow as your portfolio does.",
  path: "/pricing",
  imageAlt: "Rent Sync pricing plans for Kenyan landlords",
});

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }])} />
        <JsonLd data={applicationSchema} />
        {/* This is the page's h1. On the homepage the same section is a h2, because there it is one
            section among several. Reusing the component without that distinction left the pricing
            page - the one people search for - with no top-level heading at all. */}
        <Pricing headingLevel={1} />
        <Contact />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
