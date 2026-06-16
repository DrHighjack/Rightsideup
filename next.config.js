/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  skipWaiting: true,
  fallbacks: {
    document: '/offline.html',
  },
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
