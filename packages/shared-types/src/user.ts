/**
 * User-related type definitions for Prayana AI mobile app.
 * Derived from server/models/User.js MongoDB schema.
 */

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'SGD';

export type Language = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'zh';

export type TravelStyle = 'relaxed' | 'balanced' | 'packed';

export type BudgetRange = 'budget' | 'medium' | 'luxury';

export type Interest =
  | 'Historical Sites'
  | 'Nature & Wildlife'
  | 'Adventure Sports'
  | 'Food & Cuisine'
  | 'Art & Culture'
  | 'Photography'
  | 'Shopping'
  | 'Nightlife'
  | 'Religious Sites'
  | 'Museums'
  | 'Beaches'
  | 'Mountains'
  | 'Local Markets'
  | 'Architecture'
  | 'Festivals'
  | 'Wellness & Spa'
  | 'Local Experiences'
  | 'Street Food'
  | 'Luxury Travel'
  | 'Budget Travel';

export type AuthMethod = 'email' | 'phone' | 'google';

export type ActiveFeature =
  | 'search'
  | 'itinerary'
  | 'favorites'
  | 'profile'
  | 'explore'
  | 'authentication';

export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export type MembershipTier = 'Free' | 'Premium' | 'VIP';

export type DevicePlatform = 'web' | 'android' | 'ios';

// ---------------------------------------------------------------------------
// Nested interfaces
// ---------------------------------------------------------------------------

export interface FcmToken {
  token: string;
  device: DevicePlatform;
  createdAt: string;
  lastUsedAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  marketing: boolean;
  /** Per-event granular notification preferences */
  bookingConfirmation: boolean;
  bookingReminder: boolean;
  bookingCancellation: boolean;
  paymentReceipts: boolean;
  reviewRequests: boolean;
  tripUpdates: boolean;
  promotions: boolean;
}

export interface UserPreferences {
  currency: Currency;
  language: Language;
  travelStyle: TravelStyle;
  budgetRange: BudgetRange;
  interests: Interest[];
  notifications: NotificationPreferences;
}

export interface UserStats {
  totalItineraries: number;
  savedItineraries: number;
  completedTrips: number;
  favoriteDestinations: number;
  totalDaysPlanned: number;
  countriesVisited: string[];
  citiesVisited: string[];
}

export interface AuthMethodUsage {
  method: AuthMethod;
  firstUsed: string;
  lastUsed: string;
  usageCount: number;
}

export interface ConversionEvent {
  type: string;
  timestamp: string;
  sessionId: string;
}

export interface AppUsageAnalytics {
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  /** Average session duration in seconds */
  avgSessionDuration: number;
  /** Total time spent in seconds */
  totalTimeSpent: number;
  bounceRate: number;
  retentionScore: number;
  conversionEvents: ConversionEvent[];
}

export interface DeviceInfo {
  platform?: string;
  browser?: string;
  lastIP?: string;
}

export interface AppUsage {
  totalSessions: number;
  totalSearches: number;
  lastActiveFeature?: ActiveFeature;
  lastAuthMethod?: AuthMethod | null;
  authMethodsUsed: AuthMethodUsage[];
  deviceInfo: DeviceInfo;
  analytics: AppUsageAnalytics;
}

export interface PersonalInfo {
  gender?: Gender | null;
  dateOfBirth?: string | null;
  location?: string | null;
}

export interface Membership {
  tier: MembershipTier;
  loyaltyPoints: number;
  memberSinceDate?: string;
}

export interface EditableStats {
  additionalTripsCompleted: number;
  additionalCountriesVisited: string[];
  additionalCitiesVisited: string[];
}

export interface FavoritePlace {
  placeId: string;
  placeName?: string;
  placeImage?: string;
  placeLocation?: string;
  savedAt: string;
  /** Arbitrary additional place data */
  placeData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main User interface
// ---------------------------------------------------------------------------

export interface User {
  _id: string;
  firebaseUid: string;
  phone?: string | null;
  email?: string | null;
  emailPreference?: string | null;
  name: string;
  avatar?: string | null;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  verifiedAt?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  lastLogoutAt?: string | null;
  fcmTokens: FcmToken[];
  preferences: UserPreferences;
  stats: UserStats;
  appUsage: AppUsage;
  personalInfo: PersonalInfo;
  membership: Membership;
  editableStats: EditableStats;
  favorites: FavoritePlace[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Auth state (client-side)
// ---------------------------------------------------------------------------

export interface AuthState {
  /** Currently authenticated user, or null when signed out */
  user: User | null;
  /** Firebase UID shortcut */
  uid: string | null;
  /** Whether auth state has been resolved (initial load complete) */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Authentication error message, if any */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Profile display shape (returned by User.getProfileForDisplay)
// ---------------------------------------------------------------------------

export interface UserProfileDisplay {
  uid: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  personalInfo: PersonalInfo;
  travelStats: {
    tripsCompleted: number;
    countriesVisited: number;
    citiesVisited: number;
    totalItineraries: number;
    savedItineraries: number;
    totalDaysPlanned: number;
  };
  membership: {
    tier: MembershipTier;
    loyaltyPoints: number;
    memberSince: string;
  };
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Public profile (returned by User.getPublicProfile)
// ---------------------------------------------------------------------------

export interface UserPublicProfile {
  id: string;
  name: string;
  avatar?: string | null;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  preferences: {
    travelStyle: TravelStyle;
    interests: Interest[];
  };
  stats: {
    totalItineraries: number;
    completedTrips: number;
    countriesVisited: number;
    citiesVisited: number;
  };
  memberSince: string;
}
