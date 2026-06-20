import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Strip all console.* calls from production builds
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
};

export default nextConfig;
