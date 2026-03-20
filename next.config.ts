import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/generator",
        destination: "/ads",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
