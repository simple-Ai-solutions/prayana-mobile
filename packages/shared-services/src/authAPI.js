// authAPI.js - API functions for authentication endpoints
// Handles backend sync, profile fetching, and profile updates.

import { makeAPICall, getAuthHeaders } from './apiConfig';

/**
 * Sync the Firebase user with the backend after sign-in or sign-up.
 * The backend creates or updates the user record.
 *
 * @param {Object} userData - { uid, name, email, phone, avatar, authMethod }
 * @param {string} idToken - Firebase ID token for Authorization header
 * @returns {Promise<Object>} Backend response
 */
export async function syncUserWithBackend(userData, idToken) {
  return makeAPICall('/auth/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(userData),
  });
}

/**
 * Fetch the current user's profile from the backend.
 * Requires the auth token provider to be set via setAuthTokenProvider().
 *
 * @returns {Promise<Object>} User profile data
 */
export async function fetchUserProfile() {
  return makeAPICall('/auth/profile', {
    headers: await getAuthHeaders(),
  });
}

/**
 * Update the current user's profile on the backend.
 *
 * @param {Object} profileData - Fields to update (name, avatar, phone, etc.)
 * @returns {Promise<Object>} Updated profile data
 */
export async function updateUserProfile(profileData) {
  return makeAPICall('/auth/profile', {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(profileData),
  });
}

/**
 * Save email notification preference for the user.
 *
 * @param {Object} data - { emailOptIn: boolean, email: string }
 * @returns {Promise<Object>} Backend response
 */
export async function saveEmailPreference(data) {
  return makeAPICall('/auth/save-email-preference', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
}

/**
 * Save/update notification preferences (push, email, per-event toggles).
 *
 * @param {Object} preferences - Preferences matching User.preferences.notifications schema
 * @returns {Promise<Object>} Backend response
 */
export async function saveNotificationPreferences(preferences) {
  return makeAPICall('/auth/profile', {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ preferences: { notifications: preferences } }),
  });
}

/**
 * Register an Expo/FCM push token for the current device.
 *
 * @param {string} token - The push token (Expo or FCM)
 * @param {string} device - 'ios' | 'android' | 'web'
 * @returns {Promise<Object>} Backend response
 */
export async function saveFcmToken(token, device) {
  return makeAPICall('/auth/fcm-token', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ token, device }),
  });
}

/**
 * Remove push token(s) from the current user.
 *
 * @param {string|null} token - Specific token to remove, or null to clear all
 * @returns {Promise<Object>} Backend response
 */
export async function deleteFcmToken(token = null) {
  return makeAPICall('/auth/fcm-token', {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ token }),
  });
}
