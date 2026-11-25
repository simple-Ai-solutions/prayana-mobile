// Reusable card for a global (Headout/Viator) experience.
// Shared by Global Experiences, India Experiences, and the destination
// Activities tab. Mirrors the PWA ActivityCard.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Star, MapPin, Zap, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { fallbackPhoto } from '../../lib/fallbackPhoto';
import { useAppStore } from '@prayana/shared-stores';
import { useExchangeRates, convertCurrency } from '../../lib/exchangeRates';
import { cardTitle } from '../../lib/cardTitle';
import { sizedImageUrl } from '../../lib/imageUrl';

/** "KODACHADRI TREK" → "Kodachadri Trek". */
const tidy = (t: string) => (t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : t);

interface Props {
  activity: any;
  width?: number | string;
}

export const GlobalActivityCard: React.FC<Props> = ({ activity: a, width = '48%' }) => {
  const { themeColors } = useTheme();
  const rates = useExchangeRates();
  const userCurrency = useAppStore((st: any) => st.userPreferences?.currency);
  const img = a.images?.[0]?.url || a.images?.[0] || a.heroImage || fallbackPhoto(a);
  const rating = a.rating?.average ?? a.rating ?? 0;
  const reviews = a.rating?.count ?? a.reviewCount ?? 0;
  const price =
    a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? a.platformMRP ?? null;
  // The raw ISO code was printed straight against the number — "EUR25",
  // "INR8,826.15" — so the same list mixed codes and looked unpriced. Map to a
  // symbol, falling back to a spaced code for anything unmapped.
  const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3', AED: 'AED ',
    SGD: 'S$', THB: '\u0E3F', AUD: 'A$', JPY: '\u00A5', MYR: 'RM ',
    IDR: 'Rp ', LKR: 'LKR ', NPR: 'NPR ', CHF: 'CHF ', CAD: 'C$',
  };
  const rawCurrency = a.pricing?.currency || a.currency || 'INR';
  const nativeCode = String(rawCurrency).toUpperCase();
  // Shown in the user's currency (₹ unless they chose another), as the web
  // does; the listing's own currency only when no rate is known.
  const userCode = String(userCurrency || 'INR').toUpperCase();
  const converted = price != null ? convertCurrency(Number(price), nativeCode, userCode, rates) : null;
  const code = converted != null ? userCode : nativeCode;
  const shownPrice = converted ?? price;
  const currency = CURRENCY_SYMBOLS[code] ?? (code.length === 3 ? `${code} ` : rawCurrency);
  const priceLocale = code === 'INR' ? 'en-IN' : 'en-US';
  // externalData.city.name ("Paris") reads better than .code ("PARIS").
  const city =
    a.location?.city || a.externalData?.city?.name || a.externalData?.city?.code || '';

  // instantBooking is an OBJECT ({enabled, requiresManualConfirmation, ...}), so
  // the old `const instant = a.instantBooking` was truthy for every listing and
  // badged "Instant" even on records with enabled:false. Read the flag.
  const instant =
    typeof a.instantBooking === 'boolean' ? a.instantBooking : !!a.instantBooking?.enabled;

  // Partner duration ("7 hours") — sent by Headout/Viator, previously unused.
  const duration: string | null =
    a.duration?.label ||
    a.duration?.display ||
    (a.duration?.value ? `${a.duration.value} ${a.duration.unit || 'hours'}` : null);

  // 24,878 reads as a number; "(24878)" reads as an id.
  const reviewLabel =
    reviews >= 1000 ? `${(reviews / 1000).toFixed(reviews >= 10000 ? 0 : 1)}k` : `${reviews}`;

  const title = tidy(cardTitle(a.name || a.title || ''));
  const meta = [city, duration].filter(Boolean).join(' · ');

  // A photo poster: title, place and price over a dark fade, like the Explore
  // cards — the old white box under a short photo read as a plain list.
  return (
    <Pressable
      style={({ pressed }) => [styles.card, shadow.sm, { width: width as any }, pressed && { transform: [{ scale: 0.97 }] }]}
      onPress={() => a._id && router.push(`/activity/${a._id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.gray[300] }]} />
      {img ? (
        <Image source={{ uri: sizedImageUrl(img, 200) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.25, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.top}>
        {instant ? (
          <View style={styles.chip}>
            <Zap size={10} color="#111827" fill="#111827" />
            <Text style={styles.chipText}>Instant</Text>
          </View>
        ) : <View />}
        {rating > 0 ? (
          <View style={[styles.chip, styles.chipDark]}>
            <Star size={10} color="#fbbf24" fill="#fbbf24" />
            <Text style={[styles.chipText, { color: '#fff' }]}>
              {Number(rating).toFixed(1)}{reviews > 0 ? ` (${reviewLabel})` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.foot}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {!!meta && (
          <View style={styles.metaRow}>
            <MapPin size={11} color="#fdba74" />
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
          </View>
        )}
        {price != null && (
          <View style={styles.pricePill}>
            <Text style={styles.price}>
              {currency}{Math.round(Number(shownPrice)).toLocaleString(priceLocale)}
            </Text>
            <Text style={styles.per}> /person</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { height: 250, borderRadius: 18, overflow: 'hidden', marginBottom: spacing.md, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  chipDark: { backgroundColor: 'rgba(0,0,0,0.55)' },
  chipText: { color: '#111827', fontSize: 10.5, fontWeight: '800' },
  foot: { padding: 12, gap: 4 },
  title: {
    color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 19, letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flexShrink: 1, color: 'rgba(255,255,255,0.9)', fontSize: 11.5, fontWeight: '600' },
  pricePill: {
    flexDirection: 'row', alignItems: 'baseline', alignSelf: 'flex-start',
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginTop: 4,
  },
  price: { color: '#111827', fontSize: 14, fontWeight: '900' },
  per: { color: '#6B7280', fontSize: 10.5, fontWeight: '600' },
});
