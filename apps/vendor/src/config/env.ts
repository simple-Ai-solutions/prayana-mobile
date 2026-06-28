/**
 * Centralized, type-safe access to env variables for the vendor app.
 *
 * Why this exists:
 *  - One place to read process.env — easy to audit, easy to mock in tests.
 *  - Required vars fail loudly at startup, not silently at runtime.
 *  - All consumers get autocomplete + type safety.
 *
 * Rotating a key: edit `.env`, restart Metro with `--clear`. No code changes.
 */

type Env = {
  apiUrl: string;
  socketUrl: string;

  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };

  googleAuth: {
    iosClientId: string;
    androidClientId: string;
    webClientId: string;
  };

  googleMapsApiKey: string;

  s3BaseUrl: string;
  cdnUrl: string;

  // Vendor uses Razorpay only for payouts UI / receipt display, not direct charging.
  razorpayKeyId: string;

  enquiryWhatsapp: string;
  enquiryEmail: string;

  gaMeasurementId: string;
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    if (__DEV__) {
      throw new Error(
        `[env] Missing required env var: ${name}. Check apps/vendor/.env`,
      );
    }
    console.warn(`[env] Missing env var: ${name}`);
    return '';
  }
  return value;
}

export const ENV: Env = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  socketUrl: required(
    'EXPO_PUBLIC_SOCKET_URL',
    process.env.EXPO_PUBLIC_SOCKET_URL,
  ),

  firebase: {
    apiKey: required(
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: required(
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: required(
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: required(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: required(
      'EXPO_PUBLIC_FIREBASE_APP_ID',
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    ),
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  },

  googleAuth: {
    iosClientId: required(
      'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    ),
    androidClientId: required(
      'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ),
    webClientId: required(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ),
  },

  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  s3BaseUrl: process.env.EXPO_PUBLIC_S3_BASE_URL || '',
  cdnUrl: process.env.EXPO_PUBLIC_CDN_URL || '',

  razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',

  enquiryWhatsapp: process.env.EXPO_PUBLIC_ENQUIRY_WHATSAPP || '',
  enquiryEmail: process.env.EXPO_PUBLIC_ENQUIRY_EMAIL || '',

  gaMeasurementId: process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID || '',
};

export const API_URL = ENV.apiUrl;
export const SOCKET_URL = ENV.socketUrl;
