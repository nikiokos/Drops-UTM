import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@drops-utm/shared'],
  output: 'standalone',
  // Disable the Next.js dev indicator — its bottom-right toggle button overlaps
  // the floating Operations Copilot button (dev-only; absent in production).
  devIndicators: false,
};

export default nextConfig;
