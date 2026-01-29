/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveAlias: {
      canvas: './empty-module.js',
    },
  },
  // Webpack configuration (fallback for --webpack flag)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
}

module.exports = nextConfig

