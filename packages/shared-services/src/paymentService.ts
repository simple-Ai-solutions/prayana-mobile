/**
 * Razorpay payment service for Prayana mobile apps.
 *
 * Used by: Activity booking, Hotel booking, eSIM checkout, Holiday Packages.
 * Single source of truth for all customer payment flows.
 *
 * Flow (industry standard for Razorpay):
 *   1. Caller already has a backend booking + order id (server creates Razorpay order)
 *   2. openCheckout() opens the native Razorpay UI sheet with that order id
 *   3. On success: server-side verify (signature check) is the source of truth — never trust client
 *   4. Caller calls bookingAPI.verifyPayment() with the {orderId, paymentId, signature}
 *
 * Server already exposes:
 *   POST /bookings/:id/payment/create-order  → { orderId, amount, currency, key }
 *   POST /bookings/:id/payment/verify        → verifies signature, marks booking confirmed
 *   POST /bookings/:id/payment/refund        → refunds (full or partial)
 */

import { Platform } from 'react-native';

// react-native-razorpay is a native module. We import lazily so the rest of
// the app still bundles on web and during tests where the native side is absent.
type RazorpayCheckout = {
  open: (options: RazorpayOptions) => Promise<RazorpaySuccess>;
};

let _razorpay: RazorpayCheckout | null = null;
function getRazorpay(): RazorpayCheckout {
  if (_razorpay) return _razorpay;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RazorpayCheckoutModule = require('react-native-razorpay');
    _razorpay = RazorpayCheckoutModule.default || RazorpayCheckoutModule;
    return _razorpay!;
  } catch (err) {
    throw new Error(
      'Razorpay native module is not linked. Run `npx expo prebuild` and rebuild the app.',
    );
  }
}

export type RazorpayOptions = {
  /** Razorpay publishable key (rzp_test_… or rzp_live_…) */
  key: string;
  /** Order id returned by the server (order_xxx). REQUIRED for production keys. */
  order_id: string;
  /** Amount in smallest currency unit (paise for INR). */
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
  /** Lets us track which booking this payment belongs to in webhook payloads. */
  notes?: Record<string, string>;
};

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayError = {
  code: number | string;
  description: string;
};

export type PaymentResult =
  | { status: 'success'; paymentId: string; orderId: string; signature: string }
  | { status: 'cancelled'; reason: string }
  | { status: 'failed'; reason: string; code?: number | string };

const BRAND_NAME = 'Prayana AI';
// No `image` is passed to Razorpay deliberately: the sheet shows the merchant
// name on its own, which reads cleaner than the logo did at that size. Note
// that setting `image` to an unreachable URL is NOT the same as omitting it —
// Razorpay then falls back to the first letter of `name` and draws a bare "P",
// which is what the old (non-existent) /logo.png produced.

/**
 * Opens the Razorpay checkout sheet. Returns a normalized PaymentResult.
 * Never throws — always returns a result the caller can branch on.
 */
export async function openCheckout(opts: {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency?: string;
  name?: string;
  description?: string;
  themeColor?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  notes?: Record<string, string>;
}): Promise<PaymentResult> {
  const {
    keyId,
    orderId,
    amountInPaise,
    currency = 'INR',
    name = BRAND_NAME,
    description = 'Booking payment',
    themeColor = '#f97316',
    prefill,
    notes,
  } = opts;

  if (!keyId) {
    return { status: 'failed', reason: 'Razorpay key id missing in env' };
  }
  if (!orderId) {
    return { status: 'failed', reason: 'Order id missing — create-order failed' };
  }

  const options: RazorpayOptions = {
    key: keyId,
    order_id: orderId,
    amount: amountInPaise,
    currency,
    name,
    description,
    prefill,
    theme: { color: themeColor },
    notes,
  };

  try {
    const Razorpay = getRazorpay();
    const result = await Razorpay.open(options);
    return {
      status: 'success',
      paymentId: result.razorpay_payment_id,
      orderId: result.razorpay_order_id,
      signature: result.razorpay_signature,
    };
  } catch (err: unknown) {
    return classifyError(err as RazorpayError);
  }
}

// The native SDKs number their errors differently. Android (com.razorpay.
// Checkout): PAYMENT_CANCELED = 0, NETWORK_ERROR = 2. iOS: cancelled = 2,
// network error = 0. Reading 2 as "cancelled" everywhere meant that pressing
// back on Android came through as a failure, and the raw error shown.
const CANCEL_CODE = Platform.OS === 'android' ? 0 : 2;
const NETWORK_CODE = Platform.OS === 'android' ? 2 : 0;

/**
 * Android hands over `description` as the gateway's JSON
 * ({"error":{"code":"BAD_REQUEST_ERROR","description":"…","reason":"payment_cancelled"}}),
 * which must never reach the screen. Pull out the readable parts.
 */
function readGatewayError(description: unknown): { text: string; reason: string } {
  const raw = typeof description === 'string' ? description.trim() : '';
  if (raw.startsWith('{')) {
    try {
      const j = JSON.parse(raw);
      const inner = j?.error ?? j;
      return { text: String(inner?.description ?? ''), reason: String(inner?.reason ?? '') };
    } catch {
      return { text: '', reason: '' };
    }
  }
  return { text: raw, reason: '' };
}

function classifyError(e: RazorpayError): PaymentResult {
  const { text, reason } = readGatewayError(e?.description);
  if (e?.code === CANCEL_CODE || /cancel/i.test(`${reason} ${text}`)) {
    return { status: 'cancelled', reason: 'Payment cancelled' };
  }
  if (e?.code === NETWORK_CODE) {
    return { status: 'failed', code: e?.code, reason: 'Network problem. Check your connection and try again.' };
  }
  // A readable gateway sentence ("Your payment didn't go through…") is fine
  // to show; codes, JSON and "undefined" are not.
  const readable = text && text !== 'undefined' && !/^[A-Z_]+$/.test(text) && text.length < 160;
  return {
    status: 'failed',
    code: e?.code,
    reason: readable ? text : 'Your payment did not go through. Please try again.',
  };
}

/**
 * Convenience wrapper: rupees → paise. Razorpay only accepts integer paise.
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
