// Quick Itinerary — browse trending/saved itineraries and instantly generate
// a new AI itinerary from a destination + a few preferences.
// Mirrors the PWA /quick-plan feature, mobile-native.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  Sparkles,
  Star,
  Heart,
  Mountain,
  Church,
  UtensilsCrossed,
  Waves,
  Landmark,
  ImageIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
  Badge,
} from '@prayana/shared-ui';
import { itineraryAPI } from '@prayana/shared-services';

// ---- Static browse content (parity with PWA quickItinerariesEnhanced) ----
const TRENDING = [
  { id: 'goa-3', destination: 'Goa', days: 3, theme: 'Beach', rating: 4.8,
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600' },
  { id: 'manali-4', destination: 'Manali', days: 4, theme: 'Adventure', rating: 4.7,
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600' },
  { id: 'jaipur-2', destination: 'Jaipur', days: 2, theme: 'Heritage', rating: 4.6,
    image: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600' },
  { id: 'kerala-5', destination: 'Kerala', days: 5, theme: 'Nature', rating: 4.9,
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600' },
  { id: 'ladakh-6', destination: 'Ladakh', days: 6, theme: 'Adventure', rating: 4.9,
    image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=600' },
];

// Icons mirror the PWA (lucide): Heart, Mountain, Church, UtensilsCrossed, Waves, Landmark
const THEMES = [
  { id: 'romantic', label: 'Romantic', Icon: Heart },
  { id: 'adventure', label: 'Adventure', Icon: Mountain },
  { id: 'spiritual', label: 'Spiritual', Icon: Church },
  { id: 'food', label: 'Food', Icon: UtensilsCrossed },
  { id: 'beach', label: 'Beach', Icon: Waves },
  { id: 'heritage', label: 'Heritage', Icon: Landmark },
];

const DURATIONS = [2, 3, 4, 5, 7, 10, 14];
const BUDGETS = [
  { id: 'budget', label: 'Budget' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'luxury', label: 'Luxury' },
];

// Transport modes (merged from the former /trip/plan screen).
const TRANSPORT_MODES = [
  { id: 'car', label: 'Car / Bus', emoji: '🚗' },
  { id: 'bike', label: 'Bike', emoji: '🏍️' },
  { id: 'flight', label: 'Flight', emoji: '✈️' },
];

export default function QuickItineraryScreen() {
  const { themeColors } = useTheme();

  // ---- Generate form state ----
  const [destination, setDestination] = useState('');
  const [startingPoint, setStartingPoint] = useState('');
  const [duration, setDuration] = useState(3);
  const [transportMode, setTransportMode] = useState('flight');
  const [budget, setBudget] = useState('moderate');
  const [interests, setInterests] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  // ---- Saved itineraries (from API) ----
  const [saved, setSaved] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await itineraryAPI.search({ limit: 10, offset: 0 });
        const items = res?.data || res?.itineraries || res?.results || [];
        if (active) setSaved(Array.isArray(items) ? items : []);
      } catch (e: any) {
        console.warn('[QuickItinerary] saved fetch failed:', e?.message);
        if (active) setSaved([]);
      } finally {
        if (active) setLoadingSaved(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggleInterest = useCallback((id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const canGenerate = destination.trim().length >= 2 && !generating;

  const handleGenerate = useCallback(
    async (presetDestination?: string, presetDays?: number) => {
      const dest = (presetDestination ?? destination).trim();
      if (!dest) return;
      setGenerating(true);
      const days = presetDays ?? duration;
      try {
        const payload = {
          destination: dest,
          duration: days,
          startingPoint: startingPoint.trim() || undefined,
          transportMode: transportMode === 'car' ? 'car_bus' : transportMode,
          preferences: {
            budget,
            interests,
            travelStyle: interests[0] || 'balanced',
            groupType: 'solo',
          },
        };
        const result: any = await itineraryAPI.generateMarkdown(payload);
        const markdown =
          result?.content ||
          result?.markdown ||
          result?.data?.markdown ||
          (typeof result === 'string' ? result : '');
        // Route to the shared itinerary viewer (Travel Guide + Timeline tabs).
        router.push({
          pathname: '/trip/itinerary',
          params: {
            markdown,
            title: result?.title || `${days}-Day ${dest} Trip`,
            destination: dest,
            duration: String(days),
            transportMode,
            startingPoint: startingPoint.trim() || '',
            markdownItineraryId: result?.markdownItineraryId || result?._id || '',
          },
        });
      } catch (e: any) {
        console.error('[QuickItinerary] generate failed:', e?.message);
        router.push({
          pathname: '/quick-itinerary/result',
          params: { error: e?.message || 'Generation failed', destination: dest },
        });
      } finally {
        setGenerating(false);
      }
    },
    [destination, startingPoint, duration, transportMode, budget, interests]
  );

  const renderTrending = useMemo(
    () => (
      <FlatList
        horizontal
        data={TRENDING}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.trendCard, shadow.md]}
            onPress={() => handleGenerate(item.destination, item.days)}
          >
            <Image source={{ uri: item.image }} style={styles.trendImage} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)']}
              style={styles.trendOverlay}
            />
            <View style={styles.trendRating}>
              <Star size={11} color="#fbbf24" fill="#fbbf24" />
              <Text style={styles.trendRatingText}>{item.rating}</Text>
            </View>
            <View style={styles.trendInfo}>
              <Text style={styles.trendDest}>{item.destination}</Text>
              <Text style={styles.trendMeta}>
                {item.days} days · {item.theme}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    ),
    [handleGenerate]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>
          Quick Itinerary
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero / generate card */}
        <LinearGradient
          colors={[colors.primary[500], colors.primary[700]]}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>Plan a trip in seconds</Text>
          <Text style={styles.heroSub}>
            Tell us where, and AI builds a day-by-day plan.
          </Text>
          <View style={styles.searchRow}>
            <MapPin size={18} color={colors.primary[500]} />
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder="Where to? e.g. Goa, Manali"
              placeholderTextColor={colors.gray[400]}
              style={styles.searchInput}
              returnKeyType="next"
            />
          </View>
          <View style={[styles.searchRow, { marginTop: spacing.sm }]}>
            <Navigation size={18} color={colors.gray[400]} />
            <TextInput
              value={startingPoint}
              onChangeText={setStartingPoint}
              placeholder="Starting from (optional)"
              placeholderTextColor={colors.gray[400]}
              style={styles.searchInput}
              returnKeyType="go"
              onSubmitEditing={() => canGenerate && handleGenerate()}
            />
          </View>
        </LinearGradient>

        {/* Duration */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>
          How many days?
        </Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => {
            const active = duration === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDuration(d)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary[500] : themeColors.surface,
                    borderColor: active ? colors.primary[500] : themeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : themeColors.textSecondary },
                  ]}
                >
                  {d} days
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Budget */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>Budget</Text>
        <View style={styles.chipRow}>
          {BUDGETS.map((b) => {
            const active = budget === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => setBudget(b.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary[500] : themeColors.surface,
                    borderColor: active ? colors.primary[500] : themeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : themeColors.textSecondary },
                  ]}
                >
                  {b.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Transport mode */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>
          How will you travel?
        </Text>
        <View style={styles.chipRow}>
          {TRANSPORT_MODES.map((m) => {
            const active = transportMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setTransportMode(m.id)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: active ? colors.primary[50] : themeColors.surface,
                    borderColor: active ? colors.primary[500] : themeColors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: fontSize.md }}>{m.emoji}</Text>
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primary[700] : themeColors.textSecondary },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Interests / themes */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>
          Interests
        </Text>
        <View style={styles.chipRow}>
          {THEMES.map((t) => {
            const active = interests.includes(t.id);
            const ThemeIcon = t.Icon;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => toggleInterest(t.id)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: active ? colors.primary[50] : themeColors.surface,
                    borderColor: active ? colors.primary[500] : themeColors.border,
                  },
                ]}
              >
                <ThemeIcon
                  size={15}
                  color={active ? colors.primary[600] : themeColors.textTertiary}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primary[700] : themeColors.textSecondary },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Generate button */}
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!canGenerate}
          onPress={() => handleGenerate()}
          style={[
            styles.generateBtn,
            shadow.md,
            { backgroundColor: canGenerate ? colors.primary[500] : colors.gray[300] },
          ]}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.generateText}>Building your itinerary…</Text>
            </>
          ) : (
            <>
              <Sparkles size={18} color="#fff" />
              <Text style={styles.generateText}>Generate Itinerary</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Trending */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Trending now
          </Text>
          <Badge label="Tap to generate" variant="info" />
        </View>
        {renderTrending}

        {/* Saved itineraries */}
        <Text
          style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.xl }]}
        >
          Saved itineraries
        </Text>
        {loadingSaved ? (
          <ActivityIndicator
            color={colors.primary[500]}
            style={{ marginVertical: spacing.xl }}
          />
        ) : saved.length === 0 ? (
          <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
            No saved itineraries yet. Generate one above to get started.
          </Text>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {saved.map((it: any, idx: number) => (
              <TouchableOpacity
                key={it._id || it.id || idx}
                activeOpacity={0.85}
                style={[
                  styles.savedCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/quick-itinerary/result',
                    params: {
                      id: it._id || it.id,
                      destination: it.destination || it.title || '',
                    },
                  })
                }
              >
                {it.primaryImage || it.images?.[0]?.url ? (
                  <Image
                    source={{ uri: it.primaryImage || it.images[0].url }}
                    style={styles.savedImage}
                  />
                ) : (
                  <View style={[styles.savedImage, { backgroundColor: colors.primary[100] }]}>
                    <ImageIcon size={22} color={colors.primary[400]} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.savedTitle, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {it.title || `${it.destination} Trip`}
                  </Text>
                  <Text
                    style={[styles.savedMeta, { color: themeColors.textTertiary }]}
                    numberOfLines={1}
                  >
                    {(it.duration || it.days || '?') + ' days'}
                    {it.destination ? ` · ${it.destination}` : ''}
                  </Text>
                </View>
                <ChevronRight size={20} color={themeColors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  hero: {
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, marginTop: spacing.xs },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.gray[900],
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  generateText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  trendCard: {
    width: 150,
    height: 190,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray[200],
  },
  trendImage: { width: '100%', height: '100%', position: 'absolute' },
  trendOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  trendRating: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  trendRatingText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  trendInfo: { position: 'absolute', bottom: spacing.md, left: spacing.md, right: spacing.sm },
  trendDest: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  trendMeta: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, marginTop: 2 },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  savedImage: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  savedMeta: { fontSize: fontSize.xs, marginTop: 3 },
});
