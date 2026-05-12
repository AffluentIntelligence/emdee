import type { NextConfig } from "next";

const config: NextConfig = {
  // Allow @toast-ui/editor and cytoscape to load in client components
  transpilePackages: ["@toast-ui/editor"],
  // Bundle templates so the public-namespace fallback works in serverless
  outputFileTracingIncludes: {
    "/api/index": ["./templates/**"],
  },
};

export default config;
