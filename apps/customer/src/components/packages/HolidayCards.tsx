// Holiday Deals cards, phone-first (in the spirit of MakeMyTrip / District):
//   - ThemeTiles: "Holidays by theme", round photo tiles three across;
//   - DealPoster: a wide featured poster, swiped one at a time;
//   - DealTile: a two-up last-minute deal with its saving up front;
//   - HolidayCard: the list card — photo with days and places, inclusions as
//     icons, the per-person price with MRP struck through, and View deal.
// Prices: the platform's own selling price / MRP / discount where set (what
// the checkout charges), else pricing.startingFrom.
import React, { useState } from 'react';
import { CARD_TITLE } from '../../lib/typeScale';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { FULL_W, TWO_UP_W } from '../../lib/railLayout';
import { fallbackPhoto } from '../../lib/fallbackPhoto';

export // The app's orange (packages used their own blue).
const BLUE = '#f97316';
const NAVY = '#0b2a4a';

export function pkgImage(pkg: any): string | undefined {
  const imgs = pkg?.images || [];
  const primary = imgs.find((i: any) => i?.isPrimary && i.url);
  const url = (primary || imgs.find((i: any) => i?.url))?.url;
  return url ? normalizeImageUrl(url) : undefined;
}

export function pkgPrice(pkg: any) {
  const price = pkg?.platformSellingPrice || pkg?.pricing?.startingFrom || 0;
  const mrpRaw = pkg?.platformMRP || pkg?.pricing?.mrp || 0;
  const mrp = mrpRaw > price ? mrpRaw : 0;
  const off = pkg?.platformDiscountPercent || (mrp ? Math.round((1 - price / mrp) * 100) : 0);
  return { price, mrp, off };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** "Manali · Kasol · Kullu" from the stops, else the primary destination. */
export function pkgPlaces(pkg: any): string {
  const names = (pkg?.destinations || []).map((d: any) => d?.name || d?.city).filter(Boolean);
  const uniq = [...new Set(names)] as string[];
  if (uniq.length) return uniq.slice(0, 3).join(' · ') + (uniq.length > 3 ? ` +${uniq.length - 3}` : '');
  return pkg?.primaryDestination || [pkg?.destination?.city, pkg?.destination?.state].filter(Boolean).join(', ');
}

/** The title before its " — 5N/6D" tail, which the card already shows. */
/**
 * The name for a card. Most titles are "Name — places", so the part before
 * the dash is enough. But "Thailand 3N/4D — Pattaya & Bangkok" kept only
 * "Thailand 3N/4D" (the nights are on the card already): when the lead is just
 * a place and a duration, show "Thailand · Pattaya & Bangkok" instead.
 */
export const shortTitle = (t?: string) => {
  const full = String(t || '').trim();
  const [lead, ...rest] = full.split(/\s+[—–]\s+/);
  const tail = rest.join(' — ').replace(/\s*\([^)]*\)/g, '').replace(/,?\s*\d+\s*N(ights)?\s*\/?\s*\d+\s*D(ays)?$/i, '').trim();
  const m = (lead || '').match(/^(.+?)\s+\d+\s*N\s*\/\s*\d+\s*D$/i);
  if (m && tail) return `${m[1]} · ${tail}`;
  return lead || full;
};

export function nightsDays(pkg: any) {
  const d = pkg?.duration?.days || 0;
  const n = pkg?.duration?.nights ?? Math.max(0, d - 1);
  return d ? `${n}N/${d}D` : '';
}

// Inclusion icons, read from the package's own inclusion lines.
const PERKS: { test: RegExp; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { test: /flight|airfare/i, icon: 'airplane', label: 'Flights' },
  { test: /hotel|stay|accommodation|night|resort|camp|tent/i, icon: 'bed', label: 'Stay' },
  { test: /breakfast|lunch|dinner|meal/i, icon: 'restaurant', label: 'Meals' },
  { test: /transfer|cab|coach|car|vehicle|traveller|bus|pickup|drop/i, icon: 'car', label: 'Transfers' },
  { test: /sightseeing|tour|guide|visit/i, icon: 'camera', label: 'Sightseeing' },
];
export function pkgPerks(pkg: any) {
  const lines: string[] = pkg?.inclusions || [];
  return PERKS.filter((p) => lines.some((l) => p.test.test(l))).slice(0, 4);
}
/** Every perk with whether the package's inclusions mention it (for Compare). */
export function pkgPerkChecks(pkg: any) {
  const lines: string[] = pkg?.inclusions || [];
  return PERKS.map((p) => ({ ...p, has: lines.some((l) => p.test.test(l)) }));
}

/* ─── Theme tiles ─── */

export const THEMES: { key: string; label: string; image: string }[] = [
  { key: 'Honeymoon', label: 'Honeymoon', image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=80' },
  { key: 'Family', label: 'Family', image: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=400&q=80' },
  { key: 'Beach', label: 'Beaches', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80' },
  { key: 'Hill Station', label: 'Hills', image: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=400&q=80' },
  { key: 'Pilgrimage', label: 'Pilgrimage', image: 'https://images.unsplash.com/photo-1627894483216-2138af692e32?w=400&q=80' },
  { key: 'Adventure Trek', label: 'Adventure', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80' },
];

export function ThemeTiles({ active, onPick }: { active: string; onPick: (key: string) => void }) {
  return (
    <View style={s.themes}>
      {THEMES.map((t) => {
        const on = active === t.key;
        return (
          // Photo tiles with the name on them: the round photos looked like
          // Home's Adventure Hotspots.
          <Pressable key={t.key} onPress={() => onPick(on ? 'all' : t.key)} style={({ pressed }) => [s.theme, on && { borderColor: BLUE }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
            <Image source={{ uri: t.image }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
            {on ? <View style={s.themeCheck}><Ionicons name="checkmark" size={12} color="#fff" /></View> : null}
            <Text style={s.themeText} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Featured poster ─── */

export function DealPoster({ pkg, onPress }: { pkg: any; onPress: () => void }) {
  const { price, mrp, off } = pkgPrice(pkg);
  const img = pkgImage(pkg) || fallbackPhoto(pkg);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={pkg.title} style={({ pressed }) => [s.poster, pressed && { transform: [{ scale: 0.985 }] }]}>
      <LinearGradient colors={['#1e3a5f', NAVY]} style={StyleSheet.absoluteFill} />
      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" /> : null}
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(5,20,40,0.92)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.posterTop}>
        {nightsDays(pkg) ? <View style={s.whitePill}><Ionicons name="moon" size={10} color={BLUE} /><Text style={s.whitePillText}>{nightsDays(pkg)}</Text></View> : null}
        {off > 0 ? <View style={s.offPill}><Text style={s.offPillText}>{off}% OFF</Text></View> : null}
        {(pkg?.rating?.average || 0) > 0 ? (
          <View style={[s.whitePill, { marginLeft: 'auto' }]}><Ionicons name="star" size={10} color="#f59e0b" /><Text style={s.whitePillText}>{pkg.rating.average.toFixed(1)}</Text></View>
        ) : null}
      </View>
      <View style={s.posterFoot}>
        <Text style={s.posterTitle} numberOfLines={2}>{shortTitle(pkg.title)}</Text>
        <Text style={s.posterPlaces} numberOfLines={1}>{pkgPlaces(pkg)}</Text>
        <View style={s.posterPriceRow}>
          <View>
            {mrp ? <Text style={s.posterMrp}>{inr(mrp)}</Text> : null}
            <Text style={s.posterPrice}>{inr(price)}<Text style={s.posterPer}> per person</Text></Text>
          </View>
          <View style={s.posterCta}><Text style={s.posterCtaText}>View deal</Text><Ionicons name="arrow-forward" size={13} color={NAVY} /></View>
        </View>
      </View>
    </Pressable>
  );
}

/* ─── Two-up deal tile ─── */

export function DealTile({ pkg, onPress }: { pkg: any; onPress: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const { price, mrp, off } = pkgPrice(pkg);
  const img = pkgImage(pkg) || fallbackPhoto(pkg);
  const leaves = leavesIn(pkg);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={pkg.title}
      style={({ pressed }) => [s.tile, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={s.tileImg}>
        <LinearGradient colors={['#fdba74', BLUE]} style={StyleSheet.absoluteFill} />
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" /> : null}
        {off > 0 ? (
          <LinearGradient colors={['#ef4444', '#b91c1c']} style={s.tileOff}><Text style={s.tileOffText}>{off}% OFF</Text></LinearGradient>
        ) : null}
        {/* Urgency: when it leaves, not just how long it lasts. */}
        <View style={s.tileBadges}>
          {leaves ? (
            <View style={s.leaves}><Ionicons name="time" size={10} color="#fff" /><Text style={s.leavesText}>{leaves}</Text></View>
          ) : null}
          {nightsDays(pkg) ? <View style={s.tileDur}><Text style={s.tileDurText}>{nightsDays(pkg)}</Text></View> : null}
        </View>
      </View>
      <View style={s.tileBody}>
        <Text style={[s.tileTitle, { color: themeColors.text }]} numberOfLines={2}>{shortTitle(pkg.title)}</Text>
        <View style={{ flex: 1 }} />
        {mrp ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <Text style={[s.tileMrp, { marginTop: 0 }]}>{inr(mrp)}</Text>
            <Text style={s.save}>Save {inr(mrp - price)}</Text>
          </View>
        ) : null}
        <Text style={[s.tilePrice, { color: themeColors.text }]}>{inr(price)}</Text>
        <Text style={[s.tilePer, { color: themeColors.textTertiary }]}>per person + taxes</Text>
      </View>
    </Pressable>
  );
}

/** "Leaves in 5 days" / "Leaves tomorrow" for a departure within 3 weeks. */
function leavesIn(pkg: any): string | null {
  const n = nextDeparture(pkg);
  if (!n) return null;
  const d = (Array.isArray(pkg?.departures) ? pkg.departures : [])
    .map((x: any) => new Date(x?.startDate).getTime())
    .filter((t: number) => t > Date.now())
    .sort((a: number, b: number) => a - b)[0];
  const days = Math.ceil((d - Date.now()) / 86400000);
  if (days > 21) return null;
  return days <= 1 ? 'Leaves tomorrow' : `Leaves in ${days} days`;
}

/** The next open departure: "Next: 12 Dec" and seats left when few. */
export function nextDeparture(pkg: any): { label: string; seats: number | null } | null {
  const now = Date.now();
  const deps = (Array.isArray(pkg?.departures) ? pkg.departures : [])
    .filter((d: any) => d?.status !== 'closed' && d?.status !== 'cancelled' && new Date(d?.startDate).getTime() > now)
    .sort((x: any, y: any) => +new Date(x.startDate) - +new Date(y.startDate));
  const d = deps[0];
  if (!d) return null;
  const left = Number(d.availableSlots ?? 0) - Number(d.bookedSlots ?? 0);
  return {
    label: new Date(d.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    seats: left > 0 && left <= 10 ? left : null,
  };
}

/* ─── List card ─── */

export function HolidayCard({ pkg, onPress, compareOn, onCompare }: {
  pkg: any;
  onPress: () => void;
  /** Shows a "Compare" tick on the photo when given. */
  compareOn?: boolean;
  onCompare?: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  // Worked out on every render: the list recycles cards, so a photo held in
  // state would stay on the next package scrolled into this card.
  const own = pkgImage(pkg);
  const [failed, setFailed] = useState<string | null>(null);
  const img = own && own !== failed ? own : fallbackPhoto(pkg);
  const { price, mrp, off } = pkgPrice(pkg);
  const perks = pkgPerks(pkg);
  const rating = pkg?.rating?.average || 0;
  const next = nextDeparture(pkg);
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={pkg.title}
      style={({ pressed }) => [s.card, { backgroundColor: themeColors.surface, borderColor: line }, pressed && { transform: [{ scale: 0.99 }] }]}>
      <View style={s.cardImg}>
        <LinearGradient colors={['#fdba74', BLUE]} style={StyleSheet.absoluteFill} />
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" onError={() => own && setFailed(own)} /> : null}
        <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.cardTop}>
          {nightsDays(pkg) ? <View style={s.whitePill}><Ionicons name="moon" size={10} color={BLUE} /><Text style={s.whitePillText}>{nightsDays(pkg)}</Text></View> : null}
          {pkg?.isCuratedByPrayana ? <View style={[s.whitePill, { backgroundColor: '#fef3c7' }]}><Ionicons name="ribbon" size={10} color="#b45309" /><Text style={[s.whitePillText, { color: '#92400e' }]}>Prayana pick</Text></View> : null}
          {off > 0 ? <View style={[s.offPill, { marginLeft: 'auto' }]}><Text style={s.offPillText}>{off}% OFF</Text></View> : null}
        </View>
        <View style={s.cardPlaces}>
          <Ionicons name="location" size={12} color="#fff" />
          <Text style={s.cardPlacesText} numberOfLines={1}>{pkgPlaces(pkg)}</Text>
          {onCompare ? (
            <Pressable
              onPress={onCompare}
              hitSlop={8}
              style={[s.whitePill, compareOn && { backgroundColor: BLUE }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!compareOn }}
              accessibilityLabel="Compare this package"
            >
              <Ionicons name={compareOn ? 'checkmark-circle' : 'git-compare-outline'} size={12} color={compareOn ? '#fff' : BLUE} />
              <Text style={[s.whitePillText, compareOn && { color: '#fff' }]}>{compareOn ? 'Added' : 'Compare'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={s.cardBody}>
        <View style={s.titleRow}>
          <Text style={[s.cardTitle, { color: themeColors.text }]} numberOfLines={2}>{shortTitle(pkg.title)}</Text>
          {rating > 0 ? (
            <View style={s.rate}><Text style={s.rateText}>{rating.toFixed(1)}</Text><Ionicons name="star" size={10} color="#fff" /></View>
          ) : null}
        </View>

        {/* One row of small chips: the four big icon boxes made each card a screen tall. */}
        {perks.length ? (
          <View style={s.perks}>
            {perks.map((p) => (
              <View key={p.label} style={[s.perk, { backgroundColor: isDarkMode ? 'rgba(249, 115, 22,0.12)' : '#fff7ed' }]}>
                <Ionicons name={p.icon} size={11} color={BLUE} />
                <Text style={[s.perkText, { color: themeColors.textSecondary }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {next ? (
          <View style={s.nextRow}>
            <Ionicons name="calendar" size={12} color={BLUE} />
            <Text style={[s.nextText, { color: themeColors.text }]}>Next: {next.label}</Text>
            {next.seats ? <Text style={s.seats}>· Only {next.seats} seats left</Text> : null}
          </View>
        ) : null}

        <View style={[s.priceRow, { borderTopColor: line }]}>
          <View>
            {mrp ? (
              <View style={s.mrpRow}>
                <Text style={s.mrp}>{inr(mrp)}</Text>
                <Text style={s.save}>Save {inr(mrp - price)}</Text>
              </View>
            ) : null}
            <Text style={[s.price, { color: themeColors.text }]}>{inr(price)}</Text>
            <Text style={[s.per, { color: themeColors.textTertiary }]}>
              per person + taxes{Number(pkg?.duration?.days) > 1 ? ` · ${inr(Math.round(price / Number(pkg.duration.days)))}/day` : ''}
            </Text>
          </View>
          <View style={[s.cta, { backgroundColor: BLUE }]}>
            <Text style={s.ctaText}>View deal</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  themes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, paddingHorizontal: 16 },
  theme: { width: '31.5%', height: 96, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', justifyContent: 'flex-end', padding: 9 },
  themeCheck: { position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  themeRing: { width: 74, height: 74, borderRadius: 37, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  themeImg: { flex: 1, borderRadius: 34 },
  themeText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  poster: {
    width: FULL_W, height: 270, borderRadius: 24, overflow: 'hidden', justifyContent: 'space-between',
    shadowColor: '#0b2a4a', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  posterTop: { flexDirection: 'row', gap: 6, padding: 14 },
  posterFoot: { padding: 16 },
  posterTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 26, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 },
  posterPlaces: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  posterPriceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 },
  posterMrp: { color: 'rgba(255,255,255,0.65)', fontSize: 12, textDecorationLine: 'line-through' },
  posterPrice: { color: '#fff', fontSize: 22, fontWeight: '900' },
  posterPer: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  posterCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  posterCtaText: { color: NAVY, fontSize: 13, fontWeight: '800' },

  whitePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  whitePillText: { color: '#111827', fontSize: 11, fontWeight: '800' },
  offPill: { backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  offPillText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  tile: {
    width: TWO_UP_W, borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  tileImg: { height: Math.round(TWO_UP_W * 0.78) },
  tileOff: { position: 'absolute', top: 0, left: 0, borderBottomRightRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  tileOffText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  tileBadges: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  leaves: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  leavesText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  tileDur: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tileDurText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  tileBody: { padding: 11, minHeight: 112 },
  tileTitle: { fontSize: 13.5, fontWeight: '800', lineHeight: 17 },
  tileMrp: { color: '#9ca3af', fontSize: 11, textDecorationLine: 'line-through', marginTop: 6 },
  tilePrice: { fontSize: 17, fontWeight: '900' },
  tilePer: { fontSize: 10.5 },

  card: {
    borderRadius: 22, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.09, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  cardImg: { aspectRatio: 2.2, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', gap: 6, padding: 12 },
  cardPlaces: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 12 },
  cardPlacesText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  cardBody: { padding: 14, gap: 9 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { ...CARD_TITLE, flex: 1 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#16a34a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  rateText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  perkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  perkText: { fontSize: 11, fontWeight: '700' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nextText: { fontSize: 12.5, fontWeight: '700' },
  seats: { color: '#DC2626', fontSize: 12, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  mrpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mrp: { color: '#9ca3af', fontSize: 12, textDecorationLine: 'line-through' },
  save: { color: '#16a34a', fontSize: 11.5, fontWeight: '800' },
  price: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  per: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  cta: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
