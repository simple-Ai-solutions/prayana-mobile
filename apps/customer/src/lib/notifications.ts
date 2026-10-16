// In-app notifications — the same inbox the website's bell reads
// (GET /api/notifications, unread-count, mark read / read all), plus live
// delivery: the server emits each new notification on the /qa Socket.IO
// namespace, room user:<mongoUserId>. While the app is running, a new one
// raises the bell badge and shows a system notification on the phone.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import * as ExpoNotifications from 'expo-notifications';
import { makeAPICall, auth } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { mapWebPath } from './deepLinks';

export type AppNotification = {
  _id: string;
  type: string;
  title: string;
  message?: string;
  link?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  isRead?: boolean;
  createdAt: string;
};

export const notificationsAPI = {
  list: (page = 1, limit = 20) => makeAPICall(`/notifications?page=${page}&limit=${limit}`) as Promise<any>,
  unreadCount: () => makeAPICall('/notifications/unread-count') as Promise<any>,
  markRead: (id: string) => makeAPICall(`/notifications/${id}/read`, { method: 'POST' }) as Promise<any>,
  markAllRead: () => makeAPICall('/notifications/read-all', { method: 'POST' }) as Promise<any>,
};

type Store = {
  unread: number;
  /** Bumped when a live notification arrives, so an open inbox reloads. */
  pulse: number;
  setUnread: (n: number) => void;
  bump: () => void;
};
export const useNotificationStore = create<Store>((set) => ({
  unread: 0,
  pulse: 0,
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  bump: () => set((s) => ({ unread: s.unread + 1, pulse: s.pulse + 1 })),
}));

export async function refreshUnread() {
  try {
    const res = await notificationsAPI.unreadCount();
    const n = res?.data?.count ?? res?.count;
    if (typeof n === 'number') useNotificationStore.getState().setUnread(n);
  } catch {
    // Signed out or offline: leave the badge as it is.
  }
}

/**
 * Where a notification opens in the app. Links are the website's paths,
 * sometimes as a full URL ("https://prayanaai.com/my-expenses?openTrip=…").
 */
export function routeForLink(link?: string | null): string | null {
  if (!link) return null;
  let path = link;
  try {
    if (/^https?:\/\//i.test(link)) {
      const u = new URL(link);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    return null;
  }
  const bare = path.split('?')[0];
  const mapped = mapWebPath(bare);
  if (mapped) return mapped;
  if (/^\/community\/[^/]+/.test(bare)) return bare;
  if (bare.startsWith('/my-expenses')) return '/my-expenses';
  if (bare.startsWith('/bookings') || bare.startsWith('/my-bookings')) return '/bookings';
  if (bare.startsWith('/esim')) return '/esim/my-orders';
  return bare && bare !== '/' ? bare : null;
}

/**
 * The same inbox notification can reach the phone twice while the app is open:
 * over the socket (shown as a local alert) and as a server push. Whichever
 * arrives first is shown; the other is dropped. Returns true if already seen.
 */
const seenIds = new Map<string, number>();
export function alreadyShown(id?: string | null) {
  if (!id) return false;
  const now = Date.now();
  for (const [k, t] of seenIds) if (now - t > 10 * 60000) seenIds.delete(k);
  if (seenIds.has(String(id))) return true;
  seenIds.set(String(id), now);
  return false;
}

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://api.prayanaai.com';

/**
 * Keeps the bell's count fresh and listens for new notifications while the
 * app is open. Mounted once, near the root.
 */
export function useLiveNotifications() {
  const { user, isAuthenticated, backendUser } = useAuth() as any;
  const signedIn = isAuthenticated && !!user?.uid && user.uid !== 'guest-user';
  const mongoId: string | undefined = backendUser?._id || backendUser?.id;

  // The count: on sign-in, every minute, and whenever the app comes back.
  useEffect(() => {
    if (!signedIn) { useNotificationStore.getState().setUnread(0); return; }
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refreshUnread());
    return () => { clearInterval(t); sub.remove(); };
  }, [signedIn]);

  // Live delivery over the socket.
  useEffect(() => {
    if (!signedIn || !mongoId) return;
    let socket: Socket | null = null;
    let alive = true;
    (async () => {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      if (!alive) return;
      socket = io(`${SOCKET_URL}/qa`, { transports: ['websocket'], auth: token ? { token } : {}, reconnection: true });
      socket.on('connect', () => socket?.emit('subscribe-user', { userId: mongoId }));
      socket.on('notification', (n: AppNotification) => {
        useNotificationStore.getState().bump();
        if (alreadyShown(n._id)) return;
        // A system notification, so it is seen even with the app in the background.
        ExpoNotifications.scheduleNotificationAsync({
          content: {
            title: n.title || 'Prayana AI',
            body: n.message || '',
            data: { route: routeForLink(n.link) || '/notifications', notificationId: n._id },
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          } as any,
          trigger: null,
        }).catch(() => {});
      });
    })();
    return () => {
      alive = false;
      if (socket) { socket.emit('unsubscribe-user', { userId: mongoId }); socket.disconnect(); }
    };
  }, [signedIn, mongoId]);
}

/** Ask once for permission to show notifications (Android 13+ and iOS need it). */
export async function ensureNotificationPermission() {
  try {
    const cur = await ExpoNotifications.getPermissionsAsync();
    if (cur.status === 'granted') return true;
    if (!cur.canAskAgain) return false;
    const next = await ExpoNotifications.requestPermissionsAsync();
    return next.status === 'granted';
  } catch {
    return false;
  }
}
