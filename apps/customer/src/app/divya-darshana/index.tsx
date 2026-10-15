// Divya Darshana — premium pilgrimage-yatra landing, the mobile port of the web
// app/divya-darshana/page.js. Devotional palette (maroon/deep/saffron/gold on
// cream), serif headings, the gold dot·line·dot divider, circular
// maroon-gradient feature chips, premium yatra cards, a trust-stats strip,
// testimonials, and what every booking includes last.
//
// No dedicated backend: DD is the holiday-packages catalogue filtered by
// category "Pilgrimage" (+ tags). Cards route to /packages/[id]. Zero new API.
import React from 'react';
import {
  View, Text, StyleSheet, Linking, Platform,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HelicopterRail, GroupDepartureRail, LandRail } from '../../components/divya-darshana/YatraRails';
import { DarshanaHero } from '../../components/divya-darshana/DarshanaHero';
import { FULL_W, RAIL_GAP, usePairSnap } from '../../lib/railLayout';

// ── Devotional palette (exact web tokens) ──
const MAROON = '#7A1F0A';
const DEEP = '#B8410E';
const SAFFRON = '#FF6F00';
const GOLD = '#D4AF37';
const CREAM = '#FFF8E7';
const EXPERT_PHONE = '+919449753920';
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// The web's five (components/divya-darshana/YatraFeatureIcons.jsx). The short
// second line only restates the web's own label, split for a phone card.
const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string }[] = [
  { icon: 'airplane', label: 'Guaranteed helicopter seats', sub: 'On helicopter yatras' },
  { icon: 'hand-left', label: 'Darshan assistance', sub: 'At all dhams' },
  { icon: 'restaurant', label: 'All meals included', sub: 'Through the yatra' },
  { icon: 'document-text', label: 'Yatra registration', sub: 'Included in your package' },
  { icon: 'person', label: 'Dedicated tour manager', sub: 'Looking after your group' },
];

const STATS = [
  { icon: 'people' as const, value: '2000+', label: 'Pilgrims guided' },
  { icon: 'airplane' as const, value: '500+', label: 'Helicopter yatras' },
  { icon: 'calendar' as const, value: 'All season', label: 'Departure dates' },
];

// The web's own three (components/divya-darshana/PilgrimTestimonials.jsx),
// word for word — the phone used to show different, unsourced quotes.
const TESTIMONIALS = [
  { quote: 'The helicopter seats were guaranteed and the darshan queue assistance saved us hours. My parents managed the yatra with ease.', name: 'Ramesh Iyer', loc: 'Chennai · Char Dham 2025', accent: [DEEP, MAROON] as const },
  { quote: 'Every meal was pure sattvik. The tour manager spoke Marathi and Hindi — felt like family looking after us.', name: 'Anjali Deshpande', loc: 'Pune · Kedarnath Yatra', accent: [SAFFRON, DEEP] as const },
  { quote: 'Yatra registration was handled before we arrived. No paperwork headache, just bhakti bhaav the whole trip.', name: 'Sardar Harpreet Singh', loc: 'Delhi · Do Dham', accent: [GOLD, DEEP] as const },
];

/** "Ramesh Iyer" → "RI"; skips honorifics and symbols. */
const initials = (name: string) =>
  name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(sardar|shri|smt|dr)$/i.test(w)).map((w) => w[0].toUpperCase()).slice(0, 2).join('');

// ── Signature primitive: gold dot · line · dot divider ──
function GoldDivider({ center = true }: { center?: boolean }) {
  return (
    <View style={[styles.divider, center && { alignSelf: 'center' }]}>
      <View style={styles.divDot} />
      <View style={styles.divLine} />
      <View style={styles.divDot} />
    </View>
  );
}

export default function DivyaDarshanaScreen() {
  const testimonialSnap = usePairSnap(FULL_W + RAIL_GAP);

  // Open by _id, not slug — some slugs resolve to empty duplicate documents.
  const openPkg = (p: { _id: string }) => router.push(`/packages/${encodeURIComponent(p._id)}?from=darshana` as any);


  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: CREAM }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Devotional theme banner */}
      <LinearGradient colors={[MAROON, DEEP, SAFFRON]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.bannerTitle}>Divya Darshana</Text>
          <Text style={styles.bannerSub}>BY PRAYANA AI</Text>
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${EXPERT_PHONE}`)} style={styles.bannerExpert} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="call" size={14} color={GOLD} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, backgroundColor: CREAM }}>
        {/* ── HERO — the web's parchment frame, phone layout ── */}
        <DarshanaHero
          onPackages={() => router.push('/divya-darshana/packages' as any)}
          onCallExpert={() => Linking.openURL(`tel:${EXPERT_PHONE}`)}
        />

        {/* ── PACKAGE ROWS — same order and designs as the web ── */}
        <HelicopterRail onOpen={openPkg} onViewAll={() => router.push('/divya-darshana/packages' as any)} />
        <GroupDepartureRail onOpen={openPkg} onViewAll={() => router.push('/divya-darshana/packages?filter=grouptour' as any)} />
        <LandRail
          onOpen={openPkg}
          onViewAll={() => router.push('/divya-darshana/packages' as any)}
          onCallExpert={() => Linking.openURL(`tel:${EXPERT_PHONE}`)}
        />

            {/* ── TRUST STATS ── */}
            <View style={styles.statsCard}>
              {STATS.map((st, i) => (
                <React.Fragment key={st.label}>
                  {i > 0 && <View style={styles.statDivider} />}
                  <View style={styles.stat}>
                    <LinearGradient colors={[CREAM, `${GOLD}55`]} style={styles.statChip}>
                      <Ionicons name={st.icon} size={18} color={DEEP} />
                    </LinearGradient>
                    <Text style={styles.statValue}>{st.value}</Text>
                    <Text style={styles.statLabel}>{st.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* ── TESTIMONIALS ── */}
            <View style={styles.section}>
              <Text style={[styles.eyebrow, { textAlign: 'center' }]}>WHAT MAKES US</Text>
              <Text style={[styles.sectionH, { textAlign: 'center' }]}>India's trusted yatra companion</Text>
              <GoldDivider />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} ref={testimonialSnap.ref} {...testimonialSnap.props}>
                {TESTIMONIALS.map((t, i) => (
                  <View key={i} style={styles.tCard}>
                    <View style={styles.stars}>
                      {[0, 1, 2, 3, 4].map((n) => <Ionicons key={n} name="star" size={12} color={GOLD} />)}
                    </View>
                    <Text style={styles.tQuote}>“{t.quote}”</Text>
                    <View style={styles.tFooter}>
                      <LinearGradient colors={t.accent} style={styles.tAvatar}>
                        <Text style={styles.tAvatarText}>{initials(t.name)}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tName}>{t.name}</Text>
                        <Text style={styles.tLoc}>{t.loc}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* ── EXPERT CTA ── */}
            <TouchableOpacity style={styles.expert} activeOpacity={0.9} onPress={() => Linking.openURL(`tel:${EXPERT_PHONE}`)}>
              <LinearGradient colors={[MAROON, DEEP, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.expertGrad}>
                <View style={styles.expertIcon}><Ionicons name="call" size={20} color={GOLD} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expertTitle}>Talk to a Yatra Expert</Text>
                  <Text style={styles.expertSub}>Custom circuits, permits & senior-friendly plans</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

        {/* ── FEATURE ICONS ── */}
        <View style={styles.featuresBlock}>
          <Text style={[styles.eyebrow, { textAlign: 'center' }]}>ON BOOKING WITH PRAYANA AI, YOU GET</Text>
          <Text style={[styles.sectionH, { textAlign: 'center' }]}>Everything handled, registration to darshan</Text>
          <GoldDivider />
          {/* Two per row, each with room for its whole label. */}
          <View style={styles.features}>
            {FEATURES.map((f, i) => (
              // An odd last card spans the row rather than sitting alone at half width.
              <View key={f.label} style={[styles.feature, i === FEATURES.length - 1 && FEATURES.length % 2 === 1 && styles.featureWide]}>
                <LinearGradient colors={[DEEP, MAROON]} style={styles.featureChip}>
                  <Ionicons name={f.icon} size={19} color={GOLD} />
                </LinearGradient>
                <View style={{ flexShrink: 1, gap: 3 }}>
                  <Text style={styles.featureLabel} numberOfLines={2}>{f.label}</Text>
                  <Text style={styles.featureSub} numberOfLines={2}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_SHADOW = { shadowColor: MAROON, shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 };

const styles = StyleSheet.create({
  safe: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: SERIF },
  bannerSub: { color: GOLD, fontSize: 9, fontWeight: '800', letterSpacing: 3, marginTop: 1 },
  bannerExpert: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center' },

  // Divider primitive
  divider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 },
  divDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  divLine: { width: 36, height: 1, backgroundColor: `${GOLD}99` },

  // Hero


  // CTA row

  // Shared section
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: '700', color: DEEP, textTransform: 'uppercase' },
  sectionH: { fontSize: 24, fontFamily: SERIF, fontWeight: '700', color: MAROON, lineHeight: 30, marginTop: 4 },
  section: { paddingHorizontal: 16, marginTop: 24 },

  // Features
  featuresBlock: { paddingHorizontal: 16, marginTop: 24, alignItems: 'center' },
  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 12, alignSelf: 'stretch' },
  feature: {
    width: '48%', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 4,
    borderWidth: 1, borderColor: `${GOLD}40`,
    shadowColor: MAROON, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  featureWide: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureChip: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  featureLabel: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: MAROON, fontFamily: SERIF },
  featureSub: { fontSize: 11.5, lineHeight: 15, color: '#6b6b74' },

  // Offers marquee
  // overflow:hidden clips the marquee horizontally (needed), but with no
  // vertical padding it also shaved the offer cards' drop shadow, leaving a
  // hard-edged sliver. Give the shadow room top and bottom.

  rail: { gap: RAIL_GAP, paddingVertical: 14, paddingRight: 16 },

  // Helicopter shrine card

  // Land dome card
  // No borderWidth: on iOS a 1px border + overflow:hidden lets the full-bleed
  // image paint over the side border while the white body respects it, so the
  // image read as slightly WIDER than the body. Define the card with its shadow
  // instead; the image and body are then both exactly the card width.




  // Trust stats
  statsCard: { flexDirection: 'row', marginHorizontal: 16, marginTop: 24, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 18, borderWidth: 1, borderColor: `${GOLD}4D`, paddingVertical: 16, ...CARD_SHADOW },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: `${GOLD}4D`, marginVertical: 4 },
  statChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${GOLD}66` },
  statValue: { fontSize: 20, fontFamily: SERIF, fontWeight: '800', color: MAROON },
  statLabel: { fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  // Testimonials
  tCard: { width: FULL_W, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: `${GOLD}40`, ...CARD_SHADOW },
  stars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  tQuote: { fontSize: 15, lineHeight: 22, color: '#3f3f46', fontFamily: SERIF, fontStyle: 'italic' },
  tFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: `${GOLD}33` },
  tAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tAvatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tName: { fontSize: 14, fontWeight: '800', color: MAROON },
  tLoc: { fontSize: 10, color: '#71717a', marginTop: 1 },

  // Expert
  expert: { marginHorizontal: 16, marginTop: 24, borderRadius: 20, overflow: 'hidden', ...CARD_SHADOW },
  expertGrad: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  expertIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(212,175,55,0.22)', alignItems: 'center', justifyContent: 'center' },
  expertTitle: { color: '#fff', fontSize: 16, fontFamily: SERIF, fontWeight: '700' },
  expertSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
});
