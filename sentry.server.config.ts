import * as Sentry from '@sentry/nextjs';

export function initSentryServer() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    debug: process.env.NODE_ENV === 'development',
  });
}
