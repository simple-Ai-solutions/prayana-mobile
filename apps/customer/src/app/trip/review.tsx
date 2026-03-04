import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { TouchableOpacity, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'Not set';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateShort(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const BUDGET_LABELS: Record<string, string> = {
  budget: 'Budget',
  moderate: 'Moderate',
  luxury: 'Luxury',
};

const BUDGET_EMOJIS: Record<string, string> = {
  budget: '\uD83D\uDCB0',
  moderate: '\uD83D\uDC8E',
  luxury: '\uD83D\uDC51',
};

const TRIP_TYPE_LABELS: Record<string, string> = {
  leisure: 'Leisure',
  adventure: 'Adventure',
  cultural: 'Cultural',
  romantic: 'Romantic',
  solo: 'Solo',
  family: 'Family',
  business: 'Business',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Store state
  const tripId = useCreateTripStore((s) => s.tripId);
  const name = useCreateTripStore((s) => s.name);
  const description = useCreateTripStore((s) => s.description);
  const startDate = useCreateTripStore((s) => s.startDate);
  const endDate = useCreateTripStore((s) => s.endDate);
  const travelers = useCreateTripStore((s) => s.travelers);
  const kids = useCreateTripStore((s) => s.kids);
  const budget = useCreateTripStore((s) => s.budget);
  const tripType = useCreateTripStore((s) => s.tripType);
  const currency = useCreateTripStore((s) => s.currency);
  const destinations = useCreateTripStore((s) => s.destinations);
  const days = useCreateTripStore((s) => s.days);

  // Store actions
  const setCurrentStep = useCreateTripStore((s) => s.setCurrentStep);
  const setTripId = useCreateTripStore((s) => s.setTripId);
  const setIsSaving = useCreateTripStore((s) => s.setIsSaving);
  const markSaved = useCreateTripStore((s) => s.markSaved);
  const resetTrip = useCreateTripStore((s) => s.resetTrip);
  const isSaving = useCreateTripStore((s) => s.isSaving);

  // Local UI state
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});

  // ─── Derived Values ───

  const totalDays = useMemo(() => {
    return destinations.reduce((sum, d) => sum + (d.duration || 0), 0);
  }, [destinations]);

  const totalActivities = useMemo(() => {
    return days.reduce((sum, day) => sum + (day.activities?.length || 0), 0);
  }, [days]);

  const totalDestinations = destinations.length;

  const tripDuration = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  }, [startDate, endDate]);

  // ─── Handlers ───

  const toggleDay = useCallback((dayIndex: number) => {
    setExpandedDays((prev) => ({ ...prev, [dayIndex]: !prev[dayIndex] }));
  }, []);

  const handleBack = useCallback(() => {
    setCurrentStep(3);
    router.back();
  }, [setCurrentStep, router]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      const tripData = {
        name,
        description,
        startDate,
        endDate,
        travelers,
        kids,
        budget,
        tripType,
        currency,
        destinations: destinations.map((d, i) => ({
          name: d.name,
          country: d.country || '',
          duration: d.duration || 1,
          order: i,
          notes: d.notes || '',
        })),
        days: days.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date,
          title: day.title,
          destinationIndex: day.destinationIndex,
          activities: (day.activities || []).map((act: any, idx: number) => ({
            name: act.name,
            description: act.description || '',
            timeSlot: act.timeSlot || 'morning',
            duration: act.duration || 2,
            rating: act.rating || 0,
            category: act.category || '',
            coordinates: act.coordinates || { lat: 0, lng: 0 },
            image: act.image || '',
            notes: act.notes || '',
            order: idx,
          })),
          notes: day.notes || '',
          transportToNext: day.transportToNext || null,
        })),
        userId: user?.uid || '',
        status: 'draft',
      };

      let response;
      if (tripId) {
        response = await createTripAPI.updateTrip(tripId, tripData);
      } else {
        response = await createTripAPI.createTrip(tripData);
      }

      if (response.success) {
        const savedTripId = response.data?.tripId || response.data?._id || tripId;
        if (savedTripId) {
          setTripId(savedTripId);
        }
        markSaved();

        Toast.show({
          type: 'success',
          text1: tripId ? 'Trip Updated!' : 'Trip Saved!',
          text2: `"${name}" has been saved successfully`,
          position: 'top',
          visibilityTime: 3000,
        });

        // Navigate first, then reset trip state after navigation settles
        setTimeout(() => {
          router.replace('/(tabs)');
          // Reset trip state after navigation completes
          setTimeout(() => {
            resetTrip();
          }, 300);
        }, 1500);
      } else {
        throw new Error(response.message || 'Failed to save trip');
      }
    } catch (err: any) {
      console.error('Save trip failed:', err);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: err.message || 'Could not save your trip. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    tripId,
    name,
    description,
    startDate,
    endDate,
    travelers,
    kids,
    budget,
    tripType,
    currency,
    destinations,
    days,
    user,
    setIsSaving,
    setTripId,
    markSaved,
    resetTrip,
    router,
  ]);

  const handleShare = useCallback(async () => {
    try {
      const destNames = destinations.map((d) => d.name).join(', ');
      const message = `Check out my trip "${name}"!\n\nDestinations: ${destNames}\nDates: ${formatDate(startDate)} - ${formatDate(endDate)}\n${totalDays} days, ${totalActivities} activities planned\n\nPlanned with Prayana AI`;

      await Share.share({
        message,
        title: name,
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  }, [name, destinations, startDate, endDate, totalDays, totalActivities]);

  // ─── Render: Stats Row ───

  const renderStatsRow = () => (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <View style={[styles.statIcon, { backgroundColor: colors.primary[50] }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
        </View>
        <Text style={styles.statValue}>{tripDuration || totalDays}</Text>
        <Text style={styles.statLabel}>Days</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <View style={[styles.statIcon, { backgroundColor: colors.successLight }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
        </View>
        <Text style={styles.statValue}>{totalActivities}</Text>
        <Text style={styles.statLabel}>Activities</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <View style={[styles.statIcon, { backgroundColor: colors.infoLight }]}>
          <Ionicons name="location-outline" size={18} color={colors.info} />
        </View>
        <Text style={styles.statValue}>{totalDestinations}</Text>
        <Text style={styles.statLabel}>Places</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <View style={[styles.statIcon, { backgroundColor: colors.warningLight }]}>
          <Ionicons name="people-outline" size={18} color={colors.warning} />
        </View>
        <Text style={styles.statValue}>{travelers + kids}</Text>
        <Text style={styles.statLabel}>Travelers</Text>
      </View>
    </View>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepIndicator}>Step 4 of 4</Text>
          <Text style={styles.headerTitle}>Review Trip</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={22} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* ── Step Navigation ── */}
      <View style={styles.stepNav}>
        {[
          { step: 1, label: 'Setup', route: '/trip/setup' },
          { step: 2, label: 'Destinations', route: '/trip/destinations' },
          { step: 3, label: 'Planner', route: '/trip/planner' },
          { step: 4, label: 'Review', route: null },
        ].map((item, idx) => {
          const isCurrent = item.step === 4;
          const isCompleted = item.step < 4;
          return (
            <React.Fragment key={item.step}>
              {idx > 0 && (
                <View style={[styles.stepConnector, (isCompleted || isCurrent) && styles.stepConnectorActive]} />
              )}
              <TouchableOpacity
                style={[
                  styles.stepDot,
                  isCompleted && styles.stepDotCompleted,
                  isCurrent && styles.stepDotCurrent,
                ]}
                onPress={() => {
                  if (item.route && item.step !== 4) {
                    setCurrentStep(item.step);
                    if (item.step === 3) {
                      router.back();
                    } else {
                      router.replace(item.route as any);
                    }
                  }
                }}
                disabled={isCurrent}
                activeOpacity={0.7}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={10} color="#ffffff" />
                ) : (
                  <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextCurrent]}>
                    {item.step}
                  </Text>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Trip Summary Card ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="airplane" size={22} color={colors.primary[500]} />
            <Text style={styles.summaryTitle} numberOfLines={2}>
              {name}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.summaryValue}>
              {formatDate(startDate)} - {formatDate(endDate)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.summaryValue}>
              {travelers} {travelers === 1 ? 'Adult' : 'Adults'}
              {kids > 0 ? `, ${kids} ${kids === 1 ? 'Child' : 'Children'}` : ''}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.summaryValue}>
              {BUDGET_EMOJIS[budget] || ''} {BUDGET_LABELS[budget] || budget}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="compass-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.summaryValue}>
              {TRIP_TYPE_LABELS[tripType] || tripType}
            </Text>
          </View>
        </View>

        {/* ── Stats Row ── */}
        {renderStatsRow()}

        {/* ── Destinations List ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Destinations</Text>
          {destinations.map((dest, index) => (
            <View key={`${dest.name}-${index}`} style={styles.destItem}>
              <View style={styles.destOrderBadge}>
                <Text style={styles.destOrderText}>{index + 1}</Text>
              </View>
              <View style={styles.destItemInfo}>
                <Text style={styles.destItemName}>{dest.name}</Text>
                <Text style={styles.destItemMeta}>
                  {dest.country ? `${dest.country} - ` : ''}
                  {dest.duration || 1} {(dest.duration || 1) === 1 ? 'day' : 'days'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Day-by-Day Summary ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Itinerary</Text>
          {days.map((day, dayIndex) => {
            const actCount = day.activities?.length || 0;
            const isExpanded = expandedDays[dayIndex];
            const activities = day.activities || [];

            return (
              <View key={dayIndex} style={styles.dayCard}>
                <TouchableOpacity
                  style={styles.dayCardHeader}
                  onPress={() => toggleDay(dayIndex)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayCardLeft}>
                    <View style={styles.dayNumberBadge}>
                      <Text style={styles.dayNumberText}>{day.dayNumber}</Text>
                    </View>
                    <View>
                      <Text style={styles.dayCardTitle}>{day.title}</Text>
                      {day.date ? (
                        <Text style={styles.dayCardDate}>{formatDateShort(day.date)}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.dayCardRight}>
                    <View style={styles.actCountBadge}>
                      <Text style={styles.actCountText}>
                        {actCount} {actCount === 1 ? 'activity' : 'activities'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textTertiary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayCardBody}>
                    {activities.length === 0 ? (
                      <Text style={styles.dayCardEmpty}>No activities planned for this day</Text>
                    ) : (
                      activities.map((act: any, actIdx: number) => (
                        <View key={actIdx} style={styles.activityListItem}>
                          <View style={styles.activityListDot} />
                          <View style={styles.activityListContent}>
                            <Text style={styles.activityListName}>{act.name}</Text>
                            <View style={styles.activityListMeta}>
                              <Text style={styles.activityListSlot}>
                                {act.timeSlot === 'morning'
                                  ? '\u2600\uFE0F Morning'
                                  : act.timeSlot === 'afternoon'
                                  ? '\u2601\uFE0F Afternoon'
                                  : act.timeSlot === 'evening'
                                  ? '\uD83C\uDF19 Evening'
                                  : '\u2B50 Night'}
                              </Text>
                              {act.duration ? (
                                <Text style={styles.activityListDuration}>{act.duration}h</Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Bottom spacer for buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={20} color={colors.primary[500]} />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.saveButtonText}>Saving...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {tripId ? 'Update Trip' : 'Save Trip'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  shareButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },

  // Step Navigation
  stepNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[200],
  },
  stepDotCompleted: {
    backgroundColor: '#06B6D4',
  },
  stepDotCurrent: {
    backgroundColor: '#06B6D4',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
  },
  stepDotTextCurrent: {
    color: '#ffffff',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    maxWidth: 50,
  },
  stepConnectorActive: {
    backgroundColor: '#06B6D4',
  },

  // Scroll Content
  scrollContent: {
    padding: spacing.lg,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  summaryTitle: {
    flex: 1,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    flex: 1,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.gray[200],
  },

  // Sections
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Destination Items
  destItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  destOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  destOrderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  destItemInfo: {
    flex: 1,
  },
  destItemName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  destItemMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },

  // Day Card
  dayCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  dayCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  dayNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  dayCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dayCardDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  dayCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  actCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },

  // Day Card Body
  dayCardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingTop: spacing.md,
  },
  dayCardEmpty: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },

  // Activity List Item
  activityListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  activityListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[400],
    marginTop: 6,
  },
  activityListContent: {
    flex: 1,
  },
  activityListName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  activityListMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  activityListSlot: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  activityListDuration: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing['2xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  shareBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadow.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
});
