import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],
  beforeSend(event) {
    // Filter out 401/403 API errors (handled by app auth flow)
    const statusCode = event.contexts?.response?.status_code;
    if (statusCode === 401 || statusCode === 403) return null;
    return event;
  },
});
