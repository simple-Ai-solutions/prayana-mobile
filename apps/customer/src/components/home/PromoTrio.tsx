// PromoTrio — the home page's promo cards, ported from the web/PWA:
//   • Go Global, Stay Connected (Travel eSIM)  → /esim
//   • Divya Darshana by Prayana AI (sacred yatras)  → coming soon
//   • Dream Holidays by Prayana AI (holiday packages)  → coming soon
//
// Web parity: components/esim/EsimHomepageSection.jsx,
// components/divya-darshana/DivyaDarshanaPromoCard.jsx,
// components/holiday-packages/HolidayPackagesPromoCard.jsx — a side-by-side trio
// on desktop, a stacked snap-rail on mobile. Here they stack full-width.
//
// The web uses a Cormorant-Garamond serif for the headings. The design system
// forbids bundling a webfont, so headings fall back to the native system stack
// (no fontFamily set) — same hierarchy, on-device typeface.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '@prayana/shared-ui';

const GOLD = '#F5D87A';

type TrustItem = { icon: keyof typeof Ionicons.glyphMap; label: string };

interface PromoCardProps {
  badgeIcon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  titleAccent: string;
  desc: string;
  trust?: TrustItem[];
  cta: string;
  gradient: readonly [string, string, ...string[]];
  accentColor: string;
  ctaBg: string;
  ctaText: string;
  /** A real photo behind the card; the brand gradient fades over it. */
  image: string;
  onPress: () => void;
}

const PromoCard: React.FC<PromoCardProps> = ({
  badgeIcon,
  badge,
  title,
  titleAccent,
  desc,
  trust,
  cta,
  gradient,
  accentColor,
  ctaBg,
  ctaText,
  image,
  onPress,
}) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.cardWrap}>
    <View style={styles.card}>
      <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
      {/* Solid brand colour under the text, opening up to the photo on the right. */}
      <LinearGradient
        colors={[`${gradient[0]}F5`, `${gradient[1]}D9`, `${gradient[gradient.length - 1]}40`]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardBody}>
        {/* Badge */}
        <View style={[styles.badge, { borderColor: `${accentColor}66`, backgroundColor: `${accentColor}22` }]}>
          <Ionicons name={badgeIcon} size={12} color={accentColor} />
          <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
        </View>

        {/* Heading + "by Prayana AI" accent */}
        <Text style={styles.title}>
          {title}
          {'  '}
          <Text style={[styles.titleAccent, { color: accentColor }]}>{titleAccent}</Text>
        </Text>

        <Text style={styles.desc}>{desc}</Text>

        {/* Trust row (eSIM + Holiday only) */}
        {!!trust?.length && (
          <View style={styles.trustRow}>
            {trust.map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <Ionicons name={t.icon} size={12} color={accentColor} />
                <Text style={styles.trustText}>{t.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA pill */}
        <View style={[styles.cta, { backgroundColor: ctaBg }]}>
          <Text style={[styles.ctaLabel, { color: ctaText }]}>{cta}</Text>
          <Ionicons name="arrow-forward" size={16} color={ctaText} />
        </View>
      </View>

      {/* Bottom accent line */}
      <LinearGradient
        colors={['transparent', `${accentColor}B3`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />
    </View>
  </TouchableOpacity>
);

export const PromoTrio: React.FC = () => {
  const router = useRouter();

  const comingSoon = (what: string) =>
    Alert.alert(`${what} — coming soon`, "We're putting the final touches on this. Check back shortly.");

  return (
    <View style={styles.container}>
      {/* Travel eSIM — maroon/red → ember, gold accent */}
      <PromoCard
        badgeIcon="wifi"
        badge="TRAVEL ESIM"
        title="Go Global, Stay Connected"
        titleAccent="by Prayana AI"
        desc="Instant data plans for 190+ countries. No SIM swap needed — activate in minutes and save up to 60%."
        trust={[
          { icon: 'flash', label: 'Instant activation' },
          { icon: 'globe-outline', label: '190+ countries' },
          { icon: 'shield-checkmark-outline', label: 'Secure checkout' },
        ]}
        cta="Browse Plans"
        gradient={['#C8102E', '#8B0A14', '#4A0508']}
        accentColor={GOLD}
        ctaBg={GOLD}
        ctaText="#5C0A0E"
        image="https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1000&q=75"
        onPress={() => router.push('/esim')}
      />

      {/* Divya Darshana — maroon → saffron → gold */}
      <PromoCard
        badgeIcon="flame"
        badge="NEW · SACRED JOURNEYS"
        title="Divya Darshana"
        titleAccent="by Prayana AI"
        desc="Char Dham, Kedarnath, Vaishno Devi & more — helicopter, group, and private yatras with darshan assistance included."
        cta="Explore Yatras"
        gradient={['#7A1F0A', '#B8410E', '#D4AF37']}
        accentColor="#FFD86B"
        ctaBg="#FFD86B"
        ctaText="#5C1503"
        image="https://prayanaai.com/images/place-specific/ChIJtbCmiuA-CDkRAu4Clouuvds/img-1_google_places_529eb6aa.jpg"
        onPress={() => router.push('/divya-darshana')}
      />

      {/* Dream Holidays — emerald → teal → cyan with a warm hint */}
      <PromoCard
        badgeIcon="airplane"
        badge="CURATED · HOLIDAY PACKAGES"
        title="Dream Holidays"
        titleAccent="by Prayana AI"
        desc="Handpicked itineraries across India & beyond — flights, stays, and experiences seamlessly bundled at the best prices."
        trust={[
          { icon: 'sparkles', label: 'AI-curated' },
          { icon: 'airplane-outline', label: 'Flights + Stays' },
          { icon: 'pricetag-outline', label: 'Best price' },
        ]}
        cta="Explore Packages"
        gradient={['#042F2E', '#0D5E5F', '#0EA5A4']}
        accentColor="#FDE68A"
        ctaBg="#FDE68A"
        ctaText="#042F2E"
        image="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1000&q=75"
        onPress={() => router.push('/packages')}
      />
    </View>
  );
};

export default PromoTrio;

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },

  cardWrap: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: { borderRadius: 24, overflow: 'hidden', minHeight: 210, backgroundColor: '#111827' },

  cardBody: { padding: spacing.xl, gap: spacing.sm },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },

  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, letterSpacing: -0.3 },
  titleAccent: { fontSize: 13, fontWeight: '700', letterSpacing: 1.4 },

  desc: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, marginTop: 4, maxWidth: 460 },

  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    marginTop: spacing.sm,
  },
  ctaLabel: { fontSize: 14, fontWeight: '800' },

  accentLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
});
