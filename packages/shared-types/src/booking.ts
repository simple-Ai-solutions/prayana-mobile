/**
 * Booking and payment type definitions for Prayana AI mobile app.
 * Derived from server/models/Booking.js, PaymentTransaction.js,
 * and Message.js MongoDB schemas.
 */

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type BookingStatus =
  | 'pending'
  /** Headout: created uncaptured, awaiting our payment + capture. */
  | 'pending_capture'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'auto_refunded'
  | 'no_show'
  | 'payment_pending';

/**
 * `partner_wallet` = a Partner Point (reseller) shop paid from its prepaid
 * wallet. Such a booking is already paid — never offer it a "Pay now".
 */
export type PaymentMethod =
  | 'razorpay'
  | 'stripe'
  | 'paypal'
  | 'upi'
  | 'cash'
  | 'partner_wallet'
  | 'pending';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  /** Advance paid, balance (`pendingAmount`) still owed. */
  | 'partially_paid'
  /** Cabs: refund recorded but the gateway has not confirmed it yet. */
  | 'refund_pending'
  | 'refunded'
  | 'partially_refunded'
  | 'failed';

export type StatusChangedBy = 'customer' | 'business' | 'system';

export type ParticipantGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type ChildGender = 'male' | 'female' | 'other';

// ---------------------------------------------------------------------------
// Payment gateway types
// ---------------------------------------------------------------------------

export type PaymentGateway = 'razorpay' | 'stripe' | 'paypal' | 'manual' | 'partner_wallet';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'refunded' | 'partially_refunded';

export type TransactionMethod = 'card' | 'netbanking' | 'upi' | 'wallet' | 'cash' | 'other';

export type PayoutStatus =
  | 'not_applicable'
  | 'pending'
  | 'held'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type QualityTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type CommissionSource = 'tier_based' | 'manual_override';

// ---------------------------------------------------------------------------
// Partner Point (reseller) — server/models/shared/resellerBookedVia.js
// Present on Booking, PackageBooking, EsimOrder, TransportBooking, BusBooking.
// ---------------------------------------------------------------------------

export type BookingChannel = 'direct' | 'reseller';

/** `commission` = shop keeps a cut of Prayana's price; `net_rate` = shop paid trade price. */
export type ResellerPricingMode = 'commission' | 'net_rate';

export type ResellerCommissionStatus = 'earned' | 'partially_reversed' | 'reversed';

/**
 * The shop's commission on a reseller booking. Amounts are rupees.
 * NEVER render this in the vendor app — it is the shop's margin, not the
 * operator's business (the server is being changed to stop sending it).
 */
export interface ResellerCommission {
  percent?: number | null;
  flatPerUnit?: number | null;
  units?: number | null;
  baseAmount?: number | null;
  grossAmount?: number | null;
  tdsPercent?: number | null;
  tdsAmount?: number | null;
  netAmount?: number | null;
  walletDebit?: number | null;
  walletCredited?: number | null;
  status?: ResellerCommissionStatus | null;
}

/**
 * "How was this sold". channel `reseller` = a Partner Point shop booked for a
 * walk-in customer and paid from its wallet: customerName/customerPhone hold
 * the WALK-IN customer (email may be empty) and customerFirebaseUid is the
 * SHOP's uid.
 */
export interface BookedVia {
  channel?: BookingChannel | null;
  /** BusinessAccount id of the Partner Point shop. */
  resellerBusiness?: string | null;
  pricingMode?: ResellerPricingMode | null;
  /** net_rate mode only — the shop's own selling price (rupees). */
  shopSellingPrice?: number | null;
  resellerCommission?: ResellerCommission | null;
}

/** What the vendor (operator) app may hold — the shop's margin stripped out. */
export type VendorSafeBookedVia = Omit<BookedVia, 'resellerCommission' | 'shopSellingPrice'>;

// ---------------------------------------------------------------------------
// Booking nested interfaces
// ---------------------------------------------------------------------------

export interface BookingTimeSlot {
  timeSlotId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  label?: string | null;
}

export interface BookingParticipants {
  adults: number;
  children: number;
}

export interface CommissionBreakdown {
  tier?: string | null;
  percentage?: number | null;
  /** Commission amount in paisa */
  amount?: number | null;
  source?: string | null;
}

export interface AgentEarnings {
  grossPayout?: number | null;
  tdsAmount?: number | null;
  netPayout?: number | null;
}

export interface BookingPricing {
  basePrice: number;
  totalAmount: number;
  currency: string;
  /** Arbitrary pricing breakdown details */
  breakdown: Record<string, unknown>;
  commission: CommissionBreakdown;
  agentEarnings: AgentEarnings;
  /**
   * true = the vendor-listed amount is in paisa. Bookings without the flag
   * predate the fix and store it in rupees.
   */
  vendorListedInPaisa?: boolean;
}

export interface StatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy: StatusChangedBy;
  note?: string | null;
}

export interface BookingPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  /** Partial-payment bookkeeping (status `partially_paid`). */
  isPartialPayment?: boolean;
  advanceAmount?: number;
  balanceDueDate?: string | null;
  transactionId?: string | null;
  paidAmount: number;
  pendingAmount: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
  /** Pay within X hours to hold booking */
  dueDate?: string | null;
  refundedAt?: string | null;
  refundAmount: number;
}

export interface PreBookingAnswer {
  questionId: string;
  /** Snapshot of the question text at answer time */
  question: string;
  /** Can be string, number, boolean, or array depending on question type */
  answer: unknown;
  answeredAt: string;
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

export interface AdultParticipant {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: ParticipantGender;
  nationality?: string;
  passportNumber?: string;
  dietaryRestrictions: string[];
  medicalConditions: string[];
  emergencyContact: EmergencyContact;
}

export interface ChildParticipant {
  firstName?: string;
  lastName?: string;
  /** 0-17 */
  age?: number;
  gender?: ChildGender;
  /** Index into the adults array of the same booking */
  guardianIndex?: number;
  dietaryRestrictions: string[];
  medicalConditions: string[];
}

export interface ParticipantDetails {
  adults: AdultParticipant[];
  children: ChildParticipant[];
}

export interface CancellationInfo {
  requestedAt?: string | null;
  requestedBy?: string | null;
  reason?: string | null;
  refundStatus?: string | null;
  /** Rupees. */
  refundAmount?: number | null;
  refundedAt?: string | null;
  refundReference?: string | null;
  /** Set when the refund could not be sent — needs support follow-up. */
  refundError?: string | null;
}

/** Snapshot of activity details at the time of booking (immutable record) */
export interface ActivitySnapshot {
  title?: string;
  category?: string;
  location?: string;
  durationLabel?: string;
  primaryImage?: string;
  businessName?: string;
}

// ---------------------------------------------------------------------------
// Main Booking interface
// ---------------------------------------------------------------------------

export interface Booking {
  _id: string;
  activity: string;
  business: string;
  businessFirebaseUid: string;
  /** For a Partner Point booking this is the SHOP's uid, not the traveller's. */
  customerFirebaseUid: string;
  /** Sold through a Partner Point shop? Absent on older bookings = direct. */
  bookedVia?: BookedVia | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  bookingDate: string;
  timeSlot: BookingTimeSlot;
  participants: BookingParticipants;
  totalParticipants: number;
  pricing: BookingPricing;
  /** Format: PRA-YYYYMMDD-XXXX */
  bookingReference: string;
  status: BookingStatus;
  statusHistory: StatusHistoryEntry[];
  isInstantBooking: boolean;
  instantBookingAppliedAt?: string | null;
  confirmationDeadline?: string | null;
  autoRefundTriggered: boolean;
  autoRefundReason?: string | null;
  payment: BookingPayment;
  specialRequests?: string | null;
  preBookingAnswers: PreBookingAnswer[];
  participantDetails: ParticipantDetails;
  reviewId?: string | null;
  hasReviewed: boolean;
  cancellation: CancellationInfo;
  activitySnapshot: ActivitySnapshot;
  abandonmentNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// PaymentTransaction
// ---------------------------------------------------------------------------

export interface TransactionCommission {
  tier: QualityTier;
  percentage: number;
  /** Amount in paisa */
  amount: number;
  source: CommissionSource;
}

export interface AgentPayout {
  grossPayout: number;
  tdsPercent: number;
  tdsAmount: number;
  netPayout: number;
}

export interface PaymentTransaction {
  _id: string;
  booking: string;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  /** Amount in smallest currency unit (paisa for INR, cents for USD) */
  amount: number;
  currency: string;
  status: TransactionStatus;
  method: TransactionMethod;
  cardLast4: string;
  cardBrand: string;
  errorCode: string;
  errorMessage: string;
  refundId: string;
  refundAmount: number;
  refundReason: string;
  refundedAt?: string | null;
  customerEmail: string;
  customerPhone: string;
  /** Arbitrary metadata from payment gateway */
  gatewayMetadata: Record<string, unknown>;
  commission: TransactionCommission;
  agentPayout: AgentPayout;
  platformFee: number;
  payoutStatus: PayoutStatus;
  payoutHoldUntil?: string | null;
  payoutCompletedAt?: string | null;
  transferId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Booking Message (customer-business messaging)
// ---------------------------------------------------------------------------

export type MessageSender = 'customer' | 'business';

export type MessageAttachmentType = 'image' | 'document' | 'other';

export interface MessageAttachment {
  type: MessageAttachmentType;
  url: string;
  filename?: string;
  /** File size in bytes */
  size?: number;
}

export interface BookingMessage {
  _id: string;
  booking: string;
  sender: MessageSender;
  senderUserId: string;
  senderName: string;
  message: string;
  attachments: MessageAttachment[];
  read: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}
