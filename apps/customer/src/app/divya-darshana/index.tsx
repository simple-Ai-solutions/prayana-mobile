// Divya Darshana — premium pilgrimage-yatra landing, the mobile port of the web
// app/divya-darshana/page.js. Devotional palette (maroon/deep/saffron/gold on
// cream), serif headings, the gold dot·line·dot divider, circular
// maroon-gradient feature chips, premium yatra cards, an auto-scrolling offers
// marquee, a trust-stats strip and testimonials.
//
// No dedicated backend: DD is the holiday-packages catalogue filtered by
// category "Pilgrimage" (+ tags). Cards route to /packages/[id]. Zero new API.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, Animated, Linking, Dimensions, Platform, Easing,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../lib/imageUrl';

// ── Devotional palette (exact web tokens) ──
const MAROON = '#7A1F0A';
const DEEP = '#B8410E';
const SAFFRON = '#FF6F00';
const GOLD = '#D4AF37';
const CREAM = '#FFF8E7';
const EXPERT_PHONE = '+919606719999';
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const { width: SCREEN_W } = Dimensions.get('window');

type Pkg = {
  _id: string; slug?: string; title: string; shortDescription?: string;
  primaryDestination?: string; destination?: { city?: string; state?: string };
  destinations?: { name?: string; city?: string }[];
  duration?: { days: number; nights: number };
  pricing?: { startingFrom?: number; currency?: string };
  images?: { url: string; isPrimary?: boolean }[];
  tags?: string[] | string;
};

const HERO_SLIDES = [
  { title: 'Char Dham', eyebrow: 'Char Dham journeys curated for your', headline: 'Comfort & peace of mind', place: 'Kedarnath, Uttarakhand', info: 'Helicopter & group options', price: '₹27,824', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80' },
  { title: 'Badrinath', eyebrow: 'A journey to the abode of', headline: 'Lord Vishnu himself', place: 'Badrinath, Uttarakhand', info: 'VIP darshan & sattvik meals', price: '₹32,499', image: 'https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=1200&q=80' },
  { title: 'Vaishno Devi', eyebrow: 'A sacred trek to', headline: 'The holy cave of Mata Rani', place: 'Katra, Jammu & Kashmir', info: 'Helicopter & trek options', price: '₹18,499', image: 'https://images.unsplash.com/photo-1609609830354-8f615d61b9c8?w=1200&q=80' },
  { title: 'Tirumala', eyebrow: 'Seek the blessings of', headline: 'Lord Venkateswara', place: 'Tirumala, Andhra Pradesh', info: 'Seva darshan booked', price: '₹14,999', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80' },
];

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'airplane', label: 'Guaranteed helicopter seats' },
  { icon: 'hand-left', label: 'Darshan assistance at all dhams' },
  { icon: 'restaurant', label: 'All meals included' },
  { icon: 'document-text', label: 'Yatra registration included' },
  { icon: 'person', label: 'Dedicated tour manager' },
];

const OFFERS = [
  { code: 'HELICOPTERSPECIAL', title: 'Helicopter Yatra', save: 'Up to 20% OFF', colors: [DEEP, MAROON] as const },
  { code: 'DHAMSPECIAL', title: 'Char Dham Packages', save: 'Flat 20% OFF', colors: [SAFFRON, DEEP] as const },
  { code: 'EARLY2026', title: 'Early Bird 2026', save: 'Save ₹5,000 / yatri', colors: ['#F59E0B', SAFFRON] as const },
  { code: 'SENIORYATRI', title: 'Senior Pilgrims', save: '15% OFF for 60+', colors: [GOLD, DEEP] as const },
];

const STATS = [
  { icon: 'people' as const, value: '2000+', label: 'Pilgrims guided' },
  { icon: 'airplane' as const, value: '500+', label: 'Helicopter yatras' },
  { icon: 'calendar' as const, value: 'All season', label: 'Departure dates' },
];

const TESTIMONIALS = [
  { quote: 'Every detail — from registration to darshan — was handled. We just prayed.', name: 'Ramesh & Lata', loc: 'Pune · Char Dham', accent: [DEEP, MAROON] as const },
  { quote: 'The helicopter yatra saved my elderly parents the trek. Beautifully organised.', name: 'Anjali Sharma', loc: 'Delhi · Kedarnath', accent: [SAFFRON, DEEP] as const },
  { quote: 'Sattvik meals, a caring tour manager, and VIP darshan. Truly divine.', name: 'Suresh Iyer', loc: 'Chennai · Badrinath', accent: [GOLD, DEEP] as const },
];

const pkgImage = (p: Pkg) => {
  const url = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url;
  return url ? normalizeImageUrl(url) : null;
};
const pkgPlace = (p: Pkg) => p.primaryDestination || p.destination?.city || p.destinations?.[0]?.name || p.destinations?.[0]?.city || '';
const isHeli = (p: Pkg) => (Array.isArray(p.tags) ? p.tags.join(',') : String(p.tags || '')).toLowerCase().includes('helicopter');

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
  const [heli, setHeli] = useState<Pkg[]>([]);
  const [land, setLand] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const marquee = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 400);
    }, 6000);
    return () => clearInterval(id);
  }, [fade]);

  // Auto-scroll the offers marquee.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(marquee, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [marquee]);

  const load = useCallback(async () => {
    try {
      const readList = (r: any): Pkg[] =>
        Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.packages) ? r.data.packages : Array.isArray(r?.packages) ? r.packages : [];
      const [heliRes, landRes] = await Promise.all([
        holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'helicopter', limit: 8 }).catch(() => null),
        holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'landonly,land-only', limit: 6 }).catch(() => null),
      ]);
      setHeli(readList(heliRes));
      let landList = readList(landRes);
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

  // Open by _id, not slug — some slugs resolve to empty duplicate documents.
  const openPkg = (p: Pkg) => router.push(`/packages/${encodeURIComponent(p._id)}` as any);
  const s = HERO_SLIDES[slide];

  // Two copies of offers for a seamless marquee loop.
  const offerTrackW = OFFERS.length * (280 + 12);
  const marqueeX = marquee.interpolate({ inputRange: [0, 1], outputRange: [0, -offerTrackW] });

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
        {/* ── HERO ── */}
        <View style={styles.hero}>
          <Animated.Image source={{ uri: s.image }} style={[StyleSheet.absoluteFill, { opacity: fade }]} resizeMode="cover" />
          {/* aged-amber wash + legibility */}
          <LinearGradient colors={['rgba(232,195,140,0.5)', 'rgba(200,150,90,0.35)']} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(40,12,4,0.55)', 'rgba(40,12,4,0.1)', 'rgba(20,5,0,0.72)']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
          {/* gold corner filigree hint */}
          <View style={[styles.corner, { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[styles.corner, { top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2 }]} />
          <View style={[styles.corner, { bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[styles.corner, { bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2 }]} />

          <Animated.View style={[styles.heroContent, { opacity: fade }]}>
            <View style={styles.omWrap}><Text style={styles.om}>ॐ</Text></View>
            <Text style={styles.heroEyebrow}>{s.eyebrow}</Text>
            <Text style={styles.heroHeadline}>{s.headline}</Text>
            <GoldDivider />
            <View style={styles.datePill}>
              <View style={styles.datePillDot} />
              <Text style={styles.datePillText}>{s.place}</Text>
            </View>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>{s.info} · </Text>
              <View style={styles.pricePill}><Text style={styles.pricePillText}>from {s.price}</Text></View>
            </View>
          </Animated.View>

          <View style={styles.slideChips}>
            {HERO_SLIDES.map((sl, i) => (
              <TouchableOpacity key={sl.title} onPress={() => setSlide(i)} style={[styles.slideChip, i === slide && styles.slideChipActive]}>
                {i === slide && <View style={styles.slideChipDot} />}
                <Text style={[styles.slideChipText, i === slide && { color: '#fff' }]}>{sl.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── CTA ROW ── */}
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push('/divya-darshana/packages' as any)}>
            <Text style={styles.ctaPrimaryText}>All-inclusive yatra packages</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={() => Linking.openURL(`tel:${EXPERT_PHONE}`)}>
            <Ionicons name="call" size={15} color={MAROON} />
            <Text style={styles.ctaSecondaryText}>Talk to a Yatra Expert</Text>
          </TouchableOpacity>
        </View>

        {/* ── FEATURE ICONS ── */}
        <View style={styles.featuresBlock}>
          <Text style={styles.eyebrow}>ON BOOKING WITH PRAYANA AI, YOU GET</Text>
          <Text style={styles.sectionH}>Everything handled, registration to darshan</Text>
          <GoldDivider />
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.feature}>
                <LinearGradient colors={[DEEP, MAROON]} style={styles.featureChip}>
                  <Ionicons name={f.icon} size={22} color={GOLD} />
                </LinearGradient>
                <Text style={styles.featureLabel} numberOfLines={2}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── OFFERS MARQUEE ── */}
        <View style={styles.offersBlock}>
          <View style={styles.offersHead}>
            <Ionicons name="pricetags" size={15} color={MAROON} />
            <Text style={styles.offersHeadText}>YATRA OFFERS & SAVINGS</Text>
          </View>
          <View style={styles.marqueeClip}>
            <Animated.View style={[styles.marqueeTrack, { transform: [{ translateX: marqueeX }] }]}>
              {[...OFFERS, ...OFFERS].map((o, i) => (
                <LinearGradient key={`${o.code}-${i}`} colors={o.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.offerCard}>
                  <Text style={styles.offerTitle}>{o.title.toUpperCase()}</Text>
                  <Text style={styles.offerSave}>{o.save}</Text>
                  <View style={styles.offerCode}><Text style={styles.offerCodeText}>{o.code}</Text></View>
                </LinearGradient>
              ))}
            </Animated.View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={MAROON} /></View>
        ) : (
          <>
            {/* ── HELICOPTER RAIL ── */}
            {heli.length > 0 && (
              <View style={styles.section}>
                <SectionHead icon="airplane" title="Helicopter yatras" sub="Skip the trek — guaranteed seats to the dhams" onSeeAll={() => router.push('/divya-darshana/packages?filter=helicopter' as any)} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} snapToInterval={SCREEN_W * 0.66 + 14} decelerationRate="fast">
                  {heli.map((p) => <ShrineCard key={p._id} pkg={p} onPress={() => openPkg(p)} />)}
                </ScrollView>
              </View>
            )}

            {/* ── LAND GRID ── */}
            <View style={styles.section}>
              <SectionHead icon="bus" title="Land & group yatras" sub="Comfortable coach journeys with darshan assistance" onSeeAll={() => router.push('/divya-darshana/packages' as any)} />
              {land.length > 0 ? (
                <View style={styles.grid}>
                  {land.map((p) => <DomeCard key={p._id} pkg={p} onPress={() => openPkg(p)} />)}
                </View>
              ) : (
                <View style={styles.emptyLand}>
                  <Ionicons name="time-outline" size={26} color={DEEP} />
                  <Text style={styles.emptyLandText}>More land yatras coming soon. Talk to our yatra expert for a custom plan.</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.allBtn} onPress={() => router.push('/divya-darshana/packages' as any)}>
              <Text style={styles.allBtnText}>Browse all yatras</Text>
              <Ionicons name="arrow-forward" size={16} color={MAROON} />
            </TouchableOpacity>

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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} snapToInterval={SCREEN_W * 0.8 + 12} decelerationRate="fast">
                {TESTIMONIALS.map((t, i) => (
                  <View key={i} style={styles.tCard}>
                    <View style={styles.stars}>
                      {[0, 1, 2, 3, 4].map((n) => <Ionicons key={n} name="star" size={12} color={GOLD} />)}
                    </View>
                    <Text style={styles.tQuote}>“{t.quote}”</Text>
                    <View style={styles.tFooter}>
                      <LinearGradient colors={t.accent} style={styles.tAvatar}>
                        <Text style={styles.tAvatarText}>{t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</Text>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHead({ icon, title, sub, onSeeAll }: { icon: any; title: string; sub: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <LinearGradient colors={[DEEP, MAROON]} style={styles.sectionHeadIcon}>
        <Ionicons name={icon} size={18} color={GOLD} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub} numberOfLines={1}>{sub}</Text>
      </View>
      <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.seeAll}>See all</Text>
      </TouchableOpacity>
    </View>
  );
}

// Helicopter rail card — brown "hood" frame, Om finial, By-Helicopter badge, BOOK.
function ShrineCard({ pkg, onPress }: { pkg: Pkg; onPress: () => void }) {
  const img = pkgImage(pkg);
  const nights = pkg.duration?.nights ?? (pkg.duration?.days ? pkg.duration.days - 1 : 0);
  return (
    <View style={[styles.shrine, { width: SCREEN_W * 0.66 }]}>
      <LinearGradient colors={['#8B5A32', '#63391D', '#3E2211']} style={styles.shrineHood} />
      <View style={styles.omFinial}><Text style={styles.omFinialText}>ॐ</Text></View>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.shrineInner}>
        <View style={styles.shrineImgWrap}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, styles.imgPh]}><Text style={styles.omBig}>ॐ</Text></View>}
          <LinearGradient colors={[MAROON, DEEP, SAFFRON]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heliBadge}>
            <Ionicons name="airplane" size={11} color="#fff" />
            <Text style={styles.heliBadgeText}>BY HELICOPTER</Text>
          </LinearGradient>
        </View>
        <Text style={styles.shrineTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{pkg.title}</Text>
        <GoldDivider />
        <Text style={styles.shrineSub} numberOfLines={2}>{pkgPlace(pkg)}{pkg.duration?.days ? ` · ${pkg.duration.days}D/${nights}N` : ''}</Text>
        <View style={styles.shrineBottom}>
          {pkg.pricing?.startingFrom ? (
            <Text style={styles.shrinePrice}><Text style={styles.fromLabel}>from </Text>₹{Number(pkg.pricing.startingFrom).toLocaleString('en-IN')}</Text>
          ) : <View />}
          <LinearGradient colors={[MAROON, DEEP, SAFFRON]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookBtn}>
            <Text style={styles.bookText}>BOOK</Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Land grid card — domed top, image + duration badge, title, place, from-price.
function DomeCard({ pkg, onPress }: { pkg: Pkg; onPress: () => void }) {
  const img = pkgImage(pkg);
  const nights = pkg.duration?.nights ?? (pkg.duration?.days ? pkg.duration.days - 1 : 0);
  return (
    <TouchableOpacity style={styles.dome} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.domeImgWrap}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.imgPh]}><Text style={styles.omBig}>ॐ</Text></View>}
        {pkg.duration?.days ? (
          <View style={styles.durBadge}><Text style={styles.durBadgeText}>{pkg.duration.days}D / {nights}N</Text></View>
        ) : null}
        {isHeli(pkg) && <View style={styles.domeHeli}><Ionicons name="airplane" size={11} color="#fff" /></View>}
      </View>
      <View style={styles.domeBody}>
        <Text style={styles.domeTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{pkg.title}</Text>
        <GoldDivider />
        {!!pkgPlace(pkg) && <Text style={styles.domePlace} numberOfLines={1}>{pkgPlace(pkg)}</Text>}
        {pkg.pricing?.startingFrom ? (
          <Text style={styles.domePrice}><Text style={styles.fromLabel}>from </Text>₹{Number(pkg.pricing.startingFrom).toLocaleString('en-IN')}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const CARD_SHADOW = { shadowColor: MAROON, shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 };
// Land grid: two cards per row at a fixed pixel width. The section pads 16 each
// side and we want a 12px gutter, so each card = (screen - 32 - 12) / 2. A
// percentage width under space-between measured narrow and left a huge gap.
const DOME_W = Math.floor((SCREEN_W - 32 - 12) / 2);

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
  hero: { height: 360, justifyContent: 'flex-end', overflow: 'hidden' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: `${GOLD}AA` },
  heroContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 6 },
  omWrap: { marginBottom: 6 },
  om: { fontSize: 26, color: GOLD, fontFamily: SERIF, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  heroEyebrow: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontFamily: SERIF, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  heroHeadline: { color: '#fff', fontSize: 30, fontFamily: SERIF, fontWeight: '700', textAlign: 'center', lineHeight: 34, marginTop: 4, textShadowColor: 'rgba(122,31,10,0.5)', textShadowRadius: 16 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: MAROON, borderWidth: 1, borderColor: 'rgba(255,210,160,0.35)' },
  datePillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F3D581' },
  datePillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingLeft: 12, paddingRight: 5, paddingVertical: 4, marginTop: 8 },
  infoPillText: { color: '#fff', fontSize: 12 },
  pricePill: { backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pricePillText: { color: '#5C1206', fontSize: 12, fontWeight: '800' },

  slideChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12, justifyContent: 'center' },
  slideChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.7)' },
  slideChipActive: { backgroundColor: MAROON, borderColor: MAROON },
  slideChipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  slideChipText: { color: MAROON, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  // CTA row
  ctaRow: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  ctaPrimary: { backgroundColor: MAROON, borderRadius: 14, paddingVertical: 14, alignItems: 'center', ...CARD_SHADOW },
  ctaPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(212,175,55,0.18)', borderWidth: 1, borderColor: GOLD, borderRadius: 14, paddingVertical: 13 },
  ctaSecondaryText: { color: MAROON, fontWeight: '700', fontSize: 14 },

  // Shared section
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: '700', color: DEEP, textTransform: 'uppercase' },
  sectionH: { fontSize: 24, fontFamily: SERIF, fontWeight: '700', color: MAROON, lineHeight: 30, marginTop: 4 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sectionHeadIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 19, fontFamily: SERIF, fontWeight: '700', color: MAROON },
  sectionSub: { fontSize: 12, color: '#71717a', marginTop: 1 },
  seeAll: { fontSize: 13, fontWeight: '700', color: DEEP },

  // Features
  featuresBlock: { paddingHorizontal: 16, marginTop: 24, alignItems: 'center' },
  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 },
  feature: { width: '19%', alignItems: 'center', gap: 6, marginBottom: 8 },
  featureChip: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', ...CARD_SHADOW },
  featureLabel: { fontSize: 9.5, textAlign: 'center', lineHeight: 12, fontWeight: '600', color: '#3f3f46' },

  // Offers marquee
  offersBlock: { marginTop: 24, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: `${GOLD}33`, backgroundColor: 'rgba(255,248,231,0.5)' },
  offersHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  offersHeadText: { fontSize: 13, fontWeight: '800', color: MAROON, letterSpacing: 1 },
  // overflow:hidden clips the marquee horizontally (needed), but with no
  // vertical padding it also shaved the offer cards' drop shadow, leaving a
  // hard-edged sliver. Give the shadow room top and bottom.
  marqueeClip: { overflow: 'hidden', paddingVertical: 8 },
  marqueeTrack: { flexDirection: 'row', paddingLeft: 16, gap: 12 },
  offerCard: { width: 280, borderRadius: 16, padding: 18, overflow: 'hidden', ...CARD_SHADOW },
  offerTitle: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  offerSave: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4, fontFamily: SERIF },
  offerCode: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  offerCodeText: { color: MAROON, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  loading: { paddingVertical: 60, alignItems: 'center' },
  rail: { gap: 14, paddingVertical: 14, paddingRight: 16 },

  // Helicopter shrine card
  shrine: { paddingTop: 18 },
  shrineHood: { position: 'absolute', top: 4, left: -2, right: -2, height: 130, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  omFinial: { position: 'absolute', top: 0, alignSelf: 'center', zIndex: 2 },
  omFinialText: { fontSize: 20, color: GOLD, fontFamily: SERIF },
  shrineInner: { backgroundColor: '#fff', borderRadius: 28, borderWidth: 1, borderColor: `${GOLD}40`, padding: 12, alignItems: 'center', ...CARD_SHADOW },
  shrineImgWrap: { width: '100%', aspectRatio: 4 / 5, borderRadius: 20, overflow: 'hidden', backgroundColor: CREAM, marginTop: 4 },
  heliBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,224,160,0.55)' },
  heliBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  shrineTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '800', color: MAROON, textAlign: 'center', marginTop: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  shrineSub: { fontSize: 12, color: '#52525b', textAlign: 'center', lineHeight: 16 },
  shrineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 12 },
  shrinePrice: { fontSize: 15, fontWeight: '800', color: MAROON },
  bookBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 },
  bookText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },

  // Land dome card
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginTop: 12, rowGap: 16 },
  // No borderWidth: on iOS a 1px border + overflow:hidden lets the full-bleed
  // image paint over the side border while the white body respects it, so the
  // image read as slightly WIDER than the body. Define the card with its shadow
  // instead; the image and body are then both exactly the card width.
  dome: { width: DOME_W, backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden', ...CARD_SHADOW },
  domeImgWrap: { width: '100%', aspectRatio: 1.2, backgroundColor: CREAM },
  durBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  durBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  domeHeli: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: SAFFRON, alignItems: 'center', justifyContent: 'center' },
  domeBody: { paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  domeTitle: { fontSize: 13.5, fontFamily: SERIF, fontWeight: '700', color: MAROON, textAlign: 'center', lineHeight: 17 },
  domePlace: { fontSize: 11, color: '#71717a', textAlign: 'center' },
  domePrice: { fontSize: 14, fontWeight: '700', color: DEEP, marginTop: 4 },
  fromLabel: { fontSize: 11, fontWeight: '400', color: '#71717a' },

  imgPh: { backgroundColor: '#FCE7C8', alignItems: 'center', justifyContent: 'center' },
  omBig: { fontSize: 36, color: SAFFRON, fontFamily: SERIF },

  emptyLand: { alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: `${GOLD}66`, borderRadius: 20, padding: 24, marginTop: 12 },
  emptyLandText: { fontSize: 13, color: '#52525b', textAlign: 'center', maxWidth: 260 },

  allBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 20, borderWidth: 1.5, borderColor: MAROON, borderRadius: 999, paddingVertical: 14 },
  allBtnText: { fontSize: 14, fontWeight: '700', color: MAROON },

  // Trust stats
  statsCard: { flexDirection: 'row', marginHorizontal: 16, marginTop: 24, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 18, borderWidth: 1, borderColor: `${GOLD}4D`, paddingVertical: 16, ...CARD_SHADOW },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: `${GOLD}4D`, marginVertical: 4 },
  statChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${GOLD}66` },
  statValue: { fontSize: 20, fontFamily: SERIF, fontWeight: '800', color: MAROON },
  statLabel: { fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  // Testimonials
  tCard: { width: SCREEN_W * 0.8, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: `${GOLD}40`, ...CARD_SHADOW },
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
