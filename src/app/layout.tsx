import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rentsync.africa"),
  // The template supplies the brand, so page titles are the bare page name. It used to be applied on
  // top of titles that already ended in " - Rent Sync", and every page rendered the brand twice.
  title: {
    default: "Rent Sync — Property Management Software for Kenyan Landlords",
    template: "%s | Rent Sync",
  },
  description:
    "Rent Sync is property management software for Kenyan landlords: track rent, tenants and M-Pesa payments, automate monthly invoicing and see arrears at a glance.",
  applicationName: "Rent Sync",
  keywords: [
    "property management software Kenya",
    "rent tracking software",
    "tenant management system",
    "M-Pesa rent collection",
    "landlord software Nairobi",
    "rent collection software",
  ],
  category: "business",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: "https://rentsync.africa",
    siteName: "Rent Sync",
    title: "Rent Sync — Property Management Software for Kenyan Landlords",
    description:
      "Rent Sync is property management software for Kenyan landlords: track rent, tenants and M-Pesa payments, automate monthly invoicing and see arrears at a glance.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Rent Sync — property management software for Kenyan landlords",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rent Sync — Property Management Software for Kenyan Landlords",
    description:
      "Rent Sync is property management software for Kenyan landlords: track rent, tenants and M-Pesa payments, automate monthly invoicing and see arrears at a glance.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-gray-900 font-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-card"
        >
          Skip to content
        </a>
        {/* Site-wide identity. Declared once here so every page can reference it by @id rather than
            repeating the whole Organization graph on all seven. */}
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        {children}
      </body>
    </html>
  );
}
