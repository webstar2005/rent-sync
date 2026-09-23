import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages (commands: next build → out/, served statically,
  // no Node runtime needed). The marketing site has no API routes or dynamic SSR.
  output: "export",
};

export default nextConfig;
