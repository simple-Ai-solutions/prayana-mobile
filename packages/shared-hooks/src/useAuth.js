// useAuth.js - Firebase Authentication Provider & Hook for React Native
// Uses Firebase JS SDK (Expo managed workflow - NOT @react-native-firebase)

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
} from 'firebase/auth';
import { auth, setAuthTokenProvider, syncUserWithBackend, fetchUserProfile, updateUserProfile as updateProfileAPI } from '@prayana/shared-services';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// AuthProvider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [backendUser, setBackendUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  // Keep a ref to the current user so the token provider always reads the latest value
  const userRef = useRef(null);

  // -----------------------------------------------------------------------
  // Wire up the shared-services auth token provider once
  // Always reads userRef so it works for both Firebase and guest users.
  // Guest users have getIdToken() returning 'guest-token' — we skip those.
  // -----------------------------------------------------------------------
  useEffect(() => {
    setAuthTokenProvider(async () => {
      const currentUser = userRef.current;
      if (!currentUser) return null;
      // Skip guest users — they don't have a real Firebase token
      if (currentUser.uid === 'guest-user') return null;
      // Try Firebase's auth.currentUser first (most reliable)
      if (auth.currentUser) {
        try {
          return await auth.currentUser.getIdToken();
        } catch (err) {
          console.warn('[useAuth] Failed to get ID token from auth.currentUser:', err.message);
        }
      }
      // Fallback: use the getIdToken on the user object itself
      if (typeof currentUser.getIdToken === 'function') {
        try {
          return await currentUser.getIdToken();
        } catch (err) {
          console.warn('[useAuth] Failed to get ID token from user object:', err.message);
        }
      }
      return null;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Sync user with backend after Firebase sign-in
  // -----------------------------------------------------------------------
  const syncWithBackend = useCallback(async (firebaseUser, authMethod = 'email') => {
    if (!firebaseUser) return null;

    try {
      const idToken = await firebaseUser.getIdToken();
      const userData = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || '',
        avatar: firebaseUser.photoURL || '',
        authMethod,
      };

      const response = await syncUserWithBackend(userData, idToken);

      if (response?.success || response?.data) {
        const profile = response.data || response.user || response;
        setBackendUser(profile);
        return profile;
      }

      return null;
    } catch (err) {
      // Non-fatal: user is still authenticated via Firebase even if sync fails.
      // The backend may be unreachable on first launch.
      console.warn('[useAuth] Backend sync failed:', err.message);
      return null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Listen for Firebase auth state changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        userRef.current = firebaseUser;
        setUser(firebaseUser);
        setIsAuthenticated(true);

        // Sync with backend silently
        await syncWithBackend(firebaseUser);
      } else {
        // Only clear if not a guest user (guest bypasses Firebase auth)
        if (userRef.current?.uid !== 'guest-user') {
          userRef.current = null;
          setUser(null);
          setBackendUser(null);
          setIsAuthenticated(false);
        }
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, [syncWithBackend]);

  // -----------------------------------------------------------------------
  // Auth methods
  // -----------------------------------------------------------------------

  /**
   * Get the current user's Firebase ID token.
   * @param {boolean} [forceRefresh=false] - Force refresh the token
   * @returns {Promise<string|null>}
   */
  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch (err) {
      console.error('[useAuth] getIdToken error:', err.message);
      return null;
    }
  }, []);

  /**
   * Sign in with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} Firebase user
   */
  const loginWithEmail = useCallback(async (email, password) => {
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await syncWithBackend(credential.user, 'email');
      return credential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [syncWithBackend]);

  /**
   * Create a new account with email and password, then set display name.
   * @param {string} email
   * @param {string} password
   * @param {string} name - Display name for the new user
   * @returns {Promise<Object>} Firebase user
   */
  const signUpWithEmail = useCallback(async (email, password, name) => {
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Set the display name on the Firebase profile
      if (name) {
        await updateProfile(credential.user, { displayName: name });
      }

      await syncWithBackend(credential.user, 'email');
      return credential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [syncWithBackend]);

  /**
   * Start phone number sign-in. Returns a confirmation result whose
   * `.confirm(code)` method completes the flow, but we also expose
   * `verifyOTP` as a convenience.
   *
   * NOTE: Phone auth with the JS SDK in React Native requires a
   * RecaptchaVerifier, which needs a web view. For production, consider
   * using expo-auth-session or a custom backend phone auth flow.
   *
   * @param {string} phoneNumber - E.164 format (e.g., "+919876543210")
   * @param {Object} recaptchaVerifier - A RecaptchaVerifier instance (must be set up in the calling component)
   * @returns {Promise<Object>} Confirmation result with `.verificationId`
   */
  const loginWithPhone = useCallback(async (phoneNumber, recaptchaVerifier) => {
    setError(null);
    try {
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(phoneNumber, recaptchaVerifier);
      return { verificationId };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Complete phone auth by verifying the OTP code.
   * @param {string} verificationId - From loginWithPhone result
   * @param {string} code - The 6-digit OTP code
   * @returns {Promise<Object>} Firebase user
   */
  const verifyOTP = useCallback(async (verificationId, code) => {
    setError(null);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const result = await signInWithCredential(auth, credential);
      await syncWithBackend(result.user, 'phone');
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [syncWithBackend]);

  /**
   * Google sign-in placeholder.
   * Requires expo-auth-session + expo-web-browser setup in each app.
   * The app-level code should:
   *   1. Use expo-auth-session to get a Google ID token
   *   2. Create a GoogleAuthProvider.credential(idToken)
   *   3. Call signInWithCredential(auth, credential)
   *   4. Call syncWithBackend(user, 'google')
   *
   * This function is intentionally a no-op to avoid importing
   * app-specific dependencies into the shared package.
   *
   * @throws {Error} Always throws - must be implemented per-app
   */
  const loginWithGoogle = useCallback(async () => {
    throw new Error(
      'loginWithGoogle() must be implemented at the app level using expo-auth-session. ' +
      'See the useAuth comments for the required steps.'
    );
  }, []);

  /**
   * Sign out the current user.
   */
  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
      setBackendUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Fetch the user's profile from the backend.
   * @returns {Promise<Object>} User profile
   */
  const refreshProfile = useCallback(async () => {
    try {
      const response = await fetchUserProfile();
      if (response?.data || response?.user) {
        const profile = response.data || response.user;
        setBackendUser(profile);
        return profile;
      }
      return null;
    } catch (err) {
      console.warn('[useAuth] Failed to fetch profile:', err.message);
      return null;
    }
  }, []);

  /**
   * Update the user's profile on the backend and refresh local state.
   * @param {Object} data - Profile fields to update
   * @returns {Promise<Object>} Updated profile
   */
  const updateUserProfile = useCallback(async (data) => {
    setError(null);
    try {
      const response = await updateProfileAPI(data);
      if (response?.data || response?.user) {
        const profile = response.data || response.user;
        setBackendUser(profile);
        return profile;
      }
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Clear the current error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value = {
    // State
    user,           // Firebase user object (or null)
    backendUser,    // Backend user profile (or null)
    isLoading,      // True while checking initial auth state
    isAuthenticated,
    error,          // Last auth error message (or null)

    // Auth methods
    loginWithEmail,
    signUpWithEmail,
    loginWithPhone,
    verifyOTP,
    loginWithGoogle,
    logout,
    getIdToken,

    // Profile methods
    refreshProfile,
    updateUserProfile,

    // Utility
    clearError,

    // Expose setters for advanced use cases (e.g., Google sign-in at app level)
    // Wraps setUser to also keep userRef in sync
    setUser: (u) => { userRef.current = u; setUser(u); },
    setIsAuthenticated,
    syncWithBackend,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
