/**
 * Business account and quality score type definitions for Prayana AI mobile app.
 * Derived from server/models/BusinessAccount.js and SellerQualityScore.js MongoDB schemas.
 */

import type { QualityTier, CommissionSource } from './booking';

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type AccountType = 'company' | 'agent';

export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export type KycTier = 'basic' | 'standard' | 'premium';

export type PayoutMethod = 'bank_transfer' | 'stripe' | 'razorpay' | 'upi';

export type DocumentType =
  // Business-level
  | 'business_license'
  | 'gst'
  | 'aadhaar'
  | 'pan'
  | 'incorporation_certificate'
  | 'professional_tax'
  | 'public_liability_insurance'
  | 'bank_proof'
  | 'msme_udyam'
  // Activity-type-specific
  | 'fssai_license'
  | 'adventure_tourism_license'
  | 'safety_equipment_cert'
  | 'instructor_certification'
  | 'forest_department_permit'
  | 'national_park_license'
  | 'vehicle_rc'
  | 'driver_license'
  | 'vehicle_fitness_cert'
  | 'vehicle_insurance'
  | 'temple_permission'
  | 'therapist_certification'
  | 'hygiene_certificate'
  | 'fire_safety_certificate'
  | 'liquor_license'
  | 'asi_guide_license'
  | 'state_tourism_registration'
  | 'guide_identity_card'
  | 'commercial_vehicle_permit'
  | 'ayurveda_license'
  | 'spa_trade_license'
  | 'photographer_portfolio'
  | 'dgca_drone_license'
  | 'drone_registration'
  | 'other';

export type DocumentStatus =
  | 'pending'
  | 'auto_verified'
  | 'manually_verified'
  | 'rejected'
  | 'expired'
  | 'renewal_pending';

export type DocumentVerificationMethod =
  | 'api'
  | 'ocr'
  | 'manual_admin'
  | 'digilocker'
  | 'otp'
  | 'format_validation'
  | 'cross_reference'
  | null;

export type GstVerificationStatus = 'pending' | 'verified' | 'invalid' | 'not_provided';

// ---------------------------------------------------------------------------
// BusinessAccount nested interfaces
// ---------------------------------------------------------------------------

export interface BusinessLocation {
  city?: string | null;
  state?: string | null;
  country: string;
  address?: string | null;
  coordinates: {
    lat?: number | null;
    lng?: number | null;
  };
}

export interface BusinessContact {
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  whatsapp?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}

export interface GstDetails {
  gstin?: string | null;
  businessName?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  registeredAddress?: string | null;
  state?: string | null;
  pincode?: string | null;
  registrationDate?: string | null;
  businessType?: string | null;
  taxpayerType?: string | null;
  verificationStatus: GstVerificationStatus;
  verifiedAt?: string | null;
  lastVerifiedAt?: string | null;
}

export interface DocumentVerificationDetails {
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  apiResponse?: unknown;
  /** 0 to 1 */
  confidenceScore?: number | null;
  /** 0 to 100 */
  matchScore?: number | null;
}

export interface DocumentExpiryAlerts {
  thirtyDay: boolean;
  fifteenDay: boolean;
  sevenDay: boolean;
  expired: boolean;
}

export interface BusinessDocument {
  _id?: string;
  docType: DocumentType;
  url: string;
  fileName?: string | null;
  /** File size in bytes */
  fileSize?: number | null;
  mimeType?: string | null;
  documentNumber?: string | null;
  issuedBy?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  status: DocumentStatus;
  verificationMethod: DocumentVerificationMethod;
  verificationDetails: DocumentVerificationDetails;
  rejectionReason?: string | null;
  expiryAlertsSent: DocumentExpiryAlerts;
  documentHash?: string | null;
  uploadedAt: string;
  lastCheckedAt?: string | null;
}

export interface PanDetails {
  panNumber?: string | null;
  nameOnPan?: string | null;
  panType?: string | null;
  verificationStatus: GstVerificationStatus;
  verifiedAt?: string | null;
}

export interface AadhaarDetails {
  maskedNumber?: string | null;
  nameOnAadhaar?: string | null;
  verificationMethod: 'digilocker' | 'otp' | 'manual' | null;
  verificationStatus: GstVerificationStatus;
  verifiedAt?: string | null;
}

export interface FssaiDetails {
  licenseNumber?: string | null;
  businessName?: string | null;
  address?: string | null;
  expiryDate?: string | null;
  verificationStatus: GstVerificationStatus;
  verifiedAt?: string | null;
}

export interface BankDetails {
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
}

export interface BusinessPayout {
  method?: PayoutMethod | null;
  bankDetails: BankDetails;
  upiId?: string | null;
  stripeAccountId?: string | null;
  razorpayAccountId?: string | null;
  isPayoutConfigured: boolean;
}

export interface CommissionOverride {
  enabled: boolean;
  /** 0-30% */
  customRate?: number | null;
  /** Admin UID who set the override */
  setBy?: string | null;
  setAt?: string | null;
  reason?: string | null;
  /** null = permanent */
  validUntil?: string | null;
}

export interface BusinessStats {
  totalListings: number;
  activeListings: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

// ---------------------------------------------------------------------------
// Main BusinessAccount interface
// ---------------------------------------------------------------------------

export interface BusinessAccount {
  _id: string;
  ownerFirebaseUid: string;
  accountType: AccountType;
  businessName: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  logo?: string | null;
  coverPhoto?: string | null;
  location: BusinessLocation;
  contact: BusinessContact;
  gstDetails: GstDetails;
  verificationStatus: VerificationStatus;
  verificationNote?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  documents: BusinessDocument[];
  kycTier: KycTier;
  kycCompletionPercent: number;
  panDetails: PanDetails;
  aadhaarDetails: AadhaarDetails;
  fssaiDetails: FssaiDetails;
  activityCategories: string[];
  payout: BusinessPayout;
  commissionOverride: CommissionOverride;
  /** Legacy: max 5 steps, now 3 steps but kept for backward compatibility */
  onboardingStep: number;
  onboardingCompleted: boolean;
  stats: BusinessStats;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Public business profile (returned by BusinessAccount.getPublicProfile)
// ---------------------------------------------------------------------------

export interface BusinessPublicProfile {
  id: string;
  slug: string;
  businessName: string;
  tagline?: string | null;
  description?: string | null;
  logo?: string | null;
  coverPhoto?: string | null;
  accountType: AccountType;
  location: BusinessLocation;
  contact: {
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    whatsapp?: string | null;
  };
  verificationStatus: VerificationStatus;
  stats: BusinessStats;
  isFeatured: boolean;
  memberSince: string;
}

// ---------------------------------------------------------------------------
// SellerQualityScore
// ---------------------------------------------------------------------------

export interface QualityMetric {
  /** Metric-specific average value */
  averageHours?: number;
  percent?: number;
  average?: number;
  totalReviews?: number;
  last30Days?: number;
  last90Days?: number;
  last30Reviews?: number;
  target: number;
  /** 0-100 individual metric score */
  score: number;
}

export interface ResponseTimeMetric {
  averageHours: number;
  last30Days: number;
  target: number;
  score: number;
}

export interface CancellationRateMetric {
  percent: number;
  last90Days: number;
  target: number;
  score: number;
}

export interface CompletionRateMetric {
  percent: number;
  last90Days: number;
  target: number;
  score: number;
}

export interface CustomerRatingMetric {
  average: number;
  totalReviews: number;
  last30Reviews: number;
  score: number;
}

export interface QualityScoreHistoryEntry {
  date: string;
  overallScore: number;
  tier: string;
}

export interface SellerQualityScore {
  _id: string;
  business: string;
  calculatedAt: string;
  responseTime: ResponseTimeMetric;
  cancellationRate: CancellationRateMetric;
  completionRate: CompletionRateMetric;
  customerRating: CustomerRatingMetric;
  /** Weighted composite score (0-100) */
  overallScore: number;
  tier: QualityTier;
  badge: string;
  /** Commission rate derived from tier (platinum: 5%, gold: 8%, silver: 12%, bronze: 15%) */
  commissionRate: number;
  history: QualityScoreHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
