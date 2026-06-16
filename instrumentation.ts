import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 1.0,
        debug: process.env.NODE_ENV === 'development',
      });
      console.log('[INIT] Sentry initialized');
    } else {
      console.log('[INIT] SENTRY_DSN not configured, error tracking disabled');
    }

    if (!process.env.DATABASE_URL) {
      console.log('[INIT] DATABASE_URL not configured, scheduler disabled');
      return;
    }

    const { startScheduler } = await import('./lib/scheduler');
    console.log('[INIT] Starting scheduler...');
    await startScheduler();
  }
}
