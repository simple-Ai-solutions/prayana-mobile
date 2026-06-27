// recentItineraries — lightweight local history of AI-generated itineraries
// (Plan-a-Trip + Quick Itinerary). Stored in AsyncStorage so the home screen
// can show a "Recent Itineraries" row without requiring sign-in or a bookmark.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recentItineraries';
const MAX = 20;

export interface RecentItinerary {
  id: string;
  title: string;
  destination: string;
  duration: string;
  markdown: string;
  transportMode?: string;
  markdownItineraryId?: string;
  createdAt: string; // ISO
}

// De-dupe key: same destination + duration is treated as the same trip so
// reopening/regenerating doesn't pile up duplicates — newest wins.
function dedupeKey(destination: string, duration: string) {
  return `${(destination || '').trim().toLowerCase()}|${duration}`;
}

export async function addRecentItinerary(
  item: Omit<RecentItinerary, 'id' | 'createdAt'>
): Promise<void> {
  if (!item.markdown || !item.destination) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RecentItinerary[] = raw ? JSON.parse(raw) : [];
    const key = dedupeKey(item.destination, item.duration);
    const filtered = list.filter(
      (t) => dedupeKey(t.destination, t.duration) !== key
    );
    const entry: RecentItinerary = {
      ...item,
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort — never block the UI on history persistence
  }
}

export async function getRecentItineraries(): Promise<RecentItinerary[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RecentItinerary[] = raw ? JSON.parse(raw) : [];
    return list.sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  } catch {
    return [];
  }
}

export async function clearRecentItineraries(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
