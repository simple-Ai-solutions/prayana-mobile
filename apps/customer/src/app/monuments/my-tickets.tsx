// /monuments/my-tickets — booking history for ONDC monument tickets.
// Mobile port of web app/monuments/my-tickets/page.js. Loads confirmed txns via
// ondcAPI.getMyTickets, groups by status, shows QR on tap.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, Image, Modal } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { ondcAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const SAFFRON = '#E38B29';

const STATUS_COLORS: Record<string, string> = {
  issued: '#10B981', used: '#6B7280', pending: '#F59E0B',
  cancelled: '#EF4444', expired: '#9CA3AF',
};

type Ticket = {
  transactionId: string;
  ondcOrderId?: string;
  ticketStatus?: string;
  qrCode?: string;
  payment?: { amount?: number; currency?: string };
  order?: any;
  searchIntent?: { monumentName?: string; city?: string };
  visitors?: any[];
  createdAt?: string;
};

const monumentNameOf = (t: Ticket) =>
  t.searchIntent?.monumentName || t.order?.items?.[0]?.descriptor?.name || 'Monument ticket';

export default function MyTicketsScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();
  const meUid = (user as any)?.uid;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'all' | 'issued' | 'used' | 'cancelled'>('all');
  const [qr, setQr] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    if (!meUid || meUid === 'guest-user') { setLoading(false); return; }
    try {
      const res: any = await ondcAPI.getMyTickets();
      setTickets(Array.isArray(res?.tickets) ? res.tickets : []);
    } catch {
      // keep prior; pull to refresh
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [meUid]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const filtered = useMemo(
    () => (tab === 'all' ? tickets : tickets.filter((t) => (t.ticketStatus || 'issued') === tab)),
    [tickets, tab]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>My Tickets</Text>
        <TouchableOpacity onPress={() => router.push('/monuments' as any)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add" size={24} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs}>
        {(['all', 'issued', 'used', 'cancelled'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, { borderColor: tab === t ? SAFFRON : themeColors.border, backgroundColor: tab === t ? SAFFRON + '22' : 'transparent' }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? SAFFRON : themeColors.textSecondary }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={SAFFRON} /></View>
      ) : !meUid || meUid === 'guest-user' ? (
        <View style={styles.center}>
          <Ionicons name="ticket-outline" size={44} color={themeColors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Sign in to see your tickets</Text>
          <TouchableOpacity style={[styles.cta, { backgroundColor: SAFFRON }]} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.ctaText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SAFFRON} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="ticket-outline" size={48} color={themeColors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No tickets yet</Text>
              <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Book ASI monument tickets and they’ll show up here.</Text>
              <TouchableOpacity style={[styles.cta, { backgroundColor: SAFFRON }]} onPress={() => router.push('/monuments' as any)}>
                <Text style={styles.ctaText}>Book a ticket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((t) => {
              const status = t.ticketStatus || 'issued';
              const color = STATUS_COLORS[status] || themeColors.textSecondary;
              return (
                <TouchableOpacity
                  key={t.transactionId}
                  activeOpacity={0.85}
                  style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  onPress={() => t.qrCode && setQr(t)}
                >
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>{monumentNameOf(t)}</Text>
                    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.badgeText, { color }]}>{status}</Text>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    <Meta c={themeColors} icon="people-outline" text={`${t.visitors?.length || 1} visitor${(t.visitors?.length || 1) > 1 ? 's' : ''}`} />
                    {t.payment?.amount != null && <Meta c={themeColors} icon="pricetag-outline" text={`₹${Number(t.payment.amount).toLocaleString('en-IN')}`} />}
                    {!!t.ondcOrderId && <Meta c={themeColors} icon="receipt-outline" text={t.ondcOrderId} />}
                  </View>
                  {!!t.qrCode && (
                    <Text style={[styles.tapHint, { color: SAFFRON }]}>Tap to show entry QR ›</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* QR modal */}
      <Modal visible={!!qr} transparent animationType="fade" onRequestClose={() => setQr(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{qr ? monumentNameOf(qr) : ''}</Text>
            {qr?.qrCode && <QRImage value={qr.qrCode} />}
            <Text style={[styles.modalHint, { color: themeColors.textSecondary }]}>Show this at the monument entry gate.</Text>
            <TouchableOpacity style={[styles.cta, { backgroundColor: SAFFRON, alignSelf: 'stretch' }]} onPress={() => setQr(null)}>
              <Text style={styles.ctaText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Meta({ c, icon, text }: { c: any; icon: any; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={c.textSecondary} />
      <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function QRImage({ value }: { value: string }) {
  const isDataOrUrl = /^https?:\/\//.test(value) || value.startsWith('data:');
  const uri = isDataOrUrl ? value : `data:image/png;base64,${value}`;
  return <Image source={{ uri }} style={styles.qrImg} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },

  tabsWrap: { flexGrow: 0 },
  tabs: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  tab: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'capitalize' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: fontSize.xs },
  tapHint: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  emptyBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'] },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptySub: { fontSize: fontSize.sm, textAlign: 'center', maxWidth: 260 },

  cta: { borderRadius: 999, alignItems: 'center', paddingVertical: 13, paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  ctaText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: { width: '100%', borderRadius: borderRadius.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  modalHint: { fontSize: fontSize.sm, textAlign: 'center' },
  qrImg: { width: 220, height: 220 },
});
