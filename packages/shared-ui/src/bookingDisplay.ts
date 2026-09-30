// Display helpers for booking / payment enums, shared by the customer, vendor
// and support apps so every screen labels them the same way.
//
// Partner Point (reseller) bookings — server/models/shared/resellerBookedVia.js:
//   - bookedVia.channel === 'reseller'; paid from the shop's prepaid wallet, so
//     payment.method (or installments[].method on packages) is 'partner_wallet'.
//   - customerName / customerPhone hold the WALK-IN customer (email may be
//     empty); customerFirebaseUid is the SHOP's uid.
//   - bookedVia.resellerCommission is the shop's margin. The vendor app must
//     never show it — use withoutResellerMargin() on anything it loads.
//
// The shapes below are structural on purpose, so each screen can pass its own
// local booking interface without depending on @prayana/shared-types.

export type DisplayBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface BookedViaLike {
  channel?: string | null;
}

export interface WalletPaymentLike {
  bookedVia?: BookedViaLike | null;
  payment?: {
    method?: string | null;
    installments?: Array<{ method?: string | null } | null> | null;
  } | null;
}

/** 'partially_refunded' -> 'Partially refunded'. Empty for a missing value. */
export function humanizeEnum(value?: string | null): string {
  if (!value) return '';
  const text = String(value).replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '';
}

/** Sold by a Partner Point shop for a walk-in customer. */
export function isPartnerPointBooking(b?: { bookedVia?: BookedViaLike | null } | null): boolean {
  return b?.bookedVia?.channel === 'reseller';
}

/**
 * Paid from a Partner Point wallet. Such a booking is already paid — never show
 * it a "Pay now" / retry-payment action or a Razorpay label.
 */
export function isPartnerWalletPaid(b?: WalletPaymentLike | null): boolean {
  if (!b) return false;
  if (b.payment?.method === 'partner_wallet') return true;
  return (b.payment?.installments ?? []).some((i) => i?.method === 'partner_wallet');
}

/** Either signal — use this to suppress customer-side payment prompts. */
export function isPaidByPartnerPoint(b?: WalletPaymentLike | null): boolean {
  return isPartnerPointBooking(b) || isPartnerWalletPaid(b);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  partner_wallet: 'Partner Point wallet',
  razorpay: 'Online (Razorpay)',
  stripe: 'Card',
  paypal: 'PayPal',
  upi: 'UPI',
  cash: 'Cash',
  card: 'Card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  manual: 'Manual',
};

/**
 * Human label for payment.method / PaymentTransaction.gateway. Returns null for
 * "no method yet" ('pending' / empty) so the caller can hide the row.
 */
export function paymentMethodLabel(method?: string | null): string | null {
  if (!method || method === 'pending') return null;
  return PAYMENT_METHOD_LABELS[method] ?? humanizeEnum(method);
}

const PAYMENT_STATUS_DISPLAY: Record<string, { label: string; variant: DisplayBadgeVariant }> = {
  unpaid: { label: 'Unpaid', variant: 'warning' },
  pending: { label: 'Pending', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  partially_paid: { label: 'Partially paid', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'error' },
  refund_pending: { label: 'Refund pending', variant: 'warning' },
  refunded: { label: 'Refunded', variant: 'default' },
  partially_refunded: { label: 'Partially refunded', variant: 'info' },
  failed: { label: 'Failed', variant: 'error' },
};

/** Label + badge variant for payment.status (every model's vocabulary). */
export function paymentStatusDisplay(status?: string | null): { label: string; variant: DisplayBadgeVariant } {
  if (!status) return { label: 'Pending', variant: 'warning' };
  return PAYMENT_STATUS_DISPLAY[status] ?? { label: humanizeEnum(status), variant: 'default' };
}

export interface BookingContactLike {
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  contactInfo?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  customer?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

function clean(v?: string | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

/**
 * The traveller on a booking. For a Partner Point booking the customer* fields
 * hold the walk-in customer, so they win over anything account-derived.
 */
export function bookingCustomer(b?: BookingContactLike | null): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  if (!b) return { name: null, phone: null, email: null };
  const fullName = [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(' ');
  return {
    name: clean(b.customerName) ?? clean(b.contactInfo?.name) ?? clean(fullName) ?? clean(b.customer?.name),
    phone: clean(b.customerPhone) ?? clean(b.contactInfo?.phone) ?? clean(b.customer?.phone),
    email: clean(b.customerEmail) ?? clean(b.contactInfo?.email) ?? clean(b.customer?.email),
  };
}

/**
 * Vendor-app guard: drop the Partner Point shop's margin (resellerCommission,
 * and shopSellingPrice for net-rate deals) from a booking before it reaches
 * state. Returns the input untouched when there is nothing to strip.
 */
export function withoutResellerMargin<T>(b: T): T {
  if (!b || typeof b !== 'object') return b;
  const bv = (b as { bookedVia?: unknown }).bookedVia;
  if (!bv || typeof bv !== 'object') return b;
  const { resellerCommission: _rc, shopSellingPrice: _ssp, ...safe } = bv as Record<string, unknown>;
  return { ...(b as object), bookedVia: safe } as T;
}

/** withoutResellerMargin() over a list (non-arrays come back as []). */
export function listWithoutResellerMargin<T>(list: T[] | unknown): T[] {
  return Array.isArray(list) ? (list as T[]).map((b) => withoutResellerMargin(b)) : [];
}
