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
const BRAND_LOGO_URL = 'https://prayanaai.com/logo.png';

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
    image: BRAND_LOGO_URL,
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
    const e = err as RazorpayError;
    // Razorpay returns code 0 / 'BAD_REQUEST_ERROR' / etc. Code 2 = user cancelled.
    if (e?.code === 2 || /cancel/i.test(e?.description || '')) {
      return { status: 'cancelled', reason: e?.description || 'User cancelled payment' };
    }
    return {
      status: 'failed',
      code: e?.code,
      reason: e?.description || 'Payment failed. Please try again.',
    };
  }
}

/**
 * Convenience wrapper: rupees → paise. Razorpay only accepts integer paise.
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
