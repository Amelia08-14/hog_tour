import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/$/, "")
    return [
      {
        source: "/v1/:path*",
        destination: `${backend}/v1/:path*`,
      },
    ]
  },
};

export default nextConfig;
