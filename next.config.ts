import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['**.run.app', '**.localhost', 'localhost', '127.0.0.1'],
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/better-sqlite3/prebuilds/**'],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
