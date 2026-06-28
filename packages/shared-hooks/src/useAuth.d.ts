import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';

/**
 * Type-only declaration for useAuth.js — the runtime is plain JS but consumers
 * across the customer + vendor apps deserve autocomplete and TS safety.
 *
 * Mirrors the actual return shape in useAuth.js (search for `return {` near line 326).
 */

export type AuthUser = User & {
  // The hook synthesises a guest user with these extra props for unauthenticated browsing.
  isGuest?: boolean;
};

export type BackendProfile = {
  _id?: string;
  firebaseUid?: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
  totalTrips?: number;
  tripsCount?: number;
  totalBookings?: number;
  bookingsCount?: number;
  memberSince?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type AuthContextValue = {
  user: AuthUser | null;
  backendProfile: BackendProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithEmail: (email: string, password: string) => Promise<AuthUser>;
  signUpWithEmail: (
    email: string,
    password: string,
    name: string,
  ) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  loginWithPhone: (
    phoneNumber: string,
    recaptchaVerifier?: unknown,
  ) => Promise<{ verificationId: string }>;
  confirmPhoneCode?: (
    verificationId: string,
    code: string,
  ) => Promise<AuthUser>;
  loginAsGuest?: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile?: () => Promise<BackendProfile | null>;
  updateUserProfile?: (updates: Partial<BackendProfile>) => Promise<BackendProfile | null>;
  clearError?: () => void;
  getIdToken?: () => Promise<string | null>;
  // Setters exposed for app-level Google/phone flows that bypass the hook helpers.
  setUser: (u: AuthUser | null) => void;
  setIsAuthenticated: (v: boolean) => void;
  syncWithBackend: (
    firebaseUser: AuthUser,
    method?: 'email' | 'google' | 'phone',
  ) => Promise<BackendProfile | null>;
};

export const AuthProvider: (props: { children: ReactNode }) => JSX.Element;
export const useAuth: () => AuthContextValue;
