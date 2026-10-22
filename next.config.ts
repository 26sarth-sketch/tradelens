import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every journal screen reads live SQLite data per request,
  // so the classic dynamic model is simpler (see DECISIONS.md #12).
  cacheComponents: false,
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
