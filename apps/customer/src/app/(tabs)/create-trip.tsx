import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, useTheme } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import TemplateSelector from '../../components/trip/TemplateSelector';
import { tripDays, tripSpots, tripTitle, editedAgo, DEFAULT_TRIP_IMAGES } from '../../components/trips/TripPass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Trip styles: a starting budget and pace, then the usual setup ---
const TEMPLATES = [
  {
    id: 'weekend', name: 'Weekend Getaway', duration: '2 days', budget: 'budget', tripType: 'leisure',
    description: 'A quick escape', icon: 'sunny' as const,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640&q=80',
  },
  {
    id: 'week-adventure', name: 'Week-long Adventure', duration: '7 days', budget: 'moderate', tripType: 'adventure',
    description: 'A full week of exploring', icon: 'compass' as const,
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=640&q=80',
  },
  {
    id: 'luxury', name: 'Luxury Escape', duration: '5 days', budget: 'luxury', tripType: 'leisure',
    description: 'Premium stays, slow days', icon: 'diamond' as const,
    image: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?w=640&q=80',
  },
  {
    id: 'cultural', name: 'Cultural Tour', duration: '4 days', budget: 'moderate', tripType: 'cultural',
    description: 'Forts, food and festivals', icon: 'library' as const,
    image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=640&q=80',
  },
];

const HERO = require('../../../assets/hero-scenery.jpg');
const RED = '#E61417';
const ORANGE = '#f97316';

export default function CreateTripScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();
  const resetTrip = useCreateTripStore((s: any) => s.resetTrip);

  const [recentDrafts, setRecentDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // --- Fetch recent drafts ---
  const fetchRecentDrafts = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingDrafts(true);
    try {
      const response = await createTripAPI.getUserTrips(user.uid, { status: 'draft' });
      if (response?.success && Array.isArray(response.data)) {
        setRecentDrafts(response.data.slice(0, 2));
      } else if (Array.isArray(response)) {
        const drafts = response.filter(
          (t) => (t.status || 'draft').toLowerCase() === 'draft'
        );
        setRecentDrafts(drafts.slice(0, 2));
      }
    } catch (err: any) {
      console.warn('[CreateTrip] Failed to fetch drafts:', err?.message);
    } finally {
      setLoadingDrafts(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchRecentDrafts();
  }, [fetchRecentDrafts]);

  // --- Handle template selection ---
  const handleTemplatePress = useCallback(
    (template: any) => {
      const store: any = useCreateTripStore.getState();
      store.resetTrip();
      store.setName(template.name);
      store.setBudget(template.budget);
      store.setTripType(template.tripType);
      router.push('/trip/setup');
    },
    [router]
  );

  // --- Handle start new trip ---
  const handleStartNewTrip = useCallback(() => {
    resetTrip();
    router.push('/trip/setup');
  }, [router, resetTrip]);

  // --- Handle continue draft ---
  const handleContinueDraft = useCallback(
    (draft: any) => {
      const id = draft._id || draft.tripId;
      if (id) {
        router.push(`/trip/${id}`);
      }
    },
    [router]
  );

  // --- Format date ---
  const formatDate = useCallback((dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ======= HERO: a photo card with the main action ======= */}
        <View style={styles.heroWrap}>
          <Pressable onPress={handleStartNewTrip} accessibilityRole="button" accessibilityLabel="Start a new trip" style={({ pressed }) => [styles.hero, pressed && { transform: [{ scale: 0.99 }] }]}>
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroPill}>
              <Ionicons name="sparkles" size={11} color={RED} />
              <Text style={styles.heroPillText}>AI TRIP PLANNER</Text>
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>Plan your perfect{'\n'}escape with AI</Text>
              <Text style={styles.heroSub}>Tell us where and when — get a day-by-day plan with routes, timings and budget.</Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>Start a new trip</Text>
                <LinearGradient colors={[ORANGE, RED]} style={styles.heroCtaIcon}>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </View>
            </View>
          </Pressable>
        </View>

        {/* ======= HOW IT WORKS ======= */}
        <View style={styles.steps}>
          {([
            ['location', 'Pick places'],
            ['calendar', 'Choose dates'],
            ['sparkles', 'AI builds it'],
          ] as const).map(([icon, label], i) => (
            <React.Fragment key={label}>
              {i > 0 ? <View style={[styles.stepLine, { backgroundColor: themeColors.border }]} /> : null}
              <View style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                  <Ionicons name={icon} size={16} color={ORANGE} />
                </View>
                <Text style={[styles.stepText, { color: themeColors.textSecondary }]}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* ======= CONTINUE PLANNING ======= */}
        {loadingDrafts ? (
          <View style={styles.draftLoader}>
            <ActivityIndicator size="small" color={ORANGE} />
          </View>
        ) : recentDrafts.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Continue planning</Text>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>Pick up where you left off</Text>
            <View style={{ gap: 10 }}>
              {recentDrafts.map((draft, idx) => {
                const days = tripDays(draft);
                const spots = tripSpots(draft);
                const edited = editedAgo(draft.updatedAt || draft.createdAt);
                return (
                  <Pressable
                    key={draft._id || draft.tripId || String(idx)}
                    style={({ pressed }) => [styles.draftCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, pressed && { opacity: 0.9 }]}
                    onPress={() => handleContinueDraft(draft)}
                    accessibilityRole="button"
                  >
                    <Image
                      source={{ uri: draft.coverImage || draft.destinations?.[0]?.images?.[0]?.url || DEFAULT_TRIP_IMAGES[idx % DEFAULT_TRIP_IMAGES.length] }}
                      style={styles.draftIcon}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                    <View style={styles.draftInfo}>
                      <Text style={[styles.draftName, { color: themeColors.text }]} numberOfLines={1}>{tripTitle(draft)}</Text>
                      <Text style={[styles.draftMeta, { color: themeColors.textTertiary }]} numberOfLines={1}>
                        {[days ? `${days} day${days === 1 ? '' : 's'}` : null, spots ? `${spots} spots` : null, edited ? `edited ${edited}` : null].filter(Boolean).join(' · ') || 'Just started'}
                      </Text>
                    </View>
                    <View style={[styles.resume, { backgroundColor: themeColors.text }]}>
                      <Text style={[styles.resumeText, { color: themeColors.background }]}>Resume</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ======= TRIP STYLES ======= */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Start with a trip style</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>We set the pace and budget — you pick the places</Text>
          <View style={styles.templateGrid}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                style={({ pressed }) => [styles.templateCard, pressed && { transform: [{ scale: 0.98 }] }]}
                onPress={() => handleTemplatePress(t)}
                accessibilityRole="button"
                accessibilityLabel={`${t.name}, ${t.duration}`}
              >
                <Image source={{ uri: t.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
                <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
                <View style={styles.templateIcon}>
                  <Ionicons name={t.icon} size={14} color="#fff" />
                </View>
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName} numberOfLines={2}>{t.name}</Text>
                  <Text style={styles.templateMeta}>
                    {t.duration} · {t.budget.charAt(0).toUpperCase() + t.budget.slice(1)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ======= READY-MADE ITINERARIES ======= */}
        <TemplateSelector />

        {/* ======= AI NOTE ======= */}
        <View style={[styles.section, { marginBottom: spacing['3xl'] }]}>
          <LinearGradient colors={['#111827', '#1f2937']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tipCard}>
            <LinearGradient colors={['rgba(230,20,23,0.5)', 'rgba(230,20,23,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.tipIcon}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Planning, done for you</Text>
              <Text style={styles.tipText}>
                Our AI suggests places and activities, orders them into sensible routes, and fits them to your budget and travel style.
              </Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const TEMPLATE_CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing['3xl'] },

  heroWrap: { paddingHorizontal: 16, paddingTop: 10 },
  hero: {
    height: 300, borderRadius: 28, overflow: 'hidden', justifyContent: 'flex-end',
    shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  heroPill: {
    position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  heroPillText: { color: RED, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  heroBody: { padding: 20 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 35 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 18, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, marginTop: 16,
  },
  heroCtaText: { color: '#111827', fontSize: 16, fontWeight: '900' },
  heroCtaIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 18 },
  step: { alignItems: 'center', gap: 6 },
  stepIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 11.5, fontWeight: '700' },
  stepLine: { flex: 1, height: 1.5, marginHorizontal: 6, marginBottom: 20 },

  section: { marginTop: 28, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, color: colors.text },
  sectionSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 12 },

  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  templateCard: {
    width: TEMPLATE_CARD_WIDTH, height: Math.round(TEMPLATE_CARD_WIDTH * 1.05), borderRadius: 20, overflow: 'hidden',
    justifyContent: 'flex-end', backgroundColor: '#1f2937',
    shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  templateIcon: {
    position: 'absolute', top: 10, left: 10, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  templateInfo: { padding: 12 },
  templateName: { color: '#fff', fontSize: 15.5, fontWeight: '900', lineHeight: 19 },
  templateMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 3 },

  draftLoader: { marginTop: spacing['2xl'], alignItems: 'center', paddingVertical: spacing.lg },
  draftCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12, borderWidth: 1 },
  draftIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#f3f4f6' },
  draftInfo: { flex: 1, minWidth: 0 },
  draftName: { fontSize: 15.5, fontWeight: '800' },
  draftMeta: { fontSize: 12.5, marginTop: 3 },
  resume: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  resumeText: { fontSize: 12.5, fontWeight: '800' },

  tipCard: { flexDirection: 'row', gap: 14, borderRadius: 22, padding: 18, overflow: 'hidden' },
  tipIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  tipContent: { flex: 1 },
  tipTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  tipText: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 18, marginTop: 4 },
});
