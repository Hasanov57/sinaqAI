import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/ai/explain": ["./public/exam-assets/2025-03-02/*.png"],
  },
};

export default nextConfig;
