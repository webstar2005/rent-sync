import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://rentsync.co.ke";
  const now = new Date();

  const routes = ["", "/features", "/pricing", "/faqs", "/privacy", "/terms"] as const;

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : route === "/privacy" || route === "/terms" ? "yearly" : "monthly",
    priority: route === "" ? 1 : route === "/features" || route === "/pricing" ? 0.9 : route === "/faqs" ? 0.8 : 0.3,
  }));
}
