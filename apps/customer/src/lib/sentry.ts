import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry init hardened for production.
 *
 * Reads from:
 *   EXPO_PUBLIC_SENTRY_DSN          - required (no DSN → no-op)
 *   EXPO_PUBLIC_ENV                 - 'development' | 'staging' | 'production'
 *   EXPO_PUBLIC_SENTRY_TRACES_RATE  - 0..1 (default 0.1 in prod, 0 in dev)
 *
 * Source-map upload happens via `@sentry/react-native/expo` plugin in app.json
 * during `eas build` — no client-side wiring needed.
 *
 * PII safety: `beforeSend` scrubs any field whose key matches sensitive
 * patterns (passport, aadhaar, pan, dob, phone, email, card, otp, signature).
 * This is defence-in-depth — we should never log these in the first place.
 */
let initialized = false;

const SENSITIVE_KEY_RE =
  /(passport|aadhaar|aadhar|pan(_|\b)|dob|date_of_birth|phone|email|card_?number|cvv|otp|signature|razorpay_signature|secret|token)/i;

function scrubObject<T>(obj: T, depth = 0): T {
  if (depth > 6 || obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'object') {
      out[k] = scrubObject(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      console.log('[Sentry] no DSN set, skipping init');
    }
    return;
  }

  const envName = process.env.EXPO_PUBLIC_ENV || (__DEV__ ? 'development' : 'production');
  const tracesRate = Number(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_RATE ?? (envName === 'production' ? 0.1 : 0),
  );

  // Release id ties Sentry events to a specific build so source maps line up.
  const expoVersion = (Constants?.expoConfig?.version as string) || '1.0.0';
  const release = `prayana-customer@${expoVersion}`;
  const dist = String(
    (Constants?.expoConfig as any)?.ios?.buildNumber ||
      (Constants?.expoConfig as any)?.android?.versionCode ||
      '1',
  );

  Sentry.init({
    dsn,
    environment: envName,
    release,
    dist,
    enableAutoSessionTracking: true,
    tracesSampleRate: tracesRate,
    enabled: !__DEV__, // never spam Sentry from dev hot-reloads
    sendDefaultPii: false,
    beforeSend(event) {
      try {
        if (event.request?.data) event.request.data = scrubObject(event.request.data);
        if (event.extra) event.extra = scrubObject(event.extra);
        if (event.contexts) event.contexts = scrubObject(event.contexts);
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => ({
            ...b,
            data: b.data ? scrubObject(b.data) : b.data,
          }));
        }
      } catch {
        // never let scrubbing break the report
      }
      return event;
    },
  });

  initialized = true;
}

export function setSentryUser(uid: string | null, email?: string | null) {
  if (!uid) {
    Sentry.setUser(null);
    return;
  }
  // Only the uid is sent. Email is available locally but we keep it out of
  // Sentry to minimise PII exposure — uid is enough to triage.
  Sentry.setUser({ id: uid });
}

export { Sentry };
