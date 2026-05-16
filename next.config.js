/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "4mb" }
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "indiankanoon.org" }]
  },
  // Allow the agent (~30s) to finish even on long queries
  serverRuntimeConfig: { maxDuration: 60 }
};

module.exports = nextConfig;
