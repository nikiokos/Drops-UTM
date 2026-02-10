import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@drops-utm/shared'],
  output: 'standalone',
};

export default nextConfig;
