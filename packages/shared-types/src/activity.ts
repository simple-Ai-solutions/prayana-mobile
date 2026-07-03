/**
 * Activity marketplace type definitions for Prayana AI mobile app.
 * Derived from server/models/ActivityListing.js, ActivityVariant.js,
 * ActivityReview.js, and TimeSlot.js MongoDB schemas.
 */

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type ActivityCategory =
  | 'Adventure'
  | 'Cultural'
  | 'Food & Dining'
  | 'Water Sports'
  | 'Wildlife'
  | 'City Tours'
  | 'Spiritual'
  | 'Wellness'
  | 'Photography'
  | 'Nightlife'
  | 'Shopping'
  | 'Historical'
  | 'Other';

export type DurationUnit = 'hours' | 'days';

export type PriceType = 'per_person' | 'per_group' | 'flat';

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'non_refundable' | 'custom';

export type ActivityStatus = 'draft' | 'active' | 'paused' | 'archived';

export type RefundMethod = 'original' | 'wallet' | 'both';

export type ActivityDocumentStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type DiscountType = 'percent' | 'fixed';

export type VariantName =
  | 'Standard'
  | 'VIP'
  | 'Private'
  | 'Deluxe'
  | 'Premium'
  | 'Budget'
  | 'Custom';

// ---------------------------------------------------------------------------
// Shared sub-types
// ---------------------------------------------------------------------------

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ActivityImage {
  _id?: string;
  url: string;
  caption?: string | null;
  isPrimary: boolean;
  order: number;
}

// ---------------------------------------------------------------------------
// ActivityListing nested interfaces
// ---------------------------------------------------------------------------

export interface AvailabilitySlot {
  _id?: string;
  /** 0=Sunday ... 6=Saturday; null for date-specific slots */
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  maxSlots: number;
  bookedSlots: number;
  isBlocked: boolean;
}

export interface ActivityDuration {
  value: number;
  unit: DurationUnit;
  label?: string | null;
}

export interface ActivityGroupSize {
  min: number;
  max: number;
}

export interface ActivityLocation {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  meetingPoint?: string | null;
  coordinates: Coordinates;
  /** Google Places ID */
  placeId?: string | null;
  formattedAddress?: string | null;
}

export interface BulkDiscount {
  minParticipants: number;
  maxParticipants: number;
  discountPercent: number;
  discountType: DiscountType;
  fixedDiscountAmount: number;
}

export interface SeasonalPricing {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  /** Days of week (0=Sun ... 6=Sat) when this pricing applies */
  daysOfWeek: number[];
  /** Multiplier: 1.2 = 20% more expensive */
  priceModifier: number;
  isActive: boolean;
}

export interface DateOverride {
  date: string;
  price: number;
  reason: string;
}

export interface ActivityPricing {
  basePrice: number;
  currency: string;
  priceType: PriceType;
  childPrice?: number | null;
  includesWhat: string[];
  excludesWhat: string[];
  bulkDiscounts: BulkDiscount[];
  seasonalPricing: SeasonalPricing[];
  dateOverrides: DateOverride[];
}

export interface InstantBookingConfig {
  enabled: boolean;
  requiresManualConfirmation: boolean;
  /** Delay in minutes before auto-confirm; 0 = instant */
  autoConfirmDelay: number;
  /** If participant count exceeds this, requires manual confirmation */
  maxAutoConfirmParticipants: number;
}

export interface RefundRule {
  daysBeforeActivity?: number;
  hoursBeforeActivity?: number;
  refundPercent: number;
  cancellationFee: number;
}

export interface CancellationPolicyRules {
  refundRules: RefundRule[];
  refundProcessingDays: number;
  refundMethod: RefundMethod;
  forceMajeureFullRefund: boolean;
}

export interface ActivityRatingDistribution {
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
}

export interface ActivityRating {
  average: number;
  count: number;
  distribution: ActivityRatingDistribution;
}

export interface ActivityStats {
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  viewCount: number;
  favoriteCount: number;
}

export interface ActivityDocument {
  _id?: string;
  docKey: string;
  label?: string | null;
  url: string;
  uploadedAt: string;
  expiryDate?: string | null;
  status: ActivityDocumentStatus;
  rejectionReason?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface SafetyDeclarations {
  hasInsurance: boolean;
  insurancePolicyNumber?: string | null;
  insuranceExpiryDate?: string | null;
  hasCertifiedInstructors: boolean;
  certificationDetails?: string | null;
  hasEmergencyPlan: boolean;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  hasFirstAidKit: boolean;
  requiresWaiver: boolean;
  waiverTemplateUrl?: string | null;
  minimumAge?: number | null;
  fitnessRequirements?: string | null;
  riskDisclosure?: string | null;
}

// ---------------------------------------------------------------------------
// Main ActivityListing interface
// ---------------------------------------------------------------------------

export interface ActivityListing {
  _id: string;
  business: string;
  businessFirebaseUid: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string | null;
  /** 1-3 categories */
  category: ActivityCategory[];
  primaryCategory?: ActivityCategory;
  tags: string[];
  /** Type-specific fields, structure varies by category */
  typeSpecificFields: Record<string, unknown>;
  activityDocuments: ActivityDocument[];
  safetyDeclarations: SafetyDeclarations;
  /** Cached filterable fields from typeSpecificFields */
  typeFilterCache: Record<string, unknown>;
  duration: ActivityDuration;
  groupSize: ActivityGroupSize;
  location: ActivityLocation;
  enhancedLocation?: string | null;
  pricing: ActivityPricing;
  images: ActivityImage[];
  videoUrl?: string | null;
  availabilitySchedule: AvailabilitySlot[];
  hasMultipleTimeSlots: boolean;
  defaultCapacityPerSlot: number;
  advanceBookingDays: number;
  instantBooking: InstantBookingConfig;
  cancellationPolicy: CancellationPolicy;
  cancellationPolicyDetail?: string | null;
  cancellationPolicyRules: CancellationPolicyRules;
  status: ActivityStatus;
  isApproved: boolean;
  rejectionReason?: string | null;
  rating: ActivityRating;
  stats: ActivityStats;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// ActivityVariant
// ---------------------------------------------------------------------------

export interface VariantPricing {
  basePrice: number;
  /** Multiplier: 1.0 = same as activity base, 1.5 = 50% more */
  priceModifier: number;
  childPrice: number;
  priceType: PriceType;
  currency: string;
}

export interface VariantCapacity {
  min: number;
  max: number;
  defaultCapacity: number;
}

export interface VariantImage {
  url: string;
  isPrimary: boolean;
  caption: string;
}

export interface ActivityVariant {
  _id: string;
  activity: string;
  name: VariantName;
  /** For "Custom" variant type, business-provided name */
  customName: string;
  displayOrder: number;
  description: string;
  highlights: string[];
  pricing: VariantPricing;
  capacity: VariantCapacity;
  includes: string[];
  excludes: string[];
  images: VariantImage[];
  isAvailable: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  bookingCount: number;
  popularity: number;
  isFeatured: boolean;
  tags: string[];
  /** Virtual: resolved display name (customName or name) */
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// ActivityReview
// ---------------------------------------------------------------------------

export interface ReviewReply {
  body?: string | null;
  repliedAt?: string | null;
}

export interface ReviewerInfo {
  firebaseUid: string;
  name: string;
  avatar?: string | null;
}

export interface ActivityReview {
  _id: string;
  activity: string;
  booking: string;
  reviewer: ReviewerInfo;
  rating: number;
  title?: string | null;
  body?: string | null;
  photos: string[];
  tags: string[];
  helpfulVotes: number;
  isVerified: boolean;
  isPublished: boolean;
  reply: ReviewReply;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// TimeSlot
// ---------------------------------------------------------------------------

export interface TimeSlot {
  _id: string;
  activity: string;
  /** For date-specific slots; null for recurring weekly slots */
  date: string | null;
  /** For recurring slots: 0=Sunday ... 6=Saturday; null for date-specific */
  dayOfWeek: number | null;
  /** Format: "09:00", "14:30" */
  startTime: string;
  endTime: string;
  label: string;
  capacity: number;
  booked: number;
  available: number;
  /** Optional link to an ActivityVariant */
  variantId?: string | null;
  /** Price multiplier: 1.0 = base, 1.2 = 20% more */
  priceModifier: number;
  isBlocked: boolean;
  blockReason: string;
  /** Virtual: whether slot is at full capacity */
  isFull?: boolean;
  createdAt: string;
  updatedAt: string;
}
