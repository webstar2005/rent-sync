import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Pricing } from "@/components/sections/Pricing";
import { Contact } from "@/components/sections/Contact";
import { CtaBanner } from "@/components/sections/CtaBanner";

const title = "Pricing — Rent Sync";
const description =
  "Rent Sync is priced by the number of units you manage. Every plan includes the full feature set — from KES 2,000/month for 5–20 units up to a custom Enterprise plan for 100+ units.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title,
    description,
    url: "/pricing",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rent Sync pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Pricing />
        <Contact />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
