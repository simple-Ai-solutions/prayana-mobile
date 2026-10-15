// The home headline's typewriter ("…escape to Manali|"), as one shared clock.
//
// It used to be state on the home screen itself, so every typed letter —
// 10–18 a second — re-rendered the entire home page with all its rails, and
// scrolling stuttered. Now one timer drives a tiny store, and only the two
// Text leaves that show the word subscribe to it.
import { useSyncExternalStore } from 'react';

const CITIES = ['Manali', 'Shimla', 'Switzerland', 'Kerala', 'Kodaikanal'];

let value = CITIES[0];
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let wordIdx = 0;
let charIdx = CITIES[0].length;
let deleting = false;

function set(v: string) {
  value = v;
  listeners.forEach((l) => l());
}

function tick() {
  const word = CITIES[wordIdx];
  if (!deleting) {
    charIdx++;
    set(word.slice(0, charIdx));
    if (charIdx >= word.length) { deleting = true; timer = setTimeout(tick, 1600); return; }
    timer = setTimeout(tick, 110);
  } else {
    charIdx--;
    set(word.slice(0, charIdx));
    if (charIdx <= 0) {
      deleting = false;
      wordIdx = (wordIdx + 1) % CITIES.length;
      timer = setTimeout(tick, 200);
      return;
    }
    timer = setTimeout(tick, 55);
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Runs only while something shows it; the first city sits before cycling.
  if (!timer) timer = setTimeout(tick, 1600);
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) { clearTimeout(timer); timer = null; }
  };
}

/** The word being typed. With `still`, the first city, unanimated. */
export function useTypedCity(still = false) {
  const v = useSyncExternalStore(still ? () => () => {} : subscribe, () => value);
  return still ? CITIES[0] : v || CITIES[0];
}

export const FIRST_CITY = CITIES[0];
