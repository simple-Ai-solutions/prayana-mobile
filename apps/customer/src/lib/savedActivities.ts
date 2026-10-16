// Saved activities — the Wishlist. The web keeps the ids in localStorage
// "saved_activities" with no account sync; here they live in AsyncStorage,
// newest first. Not the same as Favorites (saved places, favoritesAPI).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

const KEY = 'prayana.savedActivities';
let reading: Promise<void> | null = null;

type State = {
  ids: string[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Adds or removes the id; returns true when it is now saved. */
  toggle: (id: string) => boolean;
  remove: (ids: string[]) => void;
  clear: () => void;
};

// Writes wait for the first read, so an early tap can't overwrite older saves.
function persist() {
  useSavedActivities.getState().load()
    .then(() => AsyncStorage.setItem(KEY, JSON.stringify(useSavedActivities.getState().ids)))
    .catch(() => {
      // best-effort; the list still holds for this session
    });
}

async function read() {
  const { getState, setState } = useSavedActivities;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    const stored: string[] = Array.isArray(list) ? list.filter((x: unknown) => typeof x === 'string') : [];
    // Anything toggled before the read finished stays on top.
    const now = getState().ids;
    setState({ ids: [...now, ...stored.filter((x) => !now.includes(x))], loaded: true });
  } catch {
    setState({ loaded: true });
  }
}

export const useSavedActivities = create<State>((set, get) => ({
  ids: [],
  loaded: false,
  load: () => {
    if (get().loaded) return Promise.resolve();
    reading = reading || read();
    return reading;
  },
  toggle: (id) => {
    const has = get().ids.includes(id);
    const ids = has ? get().ids.filter((x) => x !== id) : [id, ...get().ids];
    set({ ids });
    persist();
    return !has;
  },
  remove: (drop) => {
    const ids = get().ids.filter((x) => !drop.includes(x));
    set({ ids });
    persist();
  },
  clear: () => {
    set({ ids: [] });
    get().load()
      .then(() => { set({ ids: [] }); return AsyncStorage.removeItem(KEY); })
      .catch(() => {});
  },
}));

/** Whether one activity is saved; loads the list on first use. */
export function useIsSaved(id?: string | null): boolean {
  const saved = useSavedActivities((s) => (id ? s.ids.includes(id) : false));
  useEffect(() => { useSavedActivities.getState().load(); }, []);
  return saved;
}

export const isSaved = (id: string) => useSavedActivities.getState().ids.includes(id);
export const toggleSaved = (id: string) => useSavedActivities.getState().toggle(id);
export const loadSaved = () => useSavedActivities.getState().load();
export const clearSaved = () => useSavedActivities.getState().clear();
