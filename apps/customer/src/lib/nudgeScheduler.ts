// Schedules the daily travel nudges (lib/travelNudges) as local notifications
// on the phone, so they arrive even when the app is closed — no server push
// needed. Two a day (morning and evening), in a shuffled order kept on the
// phone so a line never repeats until every line has been sent once; then a
// fresh shuffle.
// The next week is kept scheduled; opening the app tops it up.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TRAVEL_NUDGES } from './travelNudges';

const ORDER_KEY = 'prayana.nudges.order';   // shuffled indexes, as JSON
const CURSOR_KEY = 'prayana.nudges.cursor'; // next position in ORDER
const OFF_KEY = 'prayana.nudges.off';       // '1' when the user turned them off
const DAYS_AHEAD = 7;
/** 10 am (give or take 10 min) and around 6 pm (give or take 20 min). */
const SLOTS = [
  { name: 'am', hour: 10, minute: 0, jitter: 10 },
  { name: 'pm', hour: 18, minute: 0, jitter: 20 },
];

function shuffle(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function nextIndexes(count: number): Promise<number[]> {
  let order: number[] = [];
  let cursor = 0;
  try {
    order = JSON.parse((await AsyncStorage.getItem(ORDER_KEY)) || '[]');
    cursor = Number((await AsyncStorage.getItem(CURSOR_KEY)) || 0);
  } catch {}
  // A new or grown bank gets a new order.
  if (order.length !== TRAVEL_NUDGES.length) { order = shuffle(TRAVEL_NUDGES.length); cursor = 0; }
  const out: number[] = [];
  while (out.length < count) {
    if (cursor >= order.length) {
      // Every line has been used: reshuffle, keeping the last one off the top.
      const last = order[order.length - 1];
      order = shuffle(TRAVEL_NUDGES.length);
      if (order[0] === last && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
      cursor = 0;
    }
    out.push(order[cursor++]);
  }
  try {
    await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(order));
    await AsyncStorage.setItem(CURSOR_KEY, String(cursor));
  } catch {}
  return out;
}

async function scheduledNudges() {
  const all = await ExpoNotifications.getAllScheduledNotificationsAsync();
  return all.filter((n) => (n.content.data as any)?.kind === 'travel-nudge');
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Keep the next week of nudges scheduled. Safe to call on every app start. */
export async function topUpNudges() {
  try {
    if ((await AsyncStorage.getItem(OFF_KEY)) === '1') return;
    const perm = await ExpoNotifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;

    // Nudges scheduled before the two-a-day times carry no slot; replace them.
    const taken = new Set<string>();
    for (const n of await scheduledNudges()) {
      const slot = (n.content.data as any)?.slot;
      if (slot) taken.add(slot);
      else await ExpoNotifications.cancelScheduledNotificationAsync(n.identifier);
    }

    // Every morning and evening slot of the next week that is still ahead.
    const wanted: { slot: string; at: Date }[] = [];
    for (let day = 0; day < DAYS_AHEAD; day++) {
      for (const t of SLOTS) {
        const d = new Date();
        d.setDate(d.getDate() + day);
        const slot = `${dayKey(d)}-${t.name}`;
        if (taken.has(slot)) continue;
        d.setHours(t.hour, t.minute + Math.round((Math.random() * 2 - 1) * t.jitter), 0, 0);
        if (d.getTime() <= Date.now() + 60000) continue;
        wanted.push({ slot, at: d });
      }
    }
    if (!wanted.length) return;

    const picks = await nextIndexes(wanted.length);
    for (let i = 0; i < wanted.length; i++) {
      const n = TRAVEL_NUDGES[picks[i]];
      const { slot, at } = wanted[i];
      await ExpoNotifications.scheduleNotificationAsync({
        content: {
          title: n.title,
          body: n.body,
          data: { kind: 'travel-nudge', route: n.route, at: at.getTime(), slot },
          ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
        } as any,
        trigger: { type: ExpoNotifications.SchedulableTriggerInputTypes.DATE, date: at } as any,
      });
    }
  } catch (err) {
    console.warn('[nudges] schedule failed:', (err as Error)?.message);
  }
}

export async function nudgesEnabled() {
  try { return (await AsyncStorage.getItem(OFF_KEY)) !== '1'; } catch { return true; }
}

/** The settings switch. Off cancels everything already scheduled. */
export async function setNudgesEnabled(on: boolean) {
  try {
    await AsyncStorage.setItem(OFF_KEY, on ? '0' : '1');
    if (on) {
      await topUpNudges();
    } else {
      for (const n of await scheduledNudges()) await ExpoNotifications.cancelScheduledNotificationAsync(n.identifier);
    }
  } catch {}
}
