// Two home rails that sit between "More ways to explore" and "Discover by
// Interest", ported from the web home page:
//   TrekkingRail   — components/activities/TrekkingHomeRail + TrekOverlayCard
//   ValueDealsRail — components/packages/ValueDealsRail
//
// Both cards are the same shell: a 3:4 photo, a bottom scrim covering the
// lower 62%, and white text over it. Only the overlay contents differ, so the
// shell lives in one component here rather than being written twice.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme, spacing, fontWeight } from '@prayana/shared-ui';
import { activityMarketplaceAPI, holidayPackagesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../lib/imageUrl';

const TREK_ACCENT = '#16A34A';   // green icon tile on the trekking rail
const DEALS_ACCENT = '#10B981';  // emerald icon tile on the deals rail
const CARD_W = 178;
const CARD_H = Math.round((CARD_W * 4) / 3); // aspect 3:4

const inr = (n?: number) => Number(n || 0).toLocaleString('en-IN');

const primaryImage = (images?: any[]): string | undefined => {
  const list = Array.isArray(images) ? images : [];
  const pick = list.find((i) => i?.isPrimary && i?.url) || list.find((i) => i?.url);
  return pick?.url ? normalizeImageUrl(pick.url) : undefined;
};

/** Shared photo card: image, scrim, and whatever overlay the rail supplies. */
function OverlayCard({
  image, onPress, children, topLeft, topRight,
}: {
  image?: string;
  onPress: () => void;
  children: React.ReactNode;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover"
          transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cardPh]} />
      )}
      {/* Scrim over the bottom 62%, matching the web gradient stops. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']}
        style={styles.scrim}
      />
      {topLeft}
      {topRight}
      <View style={styles.cardBody}>{children}</View>
    </Pressable>
  );
}

function RailHeader({
  icon, tint, title, subtitle, onSeeAll,
}: { icon: any; tint: string; title: string; subtitle: string; onSeeAll: () => void }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.headerSub, { color: themeColors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={onSeeAll}
        style={[styles.seeAll, { borderColor: themeColors.border }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="See all"
      >
        <Ionicons name="arrow-forward" size={16} color={themeColors.textSecondary} />
      </Pressable>
    </View>
  );
}

// ── Trek with strangers, or bring your crew ──────────────────────────────
export function TrekkingRail() {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let alive = true;
    activityMarketplaceAPI
      .searchActivities({ category: 'Trekking', limit: 12, page: 1, sort: 'rating' })
      .then((res: any) => {
        if (!alive) return;
        const raw = Array.isArray(res?.data) ? res.data : res?.data?.activities || [];
        setItems(raw.filter((a: any) => !a.source || a.source === 'internal'));
      })
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, []);

  // The web hides this below two results rather than showing a lone card.
  if (!items || items.length < 2) return null;

  return (
    <View style={styles.section}>
      <RailHeader
        icon="footsteps"
        tint={TREK_ACCENT}
        title="Trek with strangers, or bring your crew"
        subtitle="Weekend trails and Himalayan expeditions — join a solo-traveller group or book the whole departure for your people."
        onSeeAll={() => router.push('/experiences/trekking-hikes' as any)}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {items.map((a) => {
          const price = a.platformSellingPrice || a.pricing?.basePrice || 0;
          const perLabel = a.pricing?.priceType === 'per_person' ? '/person' : '/group';
          const maxGroup = a.groupSize?.max || 0;
          const bookings = a.stats?.totalBookings || 0;
          // Badge precedence matches the web: popularity, then private, then size.
          const badge =
            bookings >= 10 ? 'POPULAR' : a.isPrivate ? 'PRIVATE'
              : maxGroup > 0 && maxGroup < 10 ? 'SMALL GROUP' : null;
          const dur = a.duration?.label
            || (a.duration?.value ? `${a.duration.value} ${a.duration.unit || 'days'}` : '');
          const place = [a.location?.city, a.location?.state].filter(Boolean).join(', ');

          return (
            <OverlayCard
              key={a._id}
              image={primaryImage(a.images)}
              onPress={() => router.push(`/activity/${a._id}` as any)}
              topLeft={badge ? (
                <View style={styles.badge}>
                  <View style={styles.badgeDot} />
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            >
              {!!place && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.place} numberOfLines={1}>{place}</Text>
                </View>
              )}
              <Text style={styles.title} numberOfLines={2}>{a.title}</Text>
              {(!!dur || maxGroup > 0) && (
                <View style={styles.metaRow}>
                  {!!dur && <Text style={styles.meta}>{dur}</Text>}
                  {!!dur && maxGroup > 0 && <Text style={styles.meta}> · </Text>}
                  {maxGroup > 0 && <Text style={styles.meta}>up to {maxGroup}</Text>}
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={styles.price}>
                  ₹{inr(price)}<Text style={styles.per}>{perLabel}</Text>
                </Text>
                <View style={styles.bookBtn}>
                  <Text style={styles.bookText}>Book</Text>
                </View>
              </View>
            </OverlayCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Last-minute deals ────────────────────────────────────────────────────
export function ValueDealsRail() {
  const [deals, setDeals] = useState<any[] | null>(null);

  useEffect(() => {
    let alive = true;
    holidayPackagesAPI
      .getValueDeals({ maxPrice: 25000, limit: 12, only: 'Thailand,Indonesia,Andaman & Nicobar Islands' })
      .then((res: any) => alive && setDeals(res?.data || []))
      .catch(() => alive && setDeals([]));
    return () => { alive = false; };
  }, []);

  if (!deals || deals.length === 0) return null;

  return (
    <View style={styles.section}>
      <RailHeader
        icon="pricetag"
        tint={DEALS_ACCENT}
        title="Last-minute deals"
        subtitle="Andaman, Bali and Thailand — our lowest prices, ready to book now."
        onSeeAll={() => router.push('/packages?maxBudget=25000' as any)}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {deals.map((p) => {
          const listPrice = p.pricing?.startingFrom || 0;
          const sell = p.platformSellingPrice || listPrice;
          const mrp = p.platformMRP || 0;
          const pct = p.platformDiscountPercent || 0;
          // Only strike through when there is a genuine markup to discount from.
          const hasDiscount = pct > 0 && mrp > sell;
          const notice = p.availability?.advanceBookingDays || 0;

          return (
            <OverlayCard
              key={p._id}
              image={primaryImage(p.images)}
              // Deals route by slug; the trek cards route by _id.
              onPress={() => router.push(`/packages/${encodeURIComponent(p._id)}` as any)}
              topLeft={notice > 0 ? (
                <View style={styles.badge}>
                  <Ionicons name="time-outline" size={8} color="#fff" />
                  <Text style={styles.badgeText}>Book {notice}d ahead</Text>
                </View>
              ) : null}
              topRight={hasDiscount ? (
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>{pct}% OFF</Text>
                </View>
              ) : null}
            >
              {!!p.dealDestination && (
                <Text style={styles.place} numberOfLines={1}>{p.dealDestination}</Text>
              )}
              <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
              {p.duration?.nights ? (
                <Text style={styles.meta}>{p.duration.nights}N / {p.duration.days}D</Text>
              ) : null}
              <View style={styles.priceRow}>
                <View>
                  {hasDiscount && <Text style={styles.strike}>₹{inr(mrp)}</Text>}
                  <Text style={[styles.price, hasDiscount && { color: '#86EFAC' }]}>
                    ₹{inr(sell)}<Text style={styles.per}>/person</Text>
                  </Text>
                </View>
              </View>
            </OverlayCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  seeAll: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rail: { gap: 16, paddingHorizontal: spacing.lg },

  card: { width: CARD_W, height: CARD_H, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  cardPh: { backgroundColor: '#e5e7eb' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  cardBody: { position: 'absolute', left: 10, right: 10, bottom: 10 },

  badge: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#34D399' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  discountPill: {
    position: 'absolute', top: 10, right: 10, backgroundColor: '#22C55E',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  discountText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold },

  place: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginBottom: 1 },
  title: { color: '#fff', fontSize: 12.5, fontWeight: fontWeight.bold, lineHeight: 16, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  priceRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  strike: { color: 'rgba(255,255,255,0.6)', fontSize: 9, textDecorationLine: 'line-through', marginBottom: 1 },
  price: { color: '#fff', fontSize: 14, fontWeight: fontWeight.bold },
  per: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: fontWeight.normal },
  bookBtn: { backgroundColor: '#F97316', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  bookText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.semibold },
});
