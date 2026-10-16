// Notifications — the inbox behind the home screen's bell, the same list the
// website's bell shows: answers and upvotes on your community questions, trip
// expense updates, booking updates and announcements. New ones are marked;
// tapping one opens what it is about and marks it read.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import {
  AppNotification, notificationsAPI, refreshUnread, routeForLink, useNotificationStore, ensureNotificationPermission,
} from '../lib/notifications';

const RED = '#E61417';
const ORANGE = '#f97316';

type Kind = { icon: keyof typeof Ionicons.glyphMap; color: string; label: string };
function kindOf(type: string): Kind {
  if (type === 'qa_answer') return { icon: 'chatbubble-ellipses', color: '#0ea5e9', label: 'New answer' };
  if (type === 'qa_reply') return { icon: 'return-down-forward', color: '#0ea5e9', label: 'Reply' };
  if (type === 'qa_upvote') return { icon: 'arrow-up-circle', color: ORANGE, label: 'Upvote' };
  if (type === 'qa_accepted') return { icon: 'checkmark-circle', color: '#10b981', label: 'Accepted answer' };
  if (type === 'qa_mention') return { icon: 'at', color: '#8b5cf6', label: 'Mention' };
  if (type === 'booking_update') return { icon: 'ticket', color: '#059669', label: 'Booking' };
  if (type.startsWith('expense') || type.startsWith('settlement')) return { icon: 'wallet', color: '#eab308', label: 'Trip expenses' };
  return { icon: 'megaphone', color: RED, label: 'Prayana' };
}

function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Today / This week / Earlier, for section labels. */
function bucketOf(date: string) {
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (now.getTime() - d.getTime() < 7 * 86400000) return 'This week';
  return 'Earlier';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const signedIn = !!user?.uid && user.uid !== 'guest-user';
  const unread = useNotificationStore((s) => s.unread);
  const pulse = useNotificationStore((s) => s.pulse);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async (p = 1) => {
    if (!signedIn) { setLoading(false); return; }
    setError('');
    try {
      const res: any = await notificationsAPI.list(p, 20);
      const data: AppNotification[] = res?.data || [];
      const meta = res?.metadata || res?.meta || {};
      setItems((prev) => (p === 1 ? data : [...prev, ...data.filter((x) => !prev.some((y) => y._id === x._id))]));
      setPage(p);
      setPages(meta.pages || 1);
      if (typeof meta.unreadCount === 'number') useNotificationStore.getState().setUnread(meta.unreadCount);
    } catch {
      if (p === 1) setError("Couldn't load your notifications. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [signedIn]);

  useEffect(() => { load(1); }, [load, pulse]);
  // Ask for permission to show alerts the first time someone opens their inbox.
  useEffect(() => { if (signedIn) ensureNotificationPermission(); }, [signedIn]);

  const openItem = async (n: AppNotification) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
      useNotificationStore.getState().setUnread(unread - 1);
      notificationsAPI.markRead(n._id).catch(() => refreshUnread());
    }
    const route = routeForLink(n.link);
    if (route) router.push(route as any);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    useNotificationStore.getState().setUnread(0);
    try { await notificationsAPI.markAllRead(); } catch { refreshUnread(); }
  };

  const shown = useMemo(() => (filter === 'unread' ? items.filter((n) => !n.isRead) : items), [items, filter]);
  // Interleave section labels between the rows.
  const rows = useMemo(() => {
    const out: ({ kind: 'label'; label: string } | { kind: 'item'; n: AppNotification })[] = [];
    let last = '';
    for (const n of shown) {
      const b = bucketOf(n.createdAt);
      if (b !== last) { out.push({ kind: 'label', label: b }); last = b; }
      out.push({ kind: 'item', n });
    }
    return out;
  }, [shown]);

  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';

  const header = (
    <View style={s.head}>
      <View style={s.topRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))} hitSlop={10} style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: themeColors.text }]}>Notifications</Text>
          <Text style={[s.sub, { color: themeColors.textSecondary }]}>
            {unread > 0 ? `${unread} new` : 'You\'re all caught up'}
          </Text>
        </View>
        {unread > 0 ? (
          <Pressable onPress={markAll} style={[s.markAll, { borderColor: line, backgroundColor: themeColors.surface }]} accessibilityRole="button">
            <Ionicons name="checkmark-done" size={15} color={ORANGE} />
            <Text style={[s.markAllText, { color: themeColors.text }]}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      {items.length ? (
        <View style={[s.tabs, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f2f4' }]}>
          {(['all', 'unread'] as const).map((k) => {
            const on = filter === k;
            return (
              <Pressable key={k} onPress={() => setFilter(k)} style={[s.tab, on && [s.tabOn, { backgroundColor: themeColors.surface }]]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[s.tabText, { color: on ? themeColors.text : themeColors.textSecondary }]}>
                  {k === 'all' ? 'All' : `Unread${unread ? ` · ${unread}` : ''}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const Empty = ({ icon, title, body, cta, onCta }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; cta?: string; onCta?: () => void }) => (
    <View style={[s.empty, { backgroundColor: themeColors.surface, borderColor: line }]}>
      <LinearGradient colors={[ORANGE, RED]} style={s.emptyIcon}><Ionicons name={icon} size={26} color="#fff" /></LinearGradient>
      <Text style={[s.emptyTitle, { color: themeColors.text }]}>{title}</Text>
      <Text style={[s.emptyBody, { color: themeColors.textSecondary }]}>{body}</Text>
      {cta && onCta ? (
        <Pressable onPress={onCta} accessibilityRole="button">
          <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>{cta}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!signedIn ? (
        <>
          {header}
          <Empty icon="notifications" title="Sign in to see notifications" body="Answers to your questions, booking updates and trip expenses show up here." cta="Sign in" onCta={() => router.push({ pathname: '/(auth)/login', params: { redirectTo: '/notifications' } } as any)} />
        </>
      ) : loading ? (
        <>{header}<View style={s.state}><ActivityIndicator color={ORANGE} size="large" /></View></>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'label' ? `l-${r.label}-${i}` : r.n._id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={ORANGE} />}
          onEndReached={() => { if (!loadingMore && page < pages) { setLoadingMore(true); load(page + 1); } }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={ORANGE} style={{ marginTop: 12 }} /> : null}
          ListEmptyComponent={
            error ? <Empty icon="cloud-offline" title="Something went wrong" body={error} />
              : filter === 'unread' ? <Empty icon="checkmark-done" title="No unread notifications" body="You've read everything. Nice." />
              : <Empty icon="notifications" title="You're all caught up" body="When someone answers your question, your booking changes or a trip expense is added, it will show up here." cta="Ask the community" onCta={() => router.push('/community' as any)} />
          }
          renderItem={({ item: r }) => {
            if (r.kind === 'label') return <Text style={[s.label, { color: themeColors.textTertiary }]}>{r.label.toUpperCase()}</Text>;
            const n = r.n;
            const k = kindOf(n.type);
            const isNew = !n.isRead;
            return (
              <Pressable
                onPress={() => openItem(n)}
                accessibilityRole="button"
                accessibilityLabel={`${isNew ? 'New. ' : ''}${n.title}`}
                style={({ pressed }) => [
                  s.row,
                  { backgroundColor: isNew ? (isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed') : themeColors.surface, borderColor: isNew ? 'rgba(249,115,22,0.3)' : line },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={s.iconWrap}>
                  {n.actorAvatar ? (
                    <Image source={{ uri: n.actorAvatar }} style={s.avatar} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[s.avatar, { backgroundColor: `${k.color}1A`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name={k.icon} size={20} color={k.color} />
                    </View>
                  )}
                  {n.actorAvatar ? (
                    <View style={[s.kindDot, { backgroundColor: k.color, borderColor: themeColors.surface }]}>
                      <Ionicons name={k.icon} size={9} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.rowTop}>
                    <Text style={[s.kind, { color: k.color }]}>{k.label}</Text>
                    <Text style={[s.when, { color: themeColors.textTertiary }]}>· {timeAgo(n.createdAt)}</Text>
                  </View>
                  <Text style={[s.rowTitle, { color: themeColors.text, fontWeight: isNew ? '800' : '600' }]} numberOfLines={2}>{n.title}</Text>
                  {n.message ? <Text style={[s.rowMsg, { color: themeColors.textSecondary }]} numberOfLines={2}>{n.message}</Text> : null}
                </View>
                {isNew ? <View style={s.newDot} /> : routeForLink(n.link) ? <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  sub: { fontSize: 13, marginTop: 1 },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  markAllText: { fontSize: 12.5, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  tabOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13.5, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3, paddingHorizontal: 18, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 18, padding: 12 },
  iconWrap: { width: 46, height: 46 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  kindDot: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kind: { fontSize: 11.5, fontWeight: '800' },
  when: { fontSize: 11.5 },
  rowTitle: { fontSize: 14.5, lineHeight: 19, marginTop: 2 },
  rowMsg: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  state: { paddingVertical: 60, alignItems: 'center' },
  empty: { marginHorizontal: 16, marginTop: 16, borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
