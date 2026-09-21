import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
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
  metadataBase: new URL("https://rentsync.co.ke"),
  title: {
    default: "Rent Sync — Run Your Rental Portfolio Without the Spreadsheet Chaos",
    template: "%s | Rent Sync",
  },
  description:
    "Software for landlords and property managers to track rent, tenants, and payments — all in one place.",
  applicationName: "Rent Sync",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: "https://rentsync.co.ke",
    siteName: "Rent Sync",
    title: "Rent Sync — Run Your Rental Portfolio Without the Spreadsheet Chaos",
    description:
      "Software for landlords and property managers to track rent, tenants, and payments — all in one place.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Rent Sync — Run Your Rental Portfolio Without the Spreadsheet Chaos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rent Sync — Run Your Rental Portfolio Without the Spreadsheet Chaos",
    description:
      "Software for landlords and property managers to track rent, tenants, and payments — all in one place.",
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
        {children}
      </body>
    </html>
  );
}
