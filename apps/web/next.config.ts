import path from "node:path";
import type { NextConfig } from "next";

// Cache Components stays off: every page shows per-collector financial records that must be
// rendered fresh on each request, so there is nothing to prerender or cache.
const nextConfig: NextConfig = {
  output: "standalone",
  // Trace from the monorepo root so the standalone bundle includes hoisted node_modules.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
