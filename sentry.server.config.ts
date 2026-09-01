import * as Sentry from '@sentry/nextjs';
import { sendAppCrashDiscordWebhook } from './lib/discord';

export function initSentryServer() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
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
}
