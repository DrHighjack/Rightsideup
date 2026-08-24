import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry
    if (process.env.SENTRY_DSN) {
      const { sendAppCrashDiscordWebhook } = await import('./lib/discord');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 1.0,
        debug: process.env.NODE_ENV === 'development',
        beforeSend(event, hint) {
          const error = hint.originalException;
          sendAppCrashDiscordWebhook({
            message: error instanceof Error ? error.message : String(error ?? event.message ?? 'Unknown error'),
            stack: error instanceof Error ? error.stack : undefined,
            route: event.request?.url,
          }).catch((discordError) => console.error('[DISCORD] Failed to send app crash webhook:', discordError));
          return event;
        },
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
