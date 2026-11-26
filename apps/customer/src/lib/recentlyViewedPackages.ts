// Holiday packages this phone opened last, for the "Recently viewed" row on
// Holiday Deals. Same shape and limits as recentlyViewedActivities.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'prayana_recent_packages';
const MAX = 8;

export type RecentPackage = { id: string; title: string; image?: string; price?: number; nights?: number; viewedAt: number };

export async function getRecentPackages(): Promise<RecentPackage[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function trackRecentPackage(p: { id: string; title: string; image?: string; price?: number; nights?: number }) {
  try {
    const list = (await getRecentPackages()).filter((x) => x.id !== p.id);
    await AsyncStorage.setItem(KEY, JSON.stringify([{ ...p, viewedAt: Date.now() }, ...list].slice(0, MAX)));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}
