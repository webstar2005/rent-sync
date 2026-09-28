import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://rentsync.africa";

  // No lastModified. This used to be `new Date()`, which re-stamped all seven URLs on every build -
  // so the sitemap told crawlers every page had just changed, every time, and the field carried no
  // information at all. Omitting it says "unknown", which is honest; a real date here needs to be
  // bumped when that page's copy actually changes, which is a decision rather than a side effect of
  // running a build.
  //
  // /pay is deliberately absent. It stays indexable and reachable by link, because a customer who
  // has been told to send M-Pesa to a number needs to land on it, but it is a transactional
  // instruction page rather than something anyone searches for, and listing it invites it to compete
  // with /pricing for the same intent.
  //
  // /privacy and /terms are absent because they carry robots noindex, follow. A sitemap is a list of
  // URLs you want indexed, so listing a noindex URL there contradicts itself and confuses crawkers
  // about which signal wins.
  const routes = ["", "/features", "/pricing", "/faqs"] as const;

  return routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/faqs" ? 0.8 : 0.9,
  }));
}
