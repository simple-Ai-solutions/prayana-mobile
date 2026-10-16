// Exchange rates for showing partner prices (EUR, USD, AED…) in the user's
// own currency, so one list never mixes €28 next to ₹6,769. Same source and
// shape as the website's hooks/useExchangeRates.js: USD-relative rates from
// open.er-api.com (free, no key), cached on the phone for 6 hours and fetched
// once however many cards ask.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Rates = Record<string, number>;

const KEY = 'prayana.fxRates';
const TTL_MS = 6 * 60 * 60 * 1000;
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

let memory: Rates | null = null;
let inFlight: Promise<Rates | null> | null = null;
const listeners = new Set<(r: Rates) => void>();

async function ensureRates(): Promise<Rates | null> {
  if (memory) return memory;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const cached = raw ? JSON.parse(raw) : null;
      if (cached?.rates && Date.now() - cached.at < TTL_MS) {
        memory = cached.rates;
        return memory;
      }
    } catch {}
    try {
      const res = await fetch(ENDPOINT);
      const data = await res.json();
      if (data?.rates) {
        memory = data.rates as Rates;
        AsyncStorage.setItem(KEY, JSON.stringify({ rates: memory, at: Date.now() })).catch(() => {});
        return memory;
      }
    } catch {}
    return null;
  })();
  const r = await inFlight;
  inFlight = null;
  if (r) listeners.forEach((l) => l(r));
  return r;
}

export function useExchangeRates(): Rates | null {
  const [rates, setRates] = useState<Rates | null>(memory);
  useEffect(() => {
    if (memory) return;
    listeners.add(setRates);
    ensureRates();
    return () => { listeners.delete(setRates); };
  }, []);
  return rates;
}

/** `amount` in `from` as `to`, or null when either rate is unknown. */
export function convertCurrency(amount: number, from: string, to: string, rates: Rates | null): number | null {
  if (from === to) return amount;
  const f = rates?.[from];
  const t = rates?.[to];
  if (!f || !t) return null;
  return (amount / f) * t;
}
