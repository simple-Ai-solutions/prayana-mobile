// Recently-viewed activities — the mobile equivalent of the web's
// localStorage "prayana_recently_viewed" store (RecentlyViewedActivities.jsx).
// Uses AsyncStorage. Call trackRecentlyViewed(activity) from the activity
// detail screen; read via getRecentlyViewed() on the Things-to-Do page.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'prayana_recently_viewed';
const MAX_ITEMS = 10;

export interface RecentActivity {
  id: string;
  title: string;
  image?: string | null;
  price?: number | null;
  mrp?: number | null;
  sellingPrice?: number | null;
  discountPercent?: number | null;
  currency: string;
  city?: string;
  country?: string;
  duration?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  viewedAt: number;
}

/** Read the stored list, newest first. Never throws. */
export async function getRecentlyViewed(excludeId?: string): Promise<RecentActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RecentActivity[] = raw ? JSON.parse(raw) : [];
    return excludeId ? list.filter((i) => i.id !== excludeId) : list;
  } catch {
    return [];
  }
}

/** Record a viewed activity: unshift, dedupe by id, cap at MAX_ITEMS. */
export async function trackRecentlyViewed(activity: any): Promise<void> {
  if (!activity?._id) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RecentActivity[] = raw ? JSON.parse(raw) : [];
    const primaryImg =
      activity.images?.find((i: any) => i?.isPrimary)?.url || activity.images?.[0]?.url || null;
    const entry: RecentActivity = {
      id: activity._id,
      title: activity.title,
      image: primaryImg,
      price: activity.pricing?.basePrice ?? null,
      mrp: activity.platformMRP ?? null,
      sellingPrice: activity.platformSellingPrice ?? null,
      discountPercent: activity.platformDiscountPercent ?? null,
      currency: activity.pricing?.currency || 'INR',
      city: activity.location?.city,
      country: activity.location?.country,
      duration: activity.duration?.label,
      rating: activity.rating?.average,
      reviewCount: activity.rating?.count,
      category: Array.isArray(activity.category) ? activity.category[0] : activity.category,
      viewedAt: Date.now(),
    };
    const deduped = [entry, ...list.filter((i) => i.id !== entry.id)].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(KEY, JSON.stringify(deduped));
  } catch {
    // best-effort; a failed write just means no history this session
  }
}

/** Clear the whole history (the "Clear history" button). */
export async function clearRecentlyViewed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Relative "viewed …" label — matches the web timeAgo(). */
export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
