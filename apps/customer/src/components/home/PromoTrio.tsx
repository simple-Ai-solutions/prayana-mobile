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
  decorIcon: keyof typeof Ionicons.glyphMap;
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
  decorIcon,
  onPress,
}) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.cardWrap}>
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Large decorative watermark icon — right side, very low opacity */}
      <Ionicons name={decorIcon} size={150} color="rgba(255,255,255,0.05)" style={styles.decor} />

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
    </LinearGradient>
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
        decorIcon="globe-outline"
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
        decorIcon="business-outline"
        onPress={() => comingSoon('Divya Darshana')}
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
        decorIcon="airplane-outline"
        onPress={() => comingSoon('Dream Holidays')}
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
  card: { borderRadius: 24, overflow: 'hidden', minHeight: 210 },
  decor: { position: 'absolute', right: -18, top: '50%', marginTop: -75 },

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
