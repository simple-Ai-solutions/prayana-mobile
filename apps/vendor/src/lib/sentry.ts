import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry init for the vendor app — see customer/src/lib/sentry.ts for the
 * full architecture notes. Mirror with vendor release tag.
 */
let initialized = false;

const SENSITIVE_KEY_RE =
  /(passport|aadhaar|aadhar|pan(_|\b)|dob|date_of_birth|phone|email|card_?number|cvv|otp|signature|razorpay_signature|secret|token|gst|account_?number|ifsc)/i;

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

  const expoVersion = (Constants?.expoConfig?.version as string) || '1.0.0';
  const release = `prayana-vendor@${expoVersion}`;
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
    enabled: !__DEV__,
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
      } catch {}
      return event;
    },
  });

  initialized = true;
}

export function setSentryUser(uid: string | null, _email?: string | null) {
  if (!uid) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: uid });
}

export { Sentry };
