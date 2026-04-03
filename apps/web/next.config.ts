import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Mark optional dependencies as external to prevent build failures
  serverExternalPackages: ['@react-pdf/renderer'],
  // Transpile workspace packages for proper module resolution
  transpilePackages: ['@meridian/types'],
};

export default nextConfig;
