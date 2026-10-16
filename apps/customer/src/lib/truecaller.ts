// Truecaller one-tap login — native counterpart of the web's utils/truecaller.js.
//
// Uses Truecaller's "mobile websites" flow, which the server already runs
// (routes/auth.js /truecaller/*, services/truecallerService.js): we fire the
// truecallersdk:// deep link, Truecaller shows its sheet over the app, and on
// Continue it POSTs the user's verified profile to our server. We poll for the
// outcome. No native SDK, so this ships over the air.
//
// Android only, and only with Truecaller installed. Everywhere else the user
// simply continues with SMS OTP.
import { Linking, Platform } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { makeAPICall } from '@prayana/shared-services';

const APP_KEY = process.env.EXPO_PUBLIC_TRUECALLER_APP_KEY || '';
const SITE = 'https://prayanaai.com';

export const TRUECALLER_POLL_MS = 1500;
// Until Truecaller reports the sheet was shown ("flow_invoked") we give up fast;
// once it has, the user gets the full two minutes to decide.
export const TRUECALLER_UNACKED_WINDOW_MS = 10 * 1000;
export const TRUECALLER_ACKED_WINDOW_MS = 2 * 60 * 1000;

export type TruecallerSession = { requestNonce: string; pollSecret: string };

export function canUseTruecaller(): boolean {
  return Platform.OS === 'android' && !!APP_KEY;
}

// 48 hex chars — inside Truecaller's 8–64 nonce limit and the server's
// [A-Za-z0-9_-] alphabet.
function randomToken(): string {
  return Array.from(getRandomBytes(24), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Open the Truecaller sheet. Resolves null when Truecaller isn't installed
 * (Android rejects a scheme nothing handles).
 */
export async function openTruecaller(): Promise<TruecallerSession | null> {
  const session = { requestNonce: randomToken(), pollSecret: randomToken() };
  const params: Record<string, string> = {
    type: 'btmsheet',
    requestNonce: session.requestNonce,
    partnerKey: APP_KEY,
    partnerName: 'Prayana AI',
    lang: 'en',
    privacyUrl: `${SITE}/privacy`,
    termsUrl: `${SITE}/terms`,
    loginPrefix: 'continue',
    loginSuffix: 'loginsignup',
    ctaPrefix: 'continuewith',
    ctaColor: '#2EC4B6',
    ctaTextColor: '#FFFFFF',
    btnShape: 'round',
    skipOption: 'useanothernum',
  };
  // Built by hand: React Native's URLSearchParams polyfill is incomplete.
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  try {
    await Linking.openURL(`truecallersdk://truesdk/web_verify?${query}`);
  } catch {
    return null;
  }
  return session;
}

/** Register the session so the server will accept Truecaller's callback for it. */
export async function startTruecallerLogin(session: TruecallerSession): Promise<void> {
  try {
    await makeAPICall('/auth/truecaller/start', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  } catch {
    // Polling reports the failure; nothing to do here.
  }
}

export type TruecallerStatus = {
  status: string;
  customToken?: string | null;
  user?: { name?: string; phone?: string } | null;
};

/**
 * One poll. Network blips report "pending" so the caller keeps polling.
 * "verified" carries the Firebase custom token and the (possibly new) user.
 */
export async function checkTruecallerLogin(session: TruecallerSession): Promise<TruecallerStatus> {
  try {
    const data: any = await makeAPICall('/auth/truecaller/status', {
      method: 'POST',
      body: JSON.stringify(session),
    });
    if (!data?.success) return { status: 'failed' };
    return { status: data.status, customToken: data.customToken, user: data.user };
  } catch {
    return { status: 'pending' };
  }
}

/** True while the user may still approve in Truecaller. */
export function isTruecallerPending(status: string): boolean {
  return status === 'pending' || status === 'flow_invoked';
}
