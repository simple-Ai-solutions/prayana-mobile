// My properties: every stay this vendor lists (any status), with how ready a
// draft is, and — once a property is live or was approved before — quick links
// to its calendar, bookings and reviews.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { staysAPI } from './_components/api';
import { Button, LoadingSpinner } from '../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme/vendorColors';
import { DEV_BYPASS_AUTH } from '../../config/devFlags';
import { usePalette, ScreenHeader, StayStatusBadge, ProgressBar, LinkButton, Banner } from './_components/controls';
import {
  STEPS,
  StaySummary,
  apiError,
  hasOperations,
  plural,
  rupees,
  statusMessage,
  typeLabel,
} from './_components/stayConfig';

const HAVE_READY = [
  "The property's address (stand at the entrance to drop the map pin)",
  'Your room types and nightly prices',
  '5–10 photos (phone photos are fine)',
  'A trade licence, homestay registration or property tax receipt',
];

function StatTile({ icon, label, value, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; tone: 'blue' | 'green' | 'amber' | 'violet' }) {
  const p = usePalette();
  const t = p.soft[tone];
  return (
    <View style={[styles.stat, { backgroundColor: p.c.surface, borderColor: p.c.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.fg} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.statLabel, { color: p.c.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.statValue, { color: p.c.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function StayCard({ stay, onOpen, onGo }: { stay: StaySummary; onOpen: () => void; onGo: (path: string) => void }) {
  const p = usePalette();
  const percent = stay.completeness?.percent ?? 0;
  const setupOpen = ['draft', 'changes_requested'].includes(stay.status) && !stay.moderation?.approvedAt;
  const step = STEPS.find((s) => s.id === stay.onboarding?.lastStep);
  const msg = setupOpen ? null : statusMessage(stay);
  const ops = hasOperations(stay);
  // Filling in from another site (when the list says so); the wizard shows its progress.
  const importing = stay.importJob?.status === 'running';
  const title = stay.name || (importing ? 'Your imported listing' : `New ${typeLabel(stay.propertyType).toLowerCase()}`);
  const meta = [
    typeLabel(stay.propertyType),
    stay.location?.city,
    stay.totalRooms ? plural(stay.totalRooms, 'room') : null,
    stay.fromPrice ? `from ${rupees(stay.fromPrice)}/night` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const msgColor = msg?.tone === 'red' ? p.danger : msg?.tone === 'amber' ? p.warning : msg?.tone === 'green' ? p.success : p.c.textSecondary;

  return (
    <View style={[styles.card, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.8}
        style={styles.cardMain}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${importing ? 'Importing' : `${meta}. ${setupOpen ? `${percent}% ready` : msg?.text || ''}`}`}
        accessibilityHint={importing ? 'See how the import is going' : setupOpen ? 'Continue setting it up' : 'Open the property'}
      >
        {stay.coverPhoto ? (
          <Image source={{ uri: stay.coverPhoto }} style={styles.cover} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.cover, styles.coverEmpty, { backgroundColor: p.soft.gray.bg }]}>
            <Ionicons name="image-outline" size={22} color={p.c.textTertiary} />
          </View>
        )}
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, { color: p.c.text }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <StayStatusBadge status={stay.status} />
          </View>
          {meta && !importing ? (
            <Text style={[styles.meta, { color: p.c.textSecondary }]} numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
          {importing ? (
            <View style={styles.importing}>
              <ActivityIndicator size="small" color={p.brand} />
              <Text style={[styles.importingText, { color: p.brand }]}>Importing…</Text>
            </View>
          ) : setupOpen ? (
            <View style={styles.readiness}>
              <ProgressBar percent={percent} height={6} />
              <Text style={[styles.readinessText, { color: p.c.textSecondary }]}>
                {percent}% ready{step ? ` · next: ${step.label.toLowerCase()}` : ''}
              </Text>
            </View>
          ) : msg ? (
            <Text style={[styles.statusNote, { color: msgColor }]} numberOfLines={3}>
              {msg.text}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.c.textTertiary} />
      </TouchableOpacity>
      {ops ? (
        <View style={[styles.quickRow, { borderTopColor: p.c.border }]}>
          <LinkButton compact icon="calendar-outline" label="Calendar" onPress={() => onGo(`/stays/${stay._id}/calendar`)} accessibilityLabel={`Calendar for ${title}`} />
          <LinkButton compact icon="clipboard-outline" label="Bookings" onPress={() => onGo(`/stays/bookings?stayId=${stay._id}`)} accessibilityLabel={`Bookings for ${title}`} />
          <LinkButton compact icon="star-outline" label="Reviews" onPress={() => onGo(`/stays/reviews?stayId=${stay._id}`)} accessibilityLabel={`Reviews for ${title}`} />
        </View>
      ) : null}
    </View>
  );
}

export default function StaysScreen() {
  const router = useRouter();
  const p = usePalette();
  const [stays, setStays] = useState<StaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res: any = await staysAPI.listMine();
      setStays(Array.isArray(res?.data) ? res.data : []);
      setError(null);
    } catch (e) {
      if (!DEV_BYPASS_AUTH) setError(apiError(e, "Couldn't load your properties"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload on focus so a draft's readiness reflects the wizard you just left.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/activities'));
  const addStay = () => router.push('/stays/new');
  const anyOps = stays.some(hasOperations);
  const live = stays.filter((s) => s.status === 'published').length;
  const inReview = stays.filter((s) => s.status === 'pending_review').length;
  const rooms = stays.reduce((n, s) => n + (s.totalRooms || 0), 0);

  const header = (
    <View>
      <Text style={[styles.lead, { color: p.c.textSecondary }]}>Hotels, homestays, hostels, resorts and villas you rent out on Prayana.</Text>

      {error ? (
        <Banner tone="red" style={styles.gap}>
          <Text style={{ color: p.soft.red.fg, fontSize: fontSize.sm }}>
            {error}{' '}
            <Text style={styles.retry} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
              Try again
            </Text>
          </Text>
        </Banner>
      ) : null}

      {stays.length > 0 ? (
        <View style={styles.stats}>
          <StatTile icon="bed-outline" tone="blue" label="Properties" value={stays.filter((s) => s.status !== 'archived').length} />
          <StatTile icon="checkmark-circle-outline" tone="green" label="Live" value={live} />
          <StatTile icon="time-outline" tone="amber" label="In review" value={inReview} />
          <StatTile icon="key-outline" tone="violet" label="Rooms" value={rooms} />
        </View>
      ) : null}

      {stays.length > 0 ? (
        <View style={styles.actionsRow}>
          <Button title="Add a property" onPress={addStay} icon={<Ionicons name="add" size={18} color="#fff" />} style={styles.flex} />
          {anyOps ? (
            <>
              <LinkButton icon="clipboard-outline" label="Bookings" onPress={() => router.push('/stays/bookings')} />
              <LinkButton icon="star-outline" label="Reviews" onPress={() => router.push('/stays/reviews')} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const empty =
    !loading && !error ? (
      <View style={[styles.emptyCard, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
        <View style={[styles.emptyIcon, { backgroundColor: p.soft.blue.bg }]}>
          <Ionicons name="bed-outline" size={28} color={p.soft.blue.fg} />
        </View>
        <Text style={[styles.emptyTitle, { color: p.c.text }]}>List your hotel, homestay or hostel</Text>
        <Text style={[styles.emptyText, { color: p.c.textSecondary }]}>Takes about 10 minutes. Your progress saves as you go.</Text>
        <Text style={[styles.emptyHave, { color: p.c.text }]}>Have these ready</Text>
        {HAVE_READY.map((t) => (
          <View key={t} style={styles.haveRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={p.success} />
            <Text style={[styles.haveText, { color: p.c.textSecondary }]}>{t}</Text>
          </View>
        ))}
        <Button title="Add a property" onPress={addStay} fullWidth style={styles.emptyBtn} />
      </View>
    ) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top']}>
      <ScreenHeader title="Stays" onBack={back} />
      {loading && !stays.length ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={stays}
          keyExtractor={(s) => s._id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <StayCard stay={item} onOpen={() => router.push(`/stays/${item._id}`)} onGo={(path) => router.push(path as never)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  gap: { marginBottom: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  lead: { fontSize: fontSize.sm, lineHeight: 19, marginBottom: spacing.lg },
  retry: { fontWeight: fontWeight.bold, textDecorationLine: 'underline' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  statIcon: { width: 34, height: 34, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: fontSize.xs },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },

  card: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  cover: { width: 84, height: 72, borderRadius: borderRadius.lg },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flexShrink: 1 },
  badgeRow: { flexDirection: 'row', marginTop: 4 },
  meta: { fontSize: fontSize.xs, marginTop: 4, lineHeight: 16 },
  readiness: { marginTop: spacing.sm, gap: 4 },
  readinessText: { fontSize: fontSize.xs },
  importing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  importingText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  statusNote: { fontSize: fontSize.xs, marginTop: spacing.xs, lineHeight: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

  emptyCard: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.xl, alignItems: 'flex-start' },
  emptyIcon: { width: 52, height: 52, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  emptyText: { fontSize: fontSize.sm, marginTop: 4, lineHeight: 19 },
  emptyHave: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.xs },
  haveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  haveText: { fontSize: fontSize.sm, flex: 1, lineHeight: 19 },
  emptyBtn: { marginTop: spacing.xl },
});
