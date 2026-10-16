// Privacy choices — the app's version of the website's cookie banner
// (travel-ai-nextjs lib/consent.js + ConsentProvider). Same three categories,
// same policy version, and the same proof-of-consent record on the server
// (POST /api/consent/cookies). An app sets no browser cookies, so here the
// choice governs the equivalent: usage analytics and personalised ads.
//
// Asked once on first launch, and again whenever the policy version moves on.
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAPICall } from '@prayana/shared-services';
import { setTrackingAllowed } from './analytics';

/** Keep in step with the web's LEGAL_DOCS["cookie-policy"].currentVersion. */
export const POLICY_VERSION = '1.0.0';
export const POLICY_URL = 'https://prayanaai.com/legal/cookie-policy-v1';

export type Consent = { analytics: boolean; advertising: boolean };
export const ALLOW_ALL: Consent = { analytics: true, advertising: true };
export const DENY_ALL: Consent = { analytics: false, advertising: false };

const KEY = 'prayana.consent';
const ANON_KEY = 'prayana.anonId';

type State = { loaded: boolean; consent: (Consent & { decidedAt: number }) | null };
let state: State = { loaded: false, consent: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

async function anonymousId() {
  try {
    let id = await AsyncStorage.getItem(ANON_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      await AsyncStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/** Read the saved choice once at start. A choice under an old policy doesn't count. */
export async function loadConsent() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : null;
    state = { loaded: true, consent: d && d.v === POLICY_VERSION ? { analytics: !!d.analytics, advertising: !!d.advertising, decidedAt: d.at } : null };
  } catch {
    state = { loaded: true, consent: null };
  }
  setTrackingAllowed(state.consent?.analytics === true);
  emit();
}

export async function saveConsent(choice: Consent) {
  state = { loaded: true, consent: { ...choice, decidedAt: Date.now() } };
  setTrackingAllowed(choice.analytics);
  emit();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...choice, v: POLICY_VERSION, at: Date.now() }));
  } catch {}
  // Proof of consent, as the website records it. Never blocks the choice.
  makeAPICall('/consent/cookies', {
    method: 'POST',
    body: JSON.stringify({
      analytics: choice.analytics,
      advertising: choice.advertising,
      anonymousId: await anonymousId(),
      policyVersion: POLICY_VERSION,
    }),
  }).catch(() => {});
}

export function useConsent() {
  const s = useSyncExternalStore(subscribe, () => state);
  useEffect(() => { if (!state.loaded) loadConsent(); }, []);
  return {
    loaded: s.loaded,
    consent: s.consent,
    decided: s.loaded && s.consent !== null,
    allows: (k: keyof Consent) => s.consent?.[k] === true,
  };
}
