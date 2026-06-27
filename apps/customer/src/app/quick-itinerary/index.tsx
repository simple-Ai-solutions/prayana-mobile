// Quick Itinerary — BROWSE-FIRST (matches PWA mobile /quick-plan).
// Hero is a search bar only (no form). Body is carousels of curated +
// saved itineraries. Tapping any card generates/opens that itinerary.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, Search, X, Star, Calendar, MapPin, ArrowRight,
  Heart, Mountain, Church, UtensilsCrossed, Waves, Landmark,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow,
} from '@prayana/shared-ui';
import { itineraryAPI } from '@prayana/shared-services';

// ---- PWA Quick Itinerary brand palette (matches /quick-plan) ----
const PWA = {
  teal: '#2EC4B6',       // primary accent: dots, CTA, hover, MapPin, badges
  tealDark: '#26a69a',   // CTA gradient end
  star: '#FFE66D',       // star-rating yellow
  titleOrange: '#F97316',// hero title gradient start (orange-500)
  titleRed: '#EF4444',   // hero title gradient mid (red-500)
  popular: '#F59E0B',    // amber "Popular" badge
  booked: '#EF4444',     // red "Booked" badge
};

// ---- Curated browse content (parity with PWA quickItinerariesEnhanced) ----
const TRENDING = [
  { id: 'goa-3', destination: 'Goa', days: 3, rating: 4.8, reviews: '2.4k', booked: 320,
    highlights: ['Beaches', 'Nightlife', 'Seafood'], budget: 18000,
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800' },
  { id: 'manali-4', destination: 'Manali', days: 4, rating: 4.7, reviews: '1.9k', booked: 280,
    highlights: ['Snow', 'Adventure', 'Valleys'], budget: 22000,
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  { id: 'kerala-5', destination: 'Kerala', days: 5, rating: 4.9, reviews: '3.1k', booked: 410,
    highlights: ['Backwaters', 'Hills', 'Ayurveda'], budget: 28000,
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800' },
  { id: 'ladakh-6', destination: 'Ladakh', days: 6, rating: 4.9, reviews: '2.7k', booked: 190,
    highlights: ['Monasteries', 'Passes', 'Lakes'], budget: 35000,
    image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=800' },
];

const THEMES = [
  { id: 'romantic', title: 'Romantic', count: 42, Icon: Heart, gradient: ['#EC4899', '#BE185D'] as const },
  { id: 'adventure', title: 'Adventure', count: 56, Icon: Mountain, gradient: ['#F97316', '#C2410C'] as const },
  { id: 'spiritual', title: 'Spiritual', count: 38, Icon: Church, gradient: ['#8B5CF6', '#6D28D9'] as const },
  { id: 'food', title: 'Food & Culture', count: 47, Icon: UtensilsCrossed, gradient: ['#EF4444', '#B91C1C'] as const },
  { id: 'beach', title: 'Beach', count: 31, Icon: Waves, gradient: ['#06B6D4', '#0E7490'] as const },
  { id: 'heritage', title: 'Heritage', count: 52, Icon: Landmark, gradient: ['#D97706', '#92400E'] as const },
];

export default function QuickItineraryScreen() {
  const { themeColors, isDarkMode } = useTheme();

  const [query, setQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genLabel, setGenLabel] = useState('');

  const [saved, setSaved] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [showAllSaved, setShowAllSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved itineraries (+ search filter)
  const loadSaved = useCallback(async (q?: string) => {
    setLoadingSaved(true);
    try {
      const res: any = await itineraryAPI.search({ limit: 20, ...(q ? { q } : {}) });
      const items = res?.data?.results || res?.data || res?.results || [];
      setSaved(Array.isArray(items) ? items : []);
    } catch (e: any) {
      console.warn('[QuickItinerary] saved fetch failed:', e?.message);
      setSaved([]);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const onSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSaved(text.trim() || undefined), 350);
  }, [loadSaved]);

  // Tap a card -> open if it has a slug/id, otherwise generate from template.
  const openItinerary = useCallback(async (item: any) => {
    // Already-saved itinerary: open its detail directly.
    const id = item._id || item.slug || item.urlSlug;
    const days = Array.isArray(item.days) ? item.days.length : (item.days || item.duration || 3);

    setGenLabel(item.title || item.destination || 'your trip');
    setGenerating(true);
    try {
      const result: any = await itineraryAPI.generateMarkdown({
        destination: item.destination || item.name || item.title,
        duration: days,
        startingPoint: item.startingPoint || '',
        transportMode: item.transportMode || 'mixed',
        preferences: {
          budget: (item.budget && item.budget <= 15000) ? 'budget' : 'moderate',
          interests: item.highlights || [],
          travelStyle: 'relaxed',
          groupType: 'general',
        },
      });
      const markdown = result?.content || result?.markdown || result?.data?.markdown || '';
      router.push({
        pathname: '/trip/itinerary',
        params: {
          markdown,
          title: result?.title || item.title || `${days}-Day ${item.destination} Trip`,
          destination: item.destination || item.name || '',
          duration: String(days),
          transportMode: item.transportMode || 'mixed',
          markdownItineraryId: result?.markdownItineraryId || id || '',
        },
      });
    } catch (e: any) {
      console.warn('[QuickItinerary] generate failed:', e?.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  const displayedSaved = useMemo(
    () => (showAllSaved ? saved : saved.slice(0, 8)),
    [saved, showAllSaved]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Quick Itineraries</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['3xl'] }} keyboardShouldPersistTaps="handled">
        {/* Hero: title + search only (no form) */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            <Text style={{ color: PWA.titleOrange }}>Quick</Text>
            <Text style={{ color: themeColors.text }}> Itineraries</Text>
          </Text>
          <View style={[styles.searchBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Search size={18} color={themeColors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={onSearchChange}
              placeholder="Search destinations, themes, or activities..."
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.searchInput, { color: themeColors.text }]}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); loadSaved(); }}>
                <X size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Trending (hidden while searching) */}
        {!query && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Most Viewed Adventures</Text>
            <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>Trending this week</Text>
            <FlatList
              horizontal
              data={TRENDING}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md }}
              renderItem={({ item }) => (
                <TouchableOpacity activeOpacity={0.9} style={[styles.trendCard, shadow.lg]} onPress={() => openItinerary(item)}>
                  <Image source={{ uri: item.image }} style={styles.trendImg} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.trendOverlay} />
                  <View style={styles.trendTopBadges}>
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedText}>🔥 {item.booked}+ Booked</Text>
                    </View>
                    <View style={styles.popularBadge}><Text style={styles.popularText}>Popular</Text></View>
                  </View>
                  <View style={styles.trendContent}>
                    <Text style={styles.trendName}>{item.destination}</Text>
                    <View style={styles.trendMetaRow}>
                      <Star size={14} color={PWA.star} fill={PWA.star} />
                      <Text style={styles.trendMetaText}>{item.rating}</Text>
                      <Text style={styles.trendMetaDim}>· {item.days}D/{item.days - 1}N</Text>
                    </View>
                    <View style={styles.highlightRow}>
                      {item.highlights.slice(0, 3).map((h) => (
                        <View key={h} style={styles.highlightPill}><Text style={styles.highlightText}>{h}</Text></View>
                      ))}
                    </View>
                    <View style={styles.trendBottom}>
                      <Text style={styles.trendPrice}>₹{Math.floor(item.budget / 1000)}k <Text style={styles.trendPriceDim}>pp</Text></Text>
                      <View style={styles.viewBtn}><Text style={styles.viewBtnText}>View Details</Text></View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Themes (hidden while searching) */}
        {!query && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Explore by Theme</Text>
            <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>Discover trips based on your interests</Text>
            <View style={styles.themeGrid}>
              {THEMES.map((t) => {
                const Icon = t.Icon;
                return (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.9}
                    style={[styles.themeCard, shadow.md]}
                    onPress={() => router.push(`/theme-itineraries` as any)}
                  >
                    <LinearGradient colors={t.gradient} style={StyleSheet.absoluteFill} />
                    <View style={styles.themeTop}>
                      <View style={styles.themeIconCircle}><Icon size={20} color="#fff" /></View>
                      <View style={styles.themeCountBadge}><Text style={styles.themeCountText}>{t.count} trips</Text></View>
                    </View>
                    <Text style={styles.themeTitle}>{t.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Saved Itineraries */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            {query ? `Results for "${query}"` : 'Saved Itineraries'}
          </Text>
          {!query && <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>Ready-to-go trips, tap to generate</Text>}

          {loadingSaved ? (
            <ActivityIndicator color={PWA.teal} style={{ marginVertical: spacing['2xl'] }} />
          ) : saved.length === 0 ? (
            <Text style={[styles.empty, { color: themeColors.textTertiary }]}>
              {query ? `No itineraries found for "${query}".` : 'No saved itineraries yet.'}
            </Text>
          ) : (
            <>
              <View style={styles.savedGrid}>
                {displayedSaved.map((it: any, idx: number) => {
                  const img = it.primaryImage || it.images?.[0]?.url || it.image;
                  const dur = it.duration || (Array.isArray(it.days) ? it.days.length : it.days);
                  return (
                    <TouchableOpacity
                      key={it._id || idx}
                      activeOpacity={0.9}
                      style={[styles.savedCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => openItinerary(it)}
                    >
                      {img ? (
                        <Image source={{ uri: img }} style={styles.savedImg} />
                      ) : (
                        <LinearGradient colors={[PWA.teal, PWA.tealDark]} style={styles.savedImg}>
                          <MapPin size={22} color="rgba(255,255,255,0.85)" />
                        </LinearGradient>
                      )}
                      <View style={styles.savedBody}>
                        <Text style={[styles.savedTitle, { color: themeColors.text }]} numberOfLines={2}>
                          {it.title || `${it.destination} Trip`}
                        </Text>
                        {!!dur && (
                          <View style={styles.savedMetaRow}>
                            <Calendar size={12} color={themeColors.textTertiary} />
                            <Text style={[styles.savedMeta, { color: themeColors.textTertiary }]}>{dur}D{dur > 1 ? `/${dur - 1}N` : ''}</Text>
                          </View>
                        )}
                        {!!it.destination && (
                          <View style={styles.savedMetaRow}>
                            <MapPin size={12} color={themeColors.textTertiary} />
                            <Text style={[styles.savedMeta, { color: themeColors.textTertiary }]} numberOfLines={1}>{it.destination}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {saved.length > 8 && (
                <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowAllSaved((s) => !s)}>
                  <Text style={[styles.viewAllText, { color: colors.primary[500] }]}>
                    {showAllSaved ? 'Show Less' : 'View All'}
                  </Text>
                  <ArrowRight size={16} color={colors.primary[500]} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Generating overlay (matches PWA modal) */}
      <Modal visible={generating} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.genBackdrop}>
          <View style={[styles.genCard, { backgroundColor: themeColors.surface }]}>
            <ActivityIndicator size="large" color={PWA.teal} />
            <Text style={[styles.genTitle, { color: themeColors.text }]}>Creating Your Itinerary</Text>
            <Text style={[styles.genSub, { color: themeColors.textSecondary }]} numberOfLines={2}>
              Crafting a plan for {genLabel}…
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  iconBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, alignItems: 'center' },
  heroTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, textAlign: 'center', marginBottom: spacing.lg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '100%',
    paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: fontSize.md },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, paddingHorizontal: spacing.lg },
  sectionSub: { fontSize: fontSize.sm, paddingHorizontal: spacing.lg, marginTop: 2 },
  // Trending
  trendCard: { width: 290, height: 380, borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: colors.gray[200] },
  trendImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  trendOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  trendTopBadges: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  bookedBadge: { backgroundColor: '#EF4444', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: borderRadius.md },
  bookedText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  popularBadge: { backgroundColor: '#F59E0B', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: borderRadius.md },
  popularText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  trendContent: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  trendName: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  trendMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trendMetaText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  trendMetaDim: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  highlightPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  highlightText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  trendBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  trendPrice: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  trendPriceDim: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs, fontWeight: fontWeight.normal },
  viewBtn: { backgroundColor: '#10B981', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  viewBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  // Themes
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  themeCard: { width: '47.5%', height: 130, borderRadius: borderRadius.xl, overflow: 'hidden', padding: spacing.md, justifyContent: 'space-between' },
  themeTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  themeIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  themeCountBadge: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  themeCountText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#1f2937' },
  themeTitle: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  // Saved
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  savedCard: { width: '47.5%', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, marginBottom: spacing.xs },
  savedImg: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center' },
  savedBody: { padding: spacing.md, gap: 5 },
  savedTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: 18 },
  savedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  savedMeta: { fontSize: fontSize.xs },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  viewAllText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  empty: { fontSize: fontSize.sm, textAlign: 'center', marginVertical: spacing['2xl'], paddingHorizontal: spacing.xl },
  // Generating overlay
  genBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  genCard: { borderRadius: borderRadius.xl, padding: spacing['2xl'], alignItems: 'center', gap: spacing.md, width: '85%' },
  genTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  genSub: { fontSize: fontSize.sm, textAlign: 'center' },
});
