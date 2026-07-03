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
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'auto_refunded'
  | 'no_show'
  | 'payment_pending';

export type PaymentMethod = 'razorpay' | 'stripe' | 'paypal' | 'upi' | 'cash' | 'pending';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'refunded'
  | 'partially_refunded'
  | 'failed';

export type StatusChangedBy = 'customer' | 'business' | 'system';

export type ParticipantGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type ChildGender = 'male' | 'female' | 'other';

// ---------------------------------------------------------------------------
// Payment gateway types
// ---------------------------------------------------------------------------

export type PaymentGateway = 'razorpay' | 'stripe' | 'paypal' | 'manual';

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
  customerFirebaseUid: string;
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
