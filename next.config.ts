import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["chart.js", "react-chartjs-2"],
  },
};

export default nextConfig;
