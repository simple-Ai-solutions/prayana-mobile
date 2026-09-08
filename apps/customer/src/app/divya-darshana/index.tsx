// Divya Darshana — pilgrimage-yatra landing, the mobile port of the web
// app/divya-darshana/page.js (DarshanaHero + YatraFeatureIcons +
// HelicopterPackagesRail + LandPackagesGrid + expert CTA).
//
// There is NO dedicated backend: Divya Darshana is the holiday-packages
// catalogue filtered by category "Pilgrimage" (+ tags). Cards route to the
// existing /packages/[id] detail + checkout. Zero new API.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, Animated, Linking, Dimensions,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';

const SAFFRON = '#E38B29';
const DEEP = '#7C2D12';
const GOLD = '#F59E0B';
const EXPERT_PHONE = '+919606719999'; // Prayana yatra desk

const { width: SCREEN_W } = Dimensions.get('window');

type Pkg = {
  _id: string;
  slug?: string;
  title: string;
  shortDescription?: string;
  primaryDestination?: string;
  destination?: { city?: string; state?: string };
  destinations?: { name?: string; city?: string }[];
  duration?: { days: number; nights: number };
  pricing?: { startingFrom?: number; currency?: string };
  images?: { url: string; isPrimary?: boolean }[];
};

const HERO_SLIDES = [
  {
    title: 'Char Dham',
    eyebrow: 'Char Dham journeys curated for your',
    headline: 'Comfort & peace of mind',
    place: 'Kedarnath, Uttarakhand',
    info: 'Helicopter & group options · from ₹27,824',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80',
  },
  {
    title: 'Badrinath',
    eyebrow: 'A journey to the abode of',
    headline: 'Lord Vishnu himself',
    place: 'Badrinath, Uttarakhand',
    info: 'VIP darshan & sattvik meals · from ₹32,499',
    image: 'https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=1200&q=80',
  },
  {
    title: 'Vaishno Devi',
    eyebrow: 'A sacred trek to',
    headline: 'The holy cave of Mata Rani',
    place: 'Katra, Jammu & Kashmir',
    info: 'Helicopter & trek options · from ₹18,499',
    image: 'https://images.unsplash.com/photo-1609609830354-8f615d61b9c8?w=1200&q=80',
  },
  {
    title: 'Tirumala',
    eyebrow: 'Seek the blessings of',
    headline: 'Lord Venkateswara',
    place: 'Tirumala, Andhra Pradesh',
    info: 'Seva darshan booked · from ₹14,999',
    image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
  },
];

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'airplane', label: 'Guaranteed helicopter seats' },
  { icon: 'hand-left', label: 'Darshan assistance at all dhams' },
  { icon: 'restaurant', label: 'All meals included' },
  { icon: 'document-text', label: 'Yatra registration included' },
  { icon: 'person', label: 'Dedicated tour manager' },
];

const pkgImage = (p: Pkg) =>
  p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || null;
const pkgPlace = (p: Pkg) =>
  p.primaryDestination || p.destination?.city || p.destinations?.[0]?.name || p.destinations?.[0]?.city || '';

export default function DivyaDarshanaScreen() {
  const { themeColors } = useTheme();

  const [heli, setHeli] = useState<Pkg[]>([]);
  const [land, setLand] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);

  // Hero auto-rotate
  const [slide, setSlide] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 260);
    }, 4500);
    return () => clearInterval(id);
  }, [fade]);

  const load = useCallback(async () => {
    try {
      const [heliRes, landRes] = await Promise.all([
        holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'helicopter', limit: 8 }).catch(() => null),
        holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'landonly,land-only', limit: 6 }).catch(() => null),
      ]);
      const readList = (r: any): Pkg[] =>
        Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.packages) ? r.data.packages : Array.isArray(r?.packages) ? r.packages : [];
      setHeli(readList(heliRes));
      let landList = readList(landRes);
      // Web fallback: if no land-only tagged stock, show any Pilgrimage packages.
      if (landList.length === 0) {
        const fb = await holidayPackagesAPI.search({ category: 'Pilgrimage', limit: 6 }).catch(() => null);
        landList = readList(fb);
      }
      setLand(landList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPkg = (p: Pkg) => router.push(`/packages/${encodeURIComponent(p.slug || p._id)}` as any);
  const s = HERO_SLIDES[slide];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating back button over the hero */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── HERO (rotating yatra slides) ── */}
        <View style={styles.hero}>
          <Animated.Image source={{ uri: s.image }} style={[StyleSheet.absoluteFill, { opacity: fade }]} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(60,20,5,0.35)', 'rgba(60,20,5,0.55)', 'rgba(60,20,5,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.heroContent, { opacity: fade }]}>
            <View style={styles.heroBadge}>
              <Ionicons name="flower-outline" size={13} color={GOLD} />
              <Text style={styles.heroBadgeText}>DIVYA DARSHANA</Text>
            </View>
            <Text style={styles.heroEyebrow}>{s.eyebrow}</Text>
            <Text style={styles.heroHeadline}>{s.headline}</Text>
            <View style={styles.heroPlace}>
              <Ionicons name="location" size={13} color="#fff" />
              <Text style={styles.heroPlaceText}>{s.place}</Text>
            </View>
            <Text style={styles.heroInfo}>{s.info}</Text>
          </Animated.View>

          {/* Slide chips */}
          <View style={styles.slideChips}>
            {HERO_SLIDES.map((sl, i) => (
              <TouchableOpacity
                key={sl.title}
                onPress={() => { setSlide(i); }}
                style={[styles.slideChip, i === slide && { backgroundColor: SAFFRON, borderColor: SAFFRON }]}
              >
                <Text style={[styles.slideChipText, i === slide && { color: '#fff' }]}>{sl.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── FEATURE ICONS ── */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={SAFFRON} />
              </View>
              <Text style={[styles.featureLabel, { color: themeColors.textSecondary }]} numberOfLines={2}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* ── DISCOUNT STRIP ── */}
        <LinearGradient colors={[SAFFRON, DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.strip}>
          <Ionicons name="pricetags" size={16} color="#fff" />
          <Text style={styles.stripText}>Early-bird yatra fares · save up to 15% · book with ₹0 convenience fee</Text>
        </LinearGradient>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={SAFFRON} /></View>
        ) : (
          <>
            {/* ── HELICOPTER RAIL ── */}
            {heli.length > 0 && (
              <View style={styles.section}>
                <SectionHead
                  c={themeColors}
                  icon="airplane"
                  title="Helicopter yatras"
                  sub="Skip the trek — guaranteed seats to the dhams"
                  onSeeAll={() => router.push('/divya-darshana/packages?filter=helicopter' as any)}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {heli.map((p) => <YatraCard key={p._id} pkg={p} onPress={() => openPkg(p)} wide />)}
                </ScrollView>
              </View>
            )}

            {/* ── LAND TOURS GRID ── */}
            <View style={styles.section}>
              <SectionHead
                c={themeColors}
                icon="bus"
                title="Land & group yatras"
                sub="Comfortable coach journeys with darshan assistance"
                onSeeAll={() => router.push('/divya-darshana/packages' as any)}
              />
              {land.length > 0 ? (
                <View style={styles.grid}>
                  {land.map((p) => (
                    <View key={p._id} style={styles.gridCell}>
                      <YatraCard pkg={p} onPress={() => openPkg(p)} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyLand, { borderColor: themeColors.border }]}>
                  <Ionicons name="time-outline" size={28} color={themeColors.textTertiary} />
                  <Text style={[styles.emptyLandText, { color: themeColors.textSecondary }]}>
                    More land yatras coming soon. Talk to our yatra expert for a custom plan.
                  </Text>
                </View>
              )}
            </View>

            {/* ── SEE ALL YATRAS ── */}
            <TouchableOpacity
              style={[styles.allBtn, { borderColor: SAFFRON }]}
              onPress={() => router.push('/divya-darshana/packages' as any)}
            >
              <Text style={[styles.allBtnText, { color: SAFFRON }]}>Browse all yatras</Text>
              <Ionicons name="arrow-forward" size={16} color={SAFFRON} />
            </TouchableOpacity>

            {/* ── EXPERT CTA ── */}
            <TouchableOpacity
              style={styles.expert}
              activeOpacity={0.9}
              onPress={() => Linking.openURL(`tel:${EXPERT_PHONE}`)}
            >
              <LinearGradient colors={[DEEP, '#5B1E0C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.expertGrad}>
                <View style={styles.expertIcon}>
                  <Ionicons name="call" size={20} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expertTitle}>Talk to a Yatra Expert</Text>
                  <Text style={styles.expertSub}>Custom circuits, permits & senior-friendly plans</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHead({ c, icon, title, sub, onSeeAll }: { c: any; icon: any; title: string; sub: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadIcon}>
        <Ionicons name={icon} size={18} color={SAFFRON} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.sectionSub, { color: c.textSecondary }]} numberOfLines={1}>{sub}</Text>
      </View>
      <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.seeAll, { color: SAFFRON }]}>See all</Text>
      </TouchableOpacity>
    </View>
  );
}

function YatraCard({ pkg, onPress, wide }: { pkg: Pkg; onPress: () => void; wide?: boolean }) {
  const { themeColors } = useTheme();
  const img = pkgImage(pkg);
  const place = pkgPlace(pkg);
  const price = pkg.pricing?.startingFrom || 0;
  const nights = pkg.duration?.nights ?? (pkg.duration?.days ? pkg.duration.days - 1 : 0);
  return (
    <TouchableOpacity
      style={[styles.card, wide && { width: SCREEN_W * 0.68 }, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={styles.cardImgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCE7C8', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="flower" size={26} color={SAFFRON} />
          </View>
        )}
        {pkg.duration?.days ? (
          <View style={styles.cardDuration}>
            <Text style={styles.cardDurationText}>{pkg.duration.days}D / {nights}N</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>{pkg.title}</Text>
        {!!place && (
          <View style={styles.cardMeta}>
            <Ionicons name="location" size={11} color={SAFFRON} />
            <Text style={[styles.cardPlace, { color: themeColors.textSecondary }]} numberOfLines={1}>{place}</Text>
          </View>
        )}
        {price > 0 && (
          <Text style={[styles.cardPrice, { color: themeColors.text }]}>
            <Text style={[styles.cardPriceFrom, { color: themeColors.textSecondary }]}>from </Text>
            ₹{price.toLocaleString('en-IN')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },

  hero: { height: 340, justifyContent: 'flex-end' },
  heroContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: 4 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: spacing.sm },
  heroBadgeText: { color: GOLD, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  heroHeadline: { color: '#fff', fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, letterSpacing: -0.5, lineHeight: 34 },
  heroPlace: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  heroPlaceText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  heroInfo: { color: GOLD, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },

  slideChips: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, flexWrap: 'wrap' },
  slideChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.25)' },
  slideChipText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  features: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingTop: spacing.lg, justifyContent: 'space-between' },
  feature: { width: '19%', alignItems: 'center', gap: 5, marginBottom: spacing.sm },
  featureIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(227,139,41,0.12)', alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 9.5, textAlign: 'center', lineHeight: 12, fontWeight: fontWeight.medium },

  strip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.lg },
  stripText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold, flex: 1 },

  loading: { paddingVertical: 60, alignItems: 'center' },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeadIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(227,139,41,0.12)', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  sectionSub: { fontSize: fontSize.xs, marginTop: 1 },
  seeAll: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  rail: { gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  gridCell: { width: '47.5%', flexGrow: 1 },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  cardImgWrap: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#FCE7C8' },
  cardDuration: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  cardDurationText: { fontSize: 10, fontWeight: '800', color: DEEP },
  cardBody: { padding: spacing.md, gap: 4 },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardPlace: { fontSize: fontSize.xs, flexShrink: 1 },
  cardPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 2 },
  cardPriceFrom: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },

  emptyLand: { alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: borderRadius.xl, padding: spacing.xl, marginTop: spacing.md },
  emptyLandText: { fontSize: fontSize.sm, textAlign: 'center', maxWidth: 260 },

  allBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: spacing.lg, marginTop: spacing.xl, borderWidth: 1.5, borderRadius: 999, paddingVertical: spacing.md },
  allBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  expert: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: borderRadius.xl, overflow: 'hidden' },
  expertGrad: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  expertIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(245,158,11,0.18)', alignItems: 'center', justifyContent: 'center' },
  expertTitle: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  expertSub: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.xs, marginTop: 2 },
});
