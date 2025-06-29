// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don’t fail production builds on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don’t fail production builds on TypeScript errors
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
