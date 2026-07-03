/**
 * Lightweight analytics layer.
 *
 * Why a custom layer (vs importing Firebase Analytics directly):
 *  - Lets us gate every event behind iOS App Tracking Transparency without
 *    polluting feature code.
 *  - One place to swap providers (Firebase, Mixpanel, Segment) later.
 *  - Easy to disable in dev / when user opts out.
 *
 * Current backend: posts to /analytics/event on our own API. Falls back to
 * console.debug when EXPO_PUBLIC_ENV !== 'production'.
 *
 * Use the named helpers (track, trackScreen, identify) — don't reach for
 * the raw posting fn from feature code.
 */

import { Platform } from 'react-native';
import { makeAPICall } from '@prayana/shared-services';

let allowTracking = Platform.OS !== 'ios'; // Android grants by default; iOS waits for ATT
let userId: string | null = null;
const queue: Array<{ name: string; props: Record<string, unknown> }> = [];

export function setTrackingAllowed(allowed: boolean) {
  allowTracking = allowed;
  if (allowed) flush();
}

export function setAnalyticsUser(uid: string | null) {
  userId = uid;
}

function flush() {
  while (queue.length) {
    const e = queue.shift()!;
    sendOne(e.name, e.props);
  }
}

async function sendOne(name: string, props: Record<string, unknown>) {
  try {
    await makeAPICall('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({
        event: name,
        properties: props,
        userId,
        platform: Platform.OS,
        ts: Date.now(),
      }),
      timeout: 5000,
    });
  } catch {
    // Analytics failures are never user-facing.
  }
}

/**
 * Track a custom event. Common events: `booking_started`, `booking_completed`,
 * `payment_failed`, `search_performed`.
 */
export function track(name: string, props: Record<string, unknown> = {}) {
  if (process.env.EXPO_PUBLIC_ENV !== 'production') {
    if (__DEV__) console.log(`[analytics] ${name}`, props);
    return;
  }
  if (!allowTracking) {
    queue.push({ name, props });
    return;
  }
  void sendOne(name, props);
}

/** Track a screen view. Call from screen-level useEffects. */
export function trackScreen(routeName: string, params?: Record<string, unknown>) {
  track('screen_view', { screen: routeName, ...params });
}

/** Identify the user. Call after sign-in. */
export function identify(uid: string, traits: Record<string, unknown> = {}) {
  setAnalyticsUser(uid);
  track('identify', traits);
}
