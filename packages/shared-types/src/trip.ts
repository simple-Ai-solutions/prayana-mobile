/**
 * Trip-related type definitions for Prayana AI mobile app.
 * Derived from stores/useCreateTripStore.js Zustand store shape.
 */

import type { Currency } from './user';

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type TripBudgetLevel = 'budget' | 'moderate' | 'luxury' | 'ultra-luxury';

export type TripType =
  | 'leisure'
  | 'business'
  | 'adventure'
  | 'romantic'
  | 'family'
  | 'solo'
  | 'group'
  | 'cultural'
  | 'spiritual'
  | 'wellness';

export type BudgetCategory =
  | 'accommodation'
  | 'food'
  | 'transport'
  | 'activities'
  | 'shopping'
  | 'misc';

export type SplitType = 'equal' | 'custom' | 'percentage';

export type CollaboratorRole = 'owner' | 'editor' | 'viewer';

// ---------------------------------------------------------------------------
// Trip Activity (within day planner)
// ---------------------------------------------------------------------------

export interface TripActivityCoordinates {
  lat: number;
  lng: number;
}

export interface TripActivity {
  activityId: string;
  name: string;
  description?: string;
  category?: string;
  /** Time slot label, e.g. "09:00 - 11:00" */
  time?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  /** Cost estimate */
  cost?: number;
  costCurrency?: string;
  image?: string;
  /** GPS coordinates */
  coordinates?: TripActivityCoordinates;
  /** Display order within the day */
  order: number;
  notes?: string;
  /** Whether this activity was AI-generated */
  isAISuggestion?: boolean;
  /** Google Places reference */
  placeId?: string;
  rating?: number;
  address?: string;
}

// ---------------------------------------------------------------------------
// Transport between days / destinations
// ---------------------------------------------------------------------------

export interface TransportInfo {
  mode?: string;
  duration?: string;
  distance?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Trip Day
// ---------------------------------------------------------------------------

export interface TripDay {
  dayNumber: number;
  /** ISO date string, or null if trip dates not set */
  date: string | null;
  title: string;
  /** Index into the destinations array */
  destinationIndex: number;
  activities: TripActivity[];
  notes: string;
  transportToNext: TransportInfo | null;
}

// ---------------------------------------------------------------------------
// Destination
// ---------------------------------------------------------------------------

export interface TripDestination {
  name: string;
  /** Number of days at this destination */
  duration: number;
  /** Display order */
  order: number;
  notes?: string;
  /** Optional metadata */
  country?: string;
  state?: string;
  image?: string;
  coordinates?: TripActivityCoordinates;
  placeId?: string;
}

// ---------------------------------------------------------------------------
// Expense tracking (Splitwise-style)
// ---------------------------------------------------------------------------

export interface CustomSplit {
  memberId: string;
  amount: number;
}

export interface TripExpense {
  id: string;
  category: BudgetCategory;
  amount: number;
  note?: string;
  dayIndex?: number;
  activityName?: string;
  date: string;
  paidBy?: string;
  splitAmong?: string[];
  splitType?: SplitType;
  customSplits?: CustomSplit[];
}

export interface OfflineMember {
  id: string;
  name: string;
}

export interface SettledTransaction {
  settledAt: string;
}

// ---------------------------------------------------------------------------
// Budget categories record
// ---------------------------------------------------------------------------

export type BudgetCategories = Record<BudgetCategory, number>;

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export interface Collaborator {
  userId: string;
  userName?: string;
  avatar?: string;
  role?: CollaboratorRole;
  joinedAt?: string;
}

export interface ActiveEditor {
  userId: string;
  userName?: string;
  avatar?: string;
  color?: string;
}

export interface FieldPresenceUser {
  userId: string;
  userName?: string;
  avatar?: string;
  color?: string;
}

/** Map of field names to users currently editing that field */
export type FieldPresenceMap = Record<string, FieldPresenceUser[]>;

// ---------------------------------------------------------------------------
// Trip Setup (Step 1 data)
// ---------------------------------------------------------------------------

export interface TripSetup {
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  kids: number;
  budget: TripBudgetLevel;
  tripType: TripType;
  currency: Currency;
  coverImage: string | null;
}

// ---------------------------------------------------------------------------
// Full Trip state (matches Zustand store shape)
// ---------------------------------------------------------------------------

export interface TripState {
  // Identity
  tripId: string | null;
  /** Temporary client-side ID for real-time collaboration before first save */
  tempTripId: string | null;

  // Setup (Step 1)
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  kids: number;
  budget: TripBudgetLevel;
  tripType: TripType;
  currency: Currency;
  coverImage: string | null;

  // Destinations (Step 2)
  destinations: TripDestination[];

  // Days (Step 3)
  days: TripDay[];

  // UI state
  currentStep: number;
  selectedDayIndex: number;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: string | null;
  errors: Record<string, string>;

  // Budget tracking
  budgetAmount: number;
  expenses: TripExpense[];
  budgetCategories: BudgetCategories;
  offlineMembers: OfflineMember[];
  settledTransactions: Record<string, SettledTransaction>;

  // AI suggestions
  destinationSuggestions: TripDestination[];
  activitySuggestions: TripActivity[];
  isLoadingSuggestions: boolean;

  // Collaboration
  collaborators: Collaborator[];
  activeEditors: ActiveEditor[];
  isCollaborating: boolean;
  isPolling: boolean;
  fieldPresence: FieldPresenceMap;
  userRole: CollaboratorRole | null;
}

// ---------------------------------------------------------------------------
// Trip data for saving / loading (subset persisted to backend)
// ---------------------------------------------------------------------------

export interface TripSavePayload {
  tripId?: string | null;
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  kids: number;
  budget: TripBudgetLevel;
  tripType: TripType;
  currency: Currency;
  coverImage: string | null;
  destinations: TripDestination[];
  days: TripDay[];
  budgetAmount: number;
  expenses: TripExpense[];
  budgetCategories: BudgetCategories;
  offlineMembers: OfflineMember[];
  settledTransactions: Record<string, SettledTransaction>;
  lastEditedStep?: number;
}
