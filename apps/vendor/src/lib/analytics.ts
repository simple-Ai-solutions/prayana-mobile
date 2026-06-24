/**
 * Vendor app analytics — same architecture as customer/lib/analytics.ts.
 * Vendor side typically tracks: listing_created, booking_status_changed,
 * payout_requested, review_replied, support_ticket_opened.
 */

import { Platform } from 'react-native';
import { makeAPICall } from '@prayana/shared-services';

let allowTracking = Platform.OS !== 'ios';
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
        properties: { ...props, app: 'vendor' },
        userId,
        platform: Platform.OS,
        ts: Date.now(),
      }),
      timeout: 5000,
    });
  } catch {}
}

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

export function trackScreen(routeName: string, params?: Record<string, unknown>) {
  track('screen_view', { screen: routeName, ...params });
}

export function identify(uid: string, traits: Record<string, unknown> = {}) {
  setAnalyticsUser(uid);
  track('identify', traits);
}
