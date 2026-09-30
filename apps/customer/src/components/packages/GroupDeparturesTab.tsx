// Group Tours — the PWA's "departures" hero tab, ported.
//
// The web fetches GET /packages/search?hasDepartures=true&limit=200&view=card:
// a SERVER-side filter, not a tag. Querying tags=fixeddeparture (what the app
// did elsewhere) finds only 9 packages and misses Manali's 120 departures;
// hasDepartures returns 11.
//
// Two details the web gets right and a naive port gets wrong:
//   1. The headline price is the cheapest SEAT price, from
//      departures[].variantOverrides.prices[variant].pricePerPerson — not
//      pricing.startingFrom, which is the private (higher) rate.
//   2. `prices` is an OBJECT keyed by variant name, not an array.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius, useTheme } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../lib/imageUrl';

const { width: SCREEN_W } = Dimensions.get('window');

type Departure = {
  _id: string;
  startDate: string;
  endDate?: string;
  status?: string;
  availableSlots?: number;
  bookedSlots?: number;
  variantOverrides?: { prices?: Record<string, { pricePerPerson?: number; displayName?: string }> };
};

export type DeparturePkg = {
  _id: string;
  title: string;
  slug?: string;
  images?: any[];
  coverImage?: string;
  departures?: Departure[];
  duration?: { days?: number; nights?: number };
  destinations?: { country?: string; city?: string; name?: string }[];
  pricing?: { startingFrom?: number };
};

type Scope = 'all' | 'domestic' | 'international';

/** Open, not sold out, and still in the future — sorted soonest first. */
export function upcomingDepartures(p: DeparturePkg): Departure[] {
  const now = Date.now();
  return (p.departures || [])
    .filter((d) => d.status === 'open')
    .filter((d) => (d.bookedSlots ?? 0) < (d.availableSlots ?? 0))
    .filter((d) => {
      const t = new Date(d.startDate).getTime();
      return Number.isFinite(t) && t > now;
    })
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
}

/** Cheapest seat across every open departure, matching the web's "From". */
function seatPriceFrom(p: DeparturePkg): number | null {
  const prices: number[] = [];
  for (const d of upcomingDepartures(p)) {
    const table = d.variantOverrides?.prices;
    if (!table) continue;
    for (const key of Object.keys(table)) {
      const v = table[key]?.pricePerPerson;
      if (typeof v === 'number' && v > 0) prices.push(v);
    }
  }
  if (prices.length) return Math.min(...prices);
  return typeof p.pricing?.startingFrom === 'number' ? p.pricing.startingFrom : null;
}

/** Local calendar fields — toISOString() shifts the day for anyone east of UTC. */
const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const chipLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return { day: '--', mon: '' };
  return {
    day: String(d.getDate()),
    mon: d.toLocaleDateString('en-IN', { month: 'short' }),
  };
};

const isDomestic = (p: DeparturePkg) =>
  ((p.destinations?.[0]?.country || 'India') === 'India');

const coverOf = (p: DeparturePkg): string | null => {
  const raw =
    p.coverImage ||
    (typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url || p.images?.[0]?.s3Url);
  return raw ? normalizeImageUrl(raw) : null;
};

function DepartureCard({
  pkg,
  onPress,
  onPickDate,
}: {
  pkg: DeparturePkg;
  onPress: () => void;
  onPickDate: (iso: string) => void;
}) {
  const { themeColors } = useTheme();
  const ups = upcomingDepartures(pkg);
  const next = ups[0];
  const price = seatPriceFrom(pkg);
  const cover = coverOf(pkg);
  const seatsLeft = next ? (next.availableSlots ?? 0) - (next.bookedSlots ?? 0) : 0;
  const urgent = next && seatsLeft > 0 && seatsLeft <= 5;
  const nights = pkg.duration?.nights;
  const days = pkg.duration?.days;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
    >
      <View style={styles.cardImageWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cardImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: themeColors.backgroundSecondary }]} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={styles.cardScrim}
          pointerEvents="none"
        />
        <View style={styles.badgeRow} pointerEvents="none">
          <View style={styles.depBadge}>
            <Ionicons name="people" size={11} color="#fff" />
            <Text style={styles.depBadgeText}>
              {ups.length} departure{ups.length === 1 ? '' : 's'}
            </Text>
          </View>
          {urgent ? (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>{seatsLeft} seats left</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
          {pkg.title}
        </Text>
        {days && nights ? (
          <Text style={[styles.cardMeta, { color: themeColors.textTertiary }]}>
            {days}D / {nights}N
          </Text>
        ) : null}

        {ups.length > 0 ? (
          <>
            <View style={styles.pickRow}>
              <Ionicons name="calendar-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.pickLabel, { color: themeColors.textTertiary }]}>PICK A DATE</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {ups.slice(0, 4).map((d) => {
                const { day, mon } = chipLabel(d.startDate);
                return (
                  <TouchableOpacity
                    key={d._id}
                    onPress={() => onPickDate(localISO(new Date(d.startDate)))}
                    style={[styles.chip, { borderColor: colors.accent[300] }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipDay, { color: colors.accent[700] }]}>{day}</Text>
                    <Text style={[styles.chipMon, { color: colors.accent[600] }]}>{mon}</Text>
                  </TouchableOpacity>
                );
              })}
              {ups.length > 4 ? (
                <View style={[styles.chipMore, { borderColor: themeColors.border }]}>
                  <Text style={[styles.chipMoreText, { color: themeColors.textSecondary }]}>
                    +{ups.length - 4}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.priceRow}>
          <View>
            <Text style={[styles.fromLabel, { color: themeColors.textTertiary }]}>From</Text>
            <Text style={[styles.price, { color: colors.accent[600] }]}>
              ₹{(price || 0).toLocaleString('en-IN')}
              <Text style={[styles.perPerson, { color: themeColors.textTertiary }]}> / person</Text>
            </Text>
          </View>
          <View style={styles.viewDates}>
            <Text style={[styles.viewDatesText, { color: colors.accent[600] }]}>View dates</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.accent[600]} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function GroupDeparturesTab({
  onOpenPackage,
}: {
  onOpenPackage: (pkg: DeparturePkg, dateISO?: string) => void;
}) {
  const { themeColors } = useTheme();
  const [rows, setRows] = useState<DeparturePkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await holidayPackagesAPI.search({
        hasDepartures: true,
        limit: 200,
        view: 'card',
      });
      const list: DeparturePkg[] = res?.data?.packages || res?.packages || res?.data || [];
      // Safety net mirroring the web: only keep packages that still have a
      // bookable upcoming departure, so we never show a card that dead-ends.
      setRows((Array.isArray(list) ? list : []).filter((p) => upcomingDepartures(p).length > 0));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const domestic = useMemo(() => rows.filter(isDomestic), [rows]);
  const international = useMemo(() => rows.filter((p) => !isDomestic(p)), [rows]);
  const shown = scope === 'domestic' ? domestic : scope === 'international' ? international : rows;
  const showToggle = domestic.length > 0 && international.length > 0;

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={colors.accent[500]} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.centre}>
        <Ionicons name="calendar-outline" size={36} color={themeColors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No group departures yet</Text>
        <Text style={[styles.emptyBody, { color: themeColors.textTertiary }]}>
          Fixed-date tours will appear here as operators publish them.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.lede, { color: themeColors.textSecondary }]}>
        Set dates, a fixed price and a coordinator throughout — you join a group of fellow travellers
        rather than planning the route yourself.
      </Text>

      {showToggle ? (
        <View style={[styles.scopeRow, { borderColor: themeColors.border }]}>
          {([
            ['all', 'All', rows.length],
            ['domestic', 'In India', domestic.length],
            ['international', 'International', international.length],
          ] as [Scope, string, number][]).map(([key, label, count]) => {
            const active = scope === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setScope(key)}
                style={[styles.scopeBtn, active && { backgroundColor: colors.accent[500] }]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.scopeText,
                    { color: active ? '#fff' : themeColors.textSecondary },
                  ]}
                >
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <Text style={[styles.count, { color: themeColors.textTertiary }]}>
        {shown.length} departure{shown.length === 1 ? '' : 's'}
      </Text>

      {shown.map((pkg) => (
        <DepartureCard
          key={pkg._id}
          pkg={pkg}
          onPress={() => onOpenPackage(pkg)}
          onPickDate={(iso) => onOpenPackage(pkg, iso)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 10 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },
  emptyBody: { fontSize: fontSize.sm, textAlign: 'center' },
  lede: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.md },

  scopeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 4,
    marginBottom: spacing.md,
  },
  scopeBtn: { flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: 'center' },
  scopeText: { fontSize: 12, fontWeight: fontWeight.semibold as any },

  count: { fontSize: fontSize.xs, marginBottom: spacing.sm },

  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  cardImageWrap: { height: 150, width: '100%' },
  cardImage: { width: '100%', height: '100%' },
  cardScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 70 },
  badgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  depBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  depBadgeText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.semibold as any },
  urgentBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  urgentText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold as any },

  cardBody: { padding: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold as any, lineHeight: 21 },
  cardMeta: { fontSize: fontSize.xs, marginTop: 3 },

  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  pickLabel: { fontSize: 10, fontWeight: fontWeight.bold as any, letterSpacing: 0.6 },
  chipRow: { gap: 8, paddingTop: 8, paddingBottom: 2 },
  chip: {
    width: 52,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipDay: { fontSize: 15, fontWeight: fontWeight.bold as any },
  chipMon: { fontSize: 10, textTransform: 'uppercase' },
  chipMore: {
    width: 52,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMoreText: { fontSize: 12, fontWeight: fontWeight.semibold as any },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  fromLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },
  perPerson: { fontSize: fontSize.xs, fontWeight: fontWeight.medium as any },
  viewDates: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDatesText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any },
});
