// useStayPayment — paying for a stay booking with Razorpay, shared by the
// checkout (first payment) and the booking screen ("Pay now" on a booking
// still on hold). Same order of steps as the web's useStayPayment:
//
//   1. ensureBooking() — the caller creates the booking (or hands back the one
//      it holds); it reports its own errors and returns null to stop;
//   2. create the order (the server reuses one if the booking has it);
//   3. open Razorpay (openCheckout never throws: success | cancelled | failed);
//   4. verify, then onPaid(confirmed booking).
//
// Razorpay's webhook confirms the booking on its own too, so a verify call
// that fails on a dropped connection is not lost money — callers send the
// guest to the booking screen, which shows whatever the server settled on.
import { useCallback, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { staysAPI, openCheckout } from '@prayana/shared-services';
import { ENV } from '../../config/env';
import { asApiError, errorCode, errorText, type StayBooking } from '../../lib/stays';

export type PayPhase = 'idle' | 'starting' | 'open' | 'verifying';

export type PayProblem = {
  stage: 'order' | 'verify';
  code: string | null;
  status?: number;
  message: string;
};

type HeldBooking = { id: string; reference?: string };

type StartArgs = {
  ensureBooking: () => Promise<HeldBooking | null>;
  prefill?: { name?: string; email?: string; phone?: string };
  onPaid: (booking: StayBooking | null, bookingId: string) => void;
  /** The guest closed the payment sheet (or the payment failed); the hold stays. */
  onDismiss?: (bookingId: string) => void;
  onProblem: (p: PayProblem, bookingId: string) => void;
};

export function useStayPayment() {
  const [phase, setPhase] = useState<PayPhase>('idle');
  // A double tap must not open two payment sheets (or create two bookings).
  const lock = useRef(false);

  const startPayment = useCallback(async ({ ensureBooking, prefill = {}, onPaid, onDismiss, onProblem }: StartArgs) => {
    if (lock.current) return;
    lock.current = true;
    setPhase('starting');
    const finish = () => {
      lock.current = false;
      setPhase('idle');
    };

    let booking: HeldBooking | null = null;
    try {
      booking = await ensureBooking();
    } catch {
      booking = null;
    }
    if (!booking?.id) {
      finish();
      return;
    }
    const bookingId = booking.id;

    let order: { orderId?: string; amount?: number; currency?: string; keyId?: string; reference?: string } | null = null;
    try {
      order = (await staysAPI.createPaymentOrder(bookingId))?.data || null;
    } catch (e) {
      finish();
      onProblem(
        {
          stage: 'order',
          code: errorCode(e),
          status: asApiError(e).status,
          message: errorText(e, "Couldn't start the payment. Please try again."),
        },
        bookingId,
      );
      return;
    }
    if (!order?.orderId || !order.amount) {
      finish();
      Toast.show({ type: 'error', text1: "Couldn't start the payment", text2: 'Please try again.' });
      return;
    }

    setPhase('open');
    const reference = order.reference || booking.reference || '';
    const result = await openCheckout({
      keyId: order.keyId || ENV.razorpayKeyId,
      orderId: order.orderId,
      amountInPaise: order.amount,
      currency: order.currency || 'INR',
      description: `Stay ${reference}`.trim(),
      prefill: { name: prefill.name || '', email: prefill.email || '', contact: prefill.phone || '' },
      notes: { bookingType: 'stay', bookingId, reference },
    });

    if (result.status === 'cancelled') {
      finish();
      onDismiss?.(bookingId);
      return;
    }
    if (result.status === 'failed') {
      finish();
      Toast.show({
        type: 'error',
        text1: "That payment didn't go through",
        text2: result.reason || 'You can try again.',
      });
      onDismiss?.(bookingId);
      return;
    }

    setPhase('verifying');
    try {
      const res = await staysAPI.verifyPayment(bookingId, {
        razorpayPaymentId: result.paymentId,
        razorpaySignature: result.signature,
      });
      // Stays "verifying": the caller is about to navigate or swap the screen
      // over to the confirmed booking.
      lock.current = false;
      onPaid((res?.data as StayBooking) || null, bookingId);
    } catch (e) {
      finish();
      onProblem(
        {
          stage: 'verify',
          code: errorCode(e),
          status: asApiError(e).status,
          message: errorText(e, "We couldn't confirm your payment yet."),
        },
        bookingId,
      );
    }
  }, []);

  /** Back to idle after onPaid, once the caller has shown the result. */
  const reset = useCallback(() => {
    lock.current = false;
    setPhase('idle');
  }, []);

  return { startPayment, phase, busy: phase !== 'idle', reset };
}

/**
 * Lets go of an unpaid hold so its rooms go back on sale now rather than at
 * the next sweep. Best effort: a hold that's already gone is fine. The server
 * refuses (ALREADY_PAID) when a payment for the hold came through unverified
 * and confirms it instead — then this resolves { alreadyPaid: true }, so the
 * caller sends the guest to that booking rather than making a second one.
 */
export async function releaseHold(id: string | null | undefined, reason: string): Promise<{ alreadyPaid?: boolean }> {
  if (!id) return {};
  try {
    await staysAPI.cancelBooking(id, reason);
    return {};
  } catch (e) {
    return errorCode(e) === 'ALREADY_PAID' ? { alreadyPaid: true } : {};
  }
}
