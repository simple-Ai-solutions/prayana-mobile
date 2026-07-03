/**
 * guestUsage.ts
 * Tracks guest user free-tier usage counts using AsyncStorage.
 * Guests get a limited number of free uses before being prompted to sign in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  PLAN_TRIP: 'guest_plan_trip_count',
  CHAT: 'guest_chat_count',
};

// Maximum free uses for guests
export const GUEST_LIMITS = {
  PLAN_TRIP: 3,
  CHAT: 3,
};

/** Get the current usage count for a feature. */
export async function getGuestUsageCount(feature: 'PLAN_TRIP' | 'CHAT'): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(KEYS[feature]);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/** Increment the usage count for a feature. Returns the new count. */
export async function incrementGuestUsage(feature: 'PLAN_TRIP' | 'CHAT'): Promise<number> {
  try {
    const current = await getGuestUsageCount(feature);
    const next = current + 1;
    await AsyncStorage.setItem(KEYS[feature], String(next));
    return next;
  } catch {
    return 0;
  }
}

/**
 * Check if a guest can use a feature.
 * Returns true if usage is within the free limit.
 */
export async function canGuestUse(feature: 'PLAN_TRIP' | 'CHAT'): Promise<boolean> {
  const count = await getGuestUsageCount(feature);
  return count < GUEST_LIMITS[feature];
}

/** Reset all guest usage counts (called on actual sign-in). */
export async function resetGuestUsage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEYS.PLAN_TRIP, KEYS.CHAT]);
  } catch {}
}
