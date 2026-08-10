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
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sandbox.fluidpay.com https://app.fluidpay.com https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https: wss: https://sandbox.fluidpay.com https://app.fluidpay.com",
      "frame-src 'self' https://sandbox.fluidpay.com https://app.fluidpay.com https://www.google.com https://www.youtube.com https://player.vimeo.com",
      "child-src 'self' https://sandbox.fluidpay.com https://app.fluidpay.com https://www.google.com https://www.youtube.com https://player.vimeo.com",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
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
