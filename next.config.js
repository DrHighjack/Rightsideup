/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  skipWaiting: true,
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      // Field techs work at job sites with spotty cellular coverage —
      // serve their job list/details from network when possible, fall
      // back to the last cached copy when offline.
      urlPattern: /\/api\/field\/jobs.*$/,
      method: 'GET',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'field-jobs',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
        cacheableResponse: { statuses: [200] },
      },
    },
    {
      // Job photos stored on Vercel Blob
      urlPattern: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*/i,
      method: 'GET',
      handler: 'CacheFirst',
      options: {
        cacheName: 'blob-images',
        expiration: { maxEntries: 128, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['node-cron', 'imapflow', '@zone-eu/mailsplit', 'nodemailer', 'socks'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'nodemailer', 'imapflow', 'socks', 'node-cron'];
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
