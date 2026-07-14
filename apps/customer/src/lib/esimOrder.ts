// eSIM order helpers — the order-side counterpart of lib/esim.ts.
//
// Field names here are taken from the server model (server/models/EsimOrder.js),
// not guessed. Note `fulfillment` has TWO Ls: the previous my-orders screen read
// `order.fulfilment`, which is always undefined, so the QR code it tried to show
// could never render.

export type EsimOrderStatus =
  | 'pending_payment'
  | 'pending_kyc'
  | 'pending_validation'
  | 'processing'
  | 'active'
  | 'completed'
  | 'failed'
  | 'refunded';

export type BundleState =
  | 'pending'
  | 'available'
  | 'in_use'
  | 'depleted'
  | 'expired'
  | 'unknown'
  | null;

export interface EsimFulfillment {
  providerOrderId?: string | null;
  iccid?: string | null;
  smdpAddress?: string | null;
  activationCode?: string | null;
  installUrl?: string | null;
  base64QRCode?: string | null;
  mobileNumber?: string | null;
  simNumber?: string | null;
  bundleState?: BundleState;
  remainingDataMB?: number | null;
}

export interface EsimKyc {
  required?: boolean;
  status?: 'not_required' | 'pending' | 'submitted' | 'approved' | 'rejected';
  documents?: Array<{ type: string; fileUrl: string }>;
}

export interface EsimOrder {
  _id: string;
  orderReference?: string;
  status: EsimOrderStatus;
  provider?: string;
  createdAt?: string;

  bundle?: {
    name?: string;
    country?: string;
    countryName?: string;
    dataAmountMB?: number;
    durationDays?: number;
    isUnlimited?: boolean;
  };

  pricing?: { sellingPrice?: number };
  payment?: { status?: string; paidAt?: string };

  fulfillment?: EsimFulfillment;
  /** Legacy eSIM Go orders carry the same identifiers under a different key. */
  esimGo?: EsimFulfillment & { qrCodeUrl?: string | null };

  kyc?: EsimKyc;
}

/** Resolve the install identifiers across the current and legacy providers. */
export function resolveEsim(order: EsimOrder) {
  const f = order.fulfillment ?? {};
  const legacy = order.esimGo ?? {};
  const iccid = f.iccid || legacy.iccid || null;
  return {
    iccid,
    simNumber: f.simNumber || iccid,
    installUrl: f.installUrl || legacy.installUrl || null,
    smdpAddress: f.smdpAddress || legacy.smdpAddress || null,
    activationCode: f.activationCode || legacy.activationCode || null,
    base64QRCode: f.base64QRCode || null,
    mobileNumber: f.mobileNumber || null,
    isMatrix: (order.provider || '').toLowerCase() === 'matrix',
  };
}

export interface StatusStyle {
  label: string;
  fg: string;
  bg: string;
  dot: string;
}

/**
 * All EIGHT statuses the server can emit.
 *
 * The web's two order screens disagree — its list page knows only six and drops
 * pending_kyc and pending_validation into "Processing", which hides from the
 * customer that THEY need to act. One table, used by both screens here.
 */
export const STATUS_STYLES: Record<EsimOrderStatus, StatusStyle> = {
  pending_payment: { label: 'Payment pending', fg: '#B45309', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  pending_kyc: { label: 'KYC required', fg: '#B45309', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  pending_validation: { label: 'Validating', fg: '#B45309', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  processing: { label: 'Processing', fg: '#1D4ED8', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
  active: { label: 'Active', fg: '#047857', bg: 'rgba(16,185,129,0.12)', dot: '#10B981' },
  completed: { label: 'Completed', fg: '#475569', bg: 'rgba(148,163,184,0.16)', dot: '#94A3B8' },
  failed: { label: 'Failed', fg: '#E61417', bg: 'rgba(230,20,23,0.10)', dot: '#E61417' },
  refunded: { label: 'Refunded', fg: '#6D28D9', bg: 'rgba(139,92,246,0.12)', dot: '#8B5CF6' },
};

export function statusStyle(status?: string): StatusStyle {
  return STATUS_STYLES[(status as EsimOrderStatus) ?? 'processing'] ?? STATUS_STYLES.processing;
}

/** Data used vs remaining, or null when the eSIM has not connected anywhere yet. */
export function usageOf(f: EsimFulfillment | undefined, totalMB?: number) {
  const state = f?.bundleState;
  const remaining = f?.remainingDataMB;
  // "unknown"/absent state means the eSIM has never attached to a network. A
  // 0%-used bar would imply it is live and idle, which is a different thing.
  if (!state || state === 'unknown' || !totalMB || typeof remaining !== 'number') return null;

  const used = Math.max(0, totalMB - remaining);
  return {
    state,
    usedMB: used,
    remainingMB: remaining,
    totalMB,
    percent: Math.min(100, Math.round((used / totalMB) * 100)),
  };
}
