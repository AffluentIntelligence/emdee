import type { NextConfig } from "next";

const config: NextConfig = {
  // Allow @toast-ui/editor and cytoscape to load in client components
  transpilePackages: ["@toast-ui/editor"],
};

export default config;
