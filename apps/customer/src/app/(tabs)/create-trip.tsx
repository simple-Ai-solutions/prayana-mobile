import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  colors,
  fontSize,
  fontWeight,
  spacing,
  shadow,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import TemplateSelector from '../../components/trip/TemplateSelector';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Template data ---
const TEMPLATES = [
  {
    id: 'weekend',
    name: 'Weekend Getaway',
    emoji: '\uD83C\uDFD6\uFE0F',
    duration: '2 days',
    budget: 'budget',
    tripType: 'leisure',
    description: 'Quick escape for the weekend',
    gradient: [colors.primary[400], colors.primary[600]] as [string, string],
  },
  {
    id: 'week-adventure',
    name: 'Week Long Adventure',
    emoji: '\uD83D\uDDFA\uFE0F',
    duration: '7 days',
    budget: 'moderate',
    tripType: 'adventure',
    description: 'A full week of exploration',
    gradient: [colors.info, '#1d4ed8'] as [string, string],
  },
  {
    id: 'luxury',
    name: 'Luxury Escape',
    emoji: '\uD83D\uDC8E',
    duration: '5 days',
    budget: 'luxury',
    tripType: 'leisure',
    description: 'Premium travel experience',
    gradient: ['#a855f7', '#7c3aed'] as [string, string],
  },
  {
    id: 'cultural',
    name: 'Cultural Tour',
    emoji: '\uD83C\uDFDB\uFE0F',
    duration: '4 days',
    budget: 'moderate',
    tripType: 'cultural',
    description: 'Immerse in local culture',
    gradient: [colors.success, '#15803d'] as [string, string],
  },
];

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
        {/* ======= HEADER ======= */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Create a Trip</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Plan your perfect journey with AI</Text>
        </View>

        {/* ======= START NEW TRIP CTA ======= */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.ctaButton, shadow.md]}
            activeOpacity={0.85}
            onPress={handleStartNewTrip}
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaEmoji}>{'\u2728'}</Text>
              <View style={styles.ctaTextContainer}>
                <Text style={styles.ctaTitle}>Start New Trip</Text>
                <Text style={styles.ctaSubtitle}>Create a custom trip from scratch</Text>
              </View>
              <Text style={styles.ctaArrow}>{'\u2192'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ======= TEMPLATES SECTION ======= */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Start from a Template</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>Pick a template and customize it your way</Text>

          <View style={styles.templateGrid}>
            {TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateCard, shadow.sm, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                activeOpacity={0.85}
                onPress={() => handleTemplatePress(template)}
              >
                <LinearGradient
                  colors={template.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.templateGradient}
                >
                  <Text style={styles.templateEmoji}>{template.emoji}</Text>
                </LinearGradient>
                <View style={styles.templateInfo}>
                  <Text style={[styles.templateName, { color: themeColors.text }]} numberOfLines={1}>
                    {template.name}
                  </Text>
                  <Text style={[styles.templateMeta, { color: themeColors.textTertiary }]}>
                    {template.duration} &middot;{' '}
                    {template.budget.charAt(0).toUpperCase() + template.budget.slice(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ======= DESTINATION TEMPLATES ======= */}
        <TemplateSelector />

        {/* ======= RECENT DRAFTS ======= */}
        {loadingDrafts ? (
          <View style={styles.draftLoader}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
          </View>
        ) : recentDrafts.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Continue Planning</Text>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>Pick up where you left off</Text>

            {recentDrafts.map((draft, idx) => {
              const destCount = draft.destinations?.length || 0;
              const dateRange =
                draft.startDate && draft.endDate
                  ? `${formatDate(draft.startDate)} - ${formatDate(draft.endDate)}`
                  : 'Dates not set';

              return (
                <TouchableOpacity
                  key={draft._id || draft.tripId || String(idx)}
                  style={[styles.draftCard, shadow.sm, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  activeOpacity={0.85}
                  onPress={() => handleContinueDraft(draft)}
                >
                  <View style={styles.draftIconContainer}>
                    <LinearGradient
                      colors={[colors.primary[100], colors.primary[200]]}
                      style={styles.draftIcon}
                    >
                      <Text style={styles.draftIconText}>{'\uD83D\uDCDD'}</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.draftInfo}>
                    <Text style={[styles.draftName, { color: themeColors.text }]} numberOfLines={1}>
                      {draft.name || 'Untitled Trip'}
                    </Text>
                    <Text style={[styles.draftMeta, { color: themeColors.textTertiary }]}>
                      {dateRange}
                      {destCount > 0 ? ` \u00B7 ${destCount} dest${destCount !== 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.draftArrow}>{'\u203A'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* ======= AI TIP ======= */}
        <View style={[styles.section, { marginBottom: spacing['3xl'] }]}>
          <View style={[styles.tipCard, shadow.sm]}>
            <Text style={styles.tipEmoji}>{'\uD83E\uDD16'}</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>AI-Powered Planning</Text>
              <Text style={styles.tipText}>
                Our AI suggests destinations, activities, and optimizes your itinerary based on your
                preferences, budget, and travel style.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const TEMPLATE_CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // --- Header ---
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // --- CTA Button ---
  ctaContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  ctaButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  ctaEmoji: {
    fontSize: 28,
    marginRight: spacing.lg,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  ctaSubtitle: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  ctaArrow: {
    fontSize: fontSize.xl,
    color: '#ffffff',
    fontWeight: fontWeight.bold,
    marginLeft: spacing.md,
  },

  // --- Section ---
  section: {
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  // --- Template Grid ---
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  templateCard: {
    width: TEMPLATE_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateGradient: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateEmoji: {
    fontSize: 28,
  },
  templateInfo: {
    padding: spacing.md,
  },
  templateName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  templateMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // --- Draft Cards ---
  draftLoader: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  draftIconContainer: {
    marginRight: spacing.md,
  },
  draftIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftIconText: {
    fontSize: 20,
  },
  draftInfo: {
    flex: 1,
  },
  draftName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  draftMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  draftArrow: {
    fontSize: 24,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },

  // --- AI Tip ---
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  tipText: {
    fontSize: fontSize.xs,
    color: colors.primary[600],
    lineHeight: 18,
  },
});
