import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { normalizeImageUrl } from '../../../lib/imageUrl';
import { openInApp } from '../../../lib/openInApp';
import { useIsha, type IshaPalette } from '../ishaTheme';
import { appRouteFor } from '../links';
import { SectionLabel } from '../ui';
import type { InventoryItem } from '../types';

// Header above the cards. `mixed` covers a turn that returned more than one kind.
const HEADERS: Record<string, string> = {
  package: 'Holiday packages',
  transport: 'Rentals for you',
  cab: 'Outstation cabs',
  activity: 'Things to book',
  global_activity: 'Experiences to book',
  captain_tour: 'Captain-led group trips',
  mixed: 'Available to book',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const KIND_ICON: Record<string, IconName> = {
  package: 'cube-outline',
  transport: 'car-outline',
  cab: 'car-outline',
  activity: 'ticket-outline',
  global_activity: 'compass-outline',
  captain_tour: 'people-outline',
};

// Partner inventory is priced in its own currency, so ₹ can't be assumed
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿', AUD: 'A$', JPY: '¥',
};
export const formatMoney = (amount: number, currency = 'INR') =>
  `${CURRENCY_SYMBOLS[currency] || `${currency} `}${Math.round(amount).toLocaleString('en-IN')}`;

const kindOf = (items: InventoryItem[]) => {
  const kinds = [...new Set(items.map((i) => i?.kind).filter(Boolean))];
  if (kinds.length === 1 && HEADERS[kinds[0]]) return kinds[0];
  return kinds.length > 1 ? 'mixed' : 'activity';
};

function detailLine(item: InventoryItem) {
  if (item.routeTo) return `${item.routeFrom} → ${item.routeTo}${item.distanceKm ? ` · ${item.distanceKm} km` : ''}`;
  const parts: string[] = [];
  if (item.nights != null && item.days != null) parts.push(`${item.nights}N / ${item.days}D`);
  if (item.duration) parts.push(item.duration);
  if (item.location) parts.push(item.location);
  return parts.join(' · ');
}

// Only evidence the server actually sent: no reviews shows none, not a made-up count
function Evidence({ item, t }: { item: InventoryItem; t: IshaPalette }) {
  const hasRating = typeof item.rating === 'number' && item.rating > 0 && (item.reviewCount || 0) > 0;
  const hasBookings = typeof item.bookings === 'number' && item.bookings > 0;
  if (!hasRating && !hasBookings) return null;
  return (
    <View style={styles.evidence}>
      {hasRating && (
        <View style={styles.inline}>
          <Ionicons name="star" size={13} color={t.star} />
          <Text style={[styles.evText, { color: t.body }]}>
            <Text style={{ fontWeight: '600' }}>{(item.rating as number).toFixed(1)}</Text> from{' '}
            {(item.reviewCount as number).toLocaleString('en-IN')} reviews
          </Text>
        </View>
      )}
      {hasRating && hasBookings && <Text style={{ color: t.borderStrong }}>|</Text>}
      {hasBookings && (
        <Text style={[styles.evText, { color: t.body }]}>{(item.bookings as number).toLocaleString('en-IN')} booked</Text>
      )}
    </View>
  );
}

function Price({ item, t, large = false }: { item: InventoryItem; t: IshaPalette; large?: boolean }) {
  if (item.price == null) return null;
  const size = large ? 18 : 13;
  return (
    <Text style={{ color: t.text }} numberOfLines={1}>
      <Text style={{ fontSize: size, fontWeight: '700' }}>
        {formatMoney(item.offer ? item.offer.finalPrice : item.price, item.currency)}
      </Text>
      {item.offer ? (
        <Text style={[styles.strike, { color: t.faint }]}> {formatMoney(item.price, item.currency)}</Text>
      ) : null}
      {item.priceSuffix ? <Text style={[styles.suffix, { color: t.muted }]}> {item.priceSuffix}</Text> : null}
    </Text>
  );
}

function Thumb({ item, style, iconSize = 22, t }: { item: InventoryItem; style: object; iconSize?: number; t: IshaPalette }) {
  return item.image ? (
    <Image source={{ uri: normalizeImageUrl(item.image) }} style={[{ backgroundColor: t.sunken }, style]} contentFit="cover" transition={150} />
  ) : (
    <View style={[{ backgroundColor: t.sunken, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={KIND_ICON[item.kind] || 'map-outline'} size={iconSize} color={t.faint} />
    </View>
  );
}

/**
 * Prayana's own bookable products for this reply. The first is Isha's pick,
 * shown in full with the evidence behind it; the rest are compact alternatives.
 */
export default function InventoryCards({ inventory }: { inventory: InventoryItem[] }) {
  const t = useIsha();
  const router = useRouter();
  const items = (inventory || []).filter((i) => i && i.title).slice(0, 4);
  if (!items.length) return null;
  const [pick, ...rest] = items;

  // Partner listings open the partner's page; ours open the app's screen
  const open = (item: InventoryItem) => {
    const web = !!item.url && /^https?:/i.test(item.url);
    const route = appRouteFor(item.url);
    if (item.external && web) openInApp(item.url as string);
    else if (route) router.push(route as never);
    else if (web) openInApp(item.url as string);
    else router.push('/activities' as never);
  };

  return (
    <View style={{ gap: 10 }} accessibilityLabel={HEADERS[kindOf(items)]}>
      <SectionLabel>{HEADERS[kindOf(items)]}</SectionLabel>

      <Pressable
        onPress={() => open(pick)}
        accessibilityRole="button"
        accessibilityLabel={`${pick.title}. View`}
        style={({ pressed }) => [styles.pick, { borderColor: t.border, backgroundColor: t.surface }, pressed && { opacity: 0.9 }]}
      >
        <View>
          <Thumb item={pick} style={styles.pickPhoto} iconSize={32} t={t} />
          {items.length > 1 && (
            <View style={[styles.badge, { backgroundColor: t.ink }]}>
              <Ionicons name="star" size={10} color={t.onInk} />
              <Text style={[styles.badgeText, { color: t.onInk }]}>Isha's pick</Text>
            </View>
          )}
        </View>
        <View style={styles.pickBody}>
          <View>
            <Text style={[styles.pickTitle, { color: t.text }]} numberOfLines={2}>
              {pick.title}
            </Text>
            {!!detailLine(pick) && (
              <Text style={[styles.detail, { color: t.muted }]} numberOfLines={1}>
                {detailLine(pick)}
              </Text>
            )}
          </View>
          <Evidence item={pick} t={t} />
          {!!pick.offer?.label && (
            <View style={[styles.offer, { backgroundColor: t.isDark ? 'rgba(6,78,59,0.5)' : '#ecfdf5' }]}>
              <Ionicons name="pricetag-outline" size={13} color={t.success} />
              <Text style={[styles.offerText, { color: t.isDark ? '#6ee7b7' : '#065f46' }]}>{pick.offer.label}</Text>
            </View>
          )}
          <View style={styles.pickFoot}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Price item={pick} t={t} large />
            </View>
            <View style={[styles.view, { backgroundColor: t.ink }]}>
              <Text style={[styles.viewText, { color: t.onInk }]}>View</Text>
              <Ionicons name="chevron-forward" size={15} color={t.onInk} />
            </View>
          </View>
        </View>
      </Pressable>

      {rest.map((item, idx) => (
        <Pressable
          key={item.id || idx}
          onPress={() => open(item)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={({ pressed }) => [styles.alt, { borderColor: t.border, backgroundColor: pressed ? t.pressed : t.surface }]}
        >
          <Thumb item={item} style={styles.altPhoto} iconSize={18} t={t} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.altTitle, { color: t.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.inline}>
              <Price item={item} t={t} />
              {!!detailLine(item) && (
                <Text style={[styles.altDetail, { color: t.muted }]} numberOfLines={1}>
                  · {detailLine(item)}
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.faint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pick: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  pickPhoto: { width: '100%', height: 132 },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  pickBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 8 },
  pickTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  detail: { fontSize: 12.5, marginTop: 2 },
  evidence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  evText: { fontSize: 12.5, lineHeight: 18 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  offerText: { fontSize: 12.5, fontWeight: '500' },
  pickFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  view: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 40, paddingHorizontal: 16, borderRadius: 12 },
  viewText: { fontSize: 13.5, fontWeight: '600' },
  strike: { fontSize: 12, textDecorationLine: 'line-through' },
  suffix: { fontSize: 12 },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 8 },
  altPhoto: { width: 48, height: 48, borderRadius: 12 },
  altTitle: { fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  altDetail: { fontSize: 12, flexShrink: 1 },
});
