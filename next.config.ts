import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    // three / drei ship modern ESM; keep optimized package imports tidy
    optimizePackageImports: ["lucide-react", "@react-three/drei"],
  },
};

export default nextConfig;
