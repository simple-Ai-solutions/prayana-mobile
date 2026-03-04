import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, fontWeight, shadow, borderRadius } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl } from '@prayana/shared-utils';
import type { ParsedItinerary } from '../../utils/markdownParser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Color configs per time slot — matching web
interface TimeSlotStyle {
  bg: string; text: string; dot: string;
  iconBg: [string, string]; icon: string; label: string;
}

const TIME_SLOT_CONFIG: Record<string, TimeSlotStyle> = {
  Morning: {
    bg: '#FFF7ED', text: '#EA580C', dot: '#F59E0B',
    iconBg: ['#F59E0B', '#FB923C'], icon: 'sunny', label: 'Morning',
  },
  Afternoon: {
    bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6',
    iconBg: ['#3B82F6', '#06B6D4'], icon: 'partly-sunny', label: 'Afternoon',
  },
  Evening: {
    bg: '#F5F3FF', text: '#7C3AED', dot: '#8B5CF6',
    iconBg: ['#8B5CF6', '#6366F1'], icon: 'moon', label: 'Evening',
  },
  Night: {
    bg: '#EEF2FF', text: '#4338CA', dot: '#6366F1',
    iconBg: ['#6366F1', '#4338CA'], icon: 'moon-outline', label: 'Night',
  },
  Lunch: {
    bg: '#FFF1F2', text: '#E11D48', dot: '#FB7185',
    iconBg: ['#FB7185', '#F43F5E'], icon: 'restaurant', label: 'Lunch',
  },
  Activities: {
    bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E',
    iconBg: ['#22C55E', '#10B981'], icon: 'compass', label: 'Activities',
  },
  Highlights: {
    bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B',
    iconBg: ['#F59E0B', '#EAB308'], icon: 'star', label: 'Highlights',
  },
};

const DEFAULT_TIME_SLOT: TimeSlotStyle = {
  bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E',
  iconBg: ['#22C55E', '#10B981'], icon: 'compass', label: 'Activities',
};

// Tip card colors per category — matching web
const TIP_STYLES: Record<string, { bg: string; border: string; dot: string; iconBg: [string, string] }> = {
  'transportation': { bg: '#ECFEFF', border: '#06B6D4', dot: '#06B6D4', iconBg: ['#06B6D4', '#14B8A6'] },
  'getting around': { bg: '#ECFEFF', border: '#06B6D4', dot: '#06B6D4', iconBg: ['#06B6D4', '#14B8A6'] },
  'accommodation': { bg: '#FDF2F8', border: '#EC4899', dot: '#EC4899', iconBg: ['#EC4899', '#F43F5E'] },
  'where to stay': { bg: '#FDF2F8', border: '#EC4899', dot: '#EC4899', iconBg: ['#EC4899', '#F43F5E'] },
  'food': { bg: '#FFF7ED', border: '#F97316', dot: '#F97316', iconBg: ['#F97316', '#EF4444'] },
  'food recommendations': { bg: '#FFF7ED', border: '#F97316', dot: '#F97316', iconBg: ['#F97316', '#EF4444'] },
  'local cuisine': { bg: '#FFF7ED', border: '#F97316', dot: '#F97316', iconBg: ['#F97316', '#EF4444'] },
  'what to pack': { bg: '#FEFCE8', border: '#EAB308', dot: '#EAB308', iconBg: ['#EAB308', '#F59E0B'] },
  'packing': { bg: '#FEFCE8', border: '#EAB308', dot: '#EAB308', iconBg: ['#EAB308', '#F59E0B'] },
  'budget': { bg: '#F0FDF4', border: '#22C55E', dot: '#22C55E', iconBg: ['#22C55E', '#10B981'] },
  'budget tips': { bg: '#F0FDF4', border: '#22C55E', dot: '#22C55E', iconBg: ['#22C55E', '#10B981'] },
  'safety': { bg: '#FEF2F2', border: '#EF4444', dot: '#EF4444', iconBg: ['#EF4444', '#F43F5E'] },
  'safety tips': { bg: '#FEF2F2', border: '#EF4444', dot: '#EF4444', iconBg: ['#EF4444', '#F43F5E'] },
  'cultural tips': { bg: '#F5F3FF', border: '#8B5CF6', dot: '#8B5CF6', iconBg: ['#8B5CF6', '#6366F1'] },
  'culture': { bg: '#F5F3FF', border: '#8B5CF6', dot: '#8B5CF6', iconBg: ['#8B5CF6', '#6366F1'] },
  'pro tips': { bg: '#EFF6FF', border: '#3B82F6', dot: '#3B82F6', iconBg: ['#3B82F6', '#6366F1'] },
  'important notes': { bg: '#EFF6FF', border: '#3B82F6', dot: '#3B82F6', iconBg: ['#3B82F6', '#6366F1'] },
};

const DEFAULT_TIP_STYLE = { bg: '#F0FDF4', border: '#14B8A6', dot: '#14B8A6', iconBg: ['#14B8A6', '#06B6D4'] as [string, string] };

function getTipStyle(category: string) {
  const lower = category.toLowerCase().trim();
  for (const [key, style] of Object.entries(TIP_STYLES)) {
    if (lower.includes(key)) return style;
  }
  return DEFAULT_TIP_STYLE;
}

// Meta info card configs
const META_CARDS: Array<{
  key: keyof ParsedItinerary['meta'];
  emoji: string;
  label: string;
  gradient: [string, string];
}> = [
  { key: 'bestTime', emoji: '\u2B50', label: 'Best Time', gradient: ['#FF6B6B', '#F97316'] },
  { key: 'duration', emoji: '\uD83D\uDCC5', label: 'Duration', gradient: ['#3B82F6', '#06B6D4'] },
  { key: 'budget', emoji: '\uD83D\uDCB0', label: 'Budget', gradient: ['#EC4899', '#F43F5E'] },
  { key: 'transport', emoji: '\uD83D\uDE97', label: 'Transport', gradient: ['#14B8A6', '#06B6D4'] },
];

const DAY_COLORS = ['#FF6B6B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

interface MarkdownItineraryViewProps {
  parsed: ParsedItinerary;
  destination: string;
  duration: string;
  transportMode: string;
}

export const MarkdownItineraryView: React.FC<MarkdownItineraryViewProps> = ({
  parsed,
  destination,
  duration,
  transportMode,
}) => {
  const router = useRouter();
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [dayImages, setDayImages] = useState<Record<number, string>>({});

  // Fetch hero images for each day using direct API call
  useEffect(() => {
    if (!parsed.days.length) return;
    let cancelled = false;

    const fetchDayImages = async () => {
      for (let i = 0; i < parsed.days.length; i += 2) {
        if (cancelled) break;
        const batch = parsed.days.slice(i, i + 2);
        const results = await Promise.allSettled(
          batch.map((day) => {
            const firstActivity = day.sections[0]?.activities[0]?.name || day.title;
            const searchTerm = firstActivity || destination;
            return makeAPICall('/destinations/place-images', {
              method: 'POST',
              body: JSON.stringify({
                placeName: searchTerm,
                location: destination,
                count: 1,
              }),
              timeout: 15000,
            });
          })
        );

        const newImages: Record<number, string> = {};
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const res = result.value;
            const data = res?.data || res;
            const imgArr = Array.isArray(data) ? data : [];
            if (imgArr.length > 0) {
              const imgData = imgArr[0];
              const rawUrl = typeof imgData === 'string'
                ? imgData
                : imgData?.url || imgData?.imageUrl || imgData?.s3Url || imgData?.originalUrl || null;
              const resolved = resolveImageUrl(rawUrl);
              if (resolved) {
                newImages[batch[idx].dayNumber] = resolved;
              }
            }
          }
        });

        if (!cancelled && Object.keys(newImages).length > 0) {
          setDayImages((prev) => ({ ...prev, ...newImages }));
        }

        if (i + 2 < parsed.days.length) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    };

    fetchDayImages();
    return () => { cancelled = true; };
  }, [parsed.days, destination]);

  const toggleDay = useCallback((dayNumber: number) => {
    setExpandedDays((prev) => ({ ...prev, [dayNumber]: !prev[dayNumber] }));
  }, []);

  const expandAll = useCallback(() => {
    const all: Record<number, boolean> = {};
    parsed.days.forEach((d) => { all[d.dayNumber] = true; });
    setExpandedDays(all);
  }, [parsed.days]);

  const collapseAll = useCallback(() => {
    setExpandedDays({});
  }, []);

  // Navigate to destination detail page on activity press
  const handleActivityPress = useCallback((activityName: string) => {
    const preview = JSON.stringify({
      name: activityName,
      category: '',
      rating: null,
      shortDescription: '',
      image: '',
      duration: '',
    });

    router.push({
      pathname: '/destination/[location]/[place]',
      params: {
        location: encodeURIComponent(destination),
        place: encodeURIComponent(activityName),
        preview,
      },
    });
  }, [router, destination]);

  const transportLabel = transportMode === 'car' ? 'By Car/Bus' : transportMode === 'bike' ? 'By Bike' : 'By Flight';
  const allExpanded = parsed.days.length > 0 && parsed.days.every((d) => expandedDays[d.dayNumber]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Hero Section */}
      <LinearGradient
        colors={['#FF6B6B', '#ee5a5a', '#cc4444']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>{parsed.title || `${destination} Travel Guide`}</Text>
          <Text style={styles.heroSubtitle}>
            {transportLabel} {'\u2022'} {duration} {Number(duration) === 1 ? 'Day' : 'Days'}
          </Text>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#FF6B6B" />
            <Text style={styles.heroBadgeText}>AI-Generated Guide</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Meta Info Cards — Horizontal scroll like web */}
      {Object.keys(parsed.meta).length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metaCardsRow}
          style={styles.metaCardsScroll}
        >
          {META_CARDS.map((card) => {
            const value = parsed.meta[card.key];
            if (!value) return null;
            return (
              <View key={card.key} style={[styles.metaCard, shadow.sm]}>
                <LinearGradient
                  colors={card.gradient}
                  style={styles.metaCardIcon}
                >
                  <Text style={styles.metaCardEmoji}>{card.emoji}</Text>
                </LinearGradient>
                <Text style={styles.metaCardLabel}>{card.label}</Text>
                <Text style={styles.metaCardValue} numberOfLines={2}>{value}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Overview / About */}
      {parsed.overview ? (
        <View style={[styles.overviewCard, shadow.sm]}>
          <View style={styles.overviewHeader}>
            <LinearGradient colors={['#8B5CF6', '#6366F1']} style={styles.overviewIcon}>
              <Ionicons name="information-circle" size={16} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.overviewTitle}>About {destination}</Text>
          </View>
          <Text style={styles.overviewText}>
            {parsed.overview.replace(/\*\*/g, '').substring(0, 400)}
          </Text>
        </View>
      ) : null}

      {/* Expand/Collapse All */}
      {parsed.days.length > 1 && (
        <TouchableOpacity
          style={styles.expandAllButton}
          onPress={allExpanded ? collapseAll : expandAll}
          activeOpacity={0.7}
        >
          <Ionicons
            name={allExpanded ? 'contract-outline' : 'expand-outline'}
            size={16}
            color="#FF6B6B"
          />
          <Text style={styles.expandAllText}>
            {allExpanded ? 'Collapse All' : 'Expand All Days'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Day Cards */}
      {parsed.days.map((day) => {
        const isExpanded = expandedDays[day.dayNumber] ?? false;
        const dayColor = DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length];
        const heroImage = dayImages[day.dayNumber];
        const totalActivities = day.sections.reduce((sum, s) => sum + s.activities.length, 0);

        return (
          <View key={day.dayNumber} style={[styles.dayCard, shadow.md]}>
            {/* Day Header — always shows badge */}
            <TouchableOpacity
              style={styles.dayHeader}
              onPress={() => toggleDay(day.dayNumber)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[dayColor, dayColor + 'CC']}
                style={styles.dayBadge}
              >
                <Text style={styles.dayBadgeText}>{day.dayNumber}</Text>
              </LinearGradient>
              <View style={styles.dayHeaderText}>
                <Text style={styles.dayTitle} numberOfLines={1}>
                  Day {day.dayNumber}: {day.title || 'Explore'}
                </Text>
                <View style={styles.dayHeaderMeta}>
                  <View style={styles.dayMetaItem}>
                    <Ionicons name="compass-outline" size={12} color={dayColor} />
                    <Text style={[styles.dayMetaText, { color: dayColor }]}>
                      {totalActivities} activities
                    </Text>
                  </View>
                  <View style={styles.dayMetaItem}>
                    <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                    <Text style={styles.dayMetaTextLight}>
                      {day.sections.length} {day.sections.length === 1 ? 'session' : 'sessions'}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Day Content (Collapsible) — image now inside expanded area */}
            {isExpanded && (
              <View style={styles.dayContent}>
                {/* Hero Image — shown on expansion */}
                {heroImage && (
                  <View style={styles.dayImageContainer}>
                    <Image source={{ uri: heroImage }} style={styles.dayImage} resizeMode="cover" />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)']}
                      style={styles.dayImageGradient}
                    />
                  </View>
                )}

                {day.sections.length > 0 ? (
                  day.sections.map((section, sIndex) => {
                    const config = TIME_SLOT_CONFIG[section.timeSlot] || DEFAULT_TIME_SLOT;

                    return (
                      <View key={`${day.dayNumber}-${sIndex}`} style={styles.timeSection}>
                        {/* Time Slot Header */}
                        <View style={[styles.timeSlotHeader, { backgroundColor: config.bg }]}>
                          <LinearGradient
                            colors={config.iconBg}
                            style={styles.timeSlotIcon}
                          >
                            <Ionicons name={config.icon as any} size={12} color="#ffffff" />
                          </LinearGradient>
                          <Text style={[styles.timeSlotLabel, { color: config.text }]}>
                            {TIME_SLOT_CONFIG[section.timeSlot] ? config.label : section.timeSlot}
                          </Text>
                          <View style={[styles.timeSlotCount, { backgroundColor: config.dot + '20' }]}>
                            <Text style={[styles.timeSlotCountText, { color: config.dot }]}>
                              {section.activities.length}
                            </Text>
                          </View>
                        </View>

                        {/* Activities — tappable to open destination detail */}
                        {section.activities.map((activity, aIndex) => (
                          <TouchableOpacity
                            key={`${day.dayNumber}-${sIndex}-${aIndex}`}
                            style={styles.activityItem}
                            activeOpacity={0.7}
                            onPress={() => handleActivityPress(activity.name)}
                          >
                            <View style={[styles.activityDot, { backgroundColor: config.dot }]}>
                              <Ionicons name="location" size={8} color="#ffffff" />
                            </View>
                            <View style={styles.activityContent}>
                              <View style={styles.activityNameRow}>
                                <Text style={styles.activityName} numberOfLines={1}>{activity.name}</Text>
                                <Ionicons name="chevron-forward" size={14} color={colors.gray[400]} />
                              </View>
                              {activity.description ? (
                                <Text style={styles.activityDescription} numberOfLines={3}>
                                  {activity.description}
                                </Text>
                              ) : null}
                              {(activity.duration || activity.cost) && (
                                <View style={styles.activityBadges}>
                                  {activity.duration && (
                                    <View style={[styles.activityBadge, { backgroundColor: config.bg }]}>
                                      <Ionicons name="time-outline" size={11} color={config.text} />
                                      <Text style={[styles.activityBadgeText, { color: config.text }]}>
                                        {activity.duration}
                                      </Text>
                                    </View>
                                  )}
                                  {activity.cost && (
                                    <View style={[styles.activityBadge, { backgroundColor: '#F0FDF4' }]}>
                                      <Ionicons name="cash-outline" size={11} color="#16A34A" />
                                      <Text style={[styles.activityBadgeText, { color: '#16A34A' }]}>
                                        {activity.cost}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })
                ) : (
                  /* Fallback: show raw content if no activities parsed */
                  <View style={styles.rawContentFallback}>
                    <Text style={styles.rawContentText}>
                      {day.rawContent
                        .replace(/^.*\n/, '')
                        .replace(/\*\*/g, '')
                        .replace(/^###?\s+/gm, '')
                        .replace(/^[-*]\s+/gm, '\u2022 ')
                        .replace(/^\d+[.)]\s+/gm, '\u2022 ')
                        .trim()
                        .substring(0, 1000)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Travel Tips */}
      {parsed.tips.length > 0 && (
        <View style={styles.tipsSection}>
          <View style={styles.tipsSectionHeader}>
            <LinearGradient colors={['#14B8A6', '#06B6D4']} style={styles.tipsSectionIcon}>
              <Ionicons name="bulb" size={18} color="#ffffff" />
            </LinearGradient>
            <View>
              <Text style={styles.tipsSectionTitle}>Essential Travel Tips</Text>
              <Text style={styles.tipsSectionSubtitle}>Everything you need to know</Text>
            </View>
          </View>

          {parsed.tips.map((tip, tIndex) => {
            const tipStyle = getTipStyle(tip.category);

            return (
              <View
                key={`tip-${tIndex}`}
                style={[
                  styles.tipCard,
                  shadow.sm,
                  { backgroundColor: tipStyle.bg, borderLeftColor: tipStyle.border },
                ]}
              >
                <View style={styles.tipCardHeader}>
                  <LinearGradient
                    colors={tipStyle.iconBg}
                    style={styles.tipCardIcon}
                  >
                    <Text style={styles.tipEmoji}>{tip.emoji}</Text>
                  </LinearGradient>
                  <Text style={styles.tipCategory}>{tip.category}</Text>
                </View>
                {tip.items.map((item, iIndex) => (
                  <View key={`tip-${tIndex}-${iIndex}`} style={styles.tipItem}>
                    <View style={[styles.tipBulletDot, { backgroundColor: tipStyle.dot }]} />
                    <Text style={styles.tipItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing['2xl'],
  },

  // Hero
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  heroContent: {},
  heroTitle: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.xs,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#FF6B6B',
  },

  // Meta Info Cards
  metaCardsScroll: {
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
  metaCardsRow: {
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  metaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    width: 140,
    alignItems: 'center',
  },
  metaCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metaCardEmoji: {
    fontSize: 16,
  },
  metaCardLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaCardValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Overview
  overviewCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 14,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm,
  },
  overviewIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  overviewText: {
    fontSize: fontSize.sm,
    color: '#4B5563',
    lineHeight: 22,
  },

  // Expand All
  expandAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  expandAllText: {
    fontSize: fontSize.xs,
    color: '#FF6B6B',
    fontWeight: fontWeight.semibold,
  },

  // Day Card
  dayCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  dayImageContainer: {
    height: 160,
    position: 'relative',
    marginBottom: spacing.md,
    borderRadius: 12,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  dayImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  dayImageGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  dayHeaderText: {
    flex: 1,
  },
  dayTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#111827',
  },
  dayHeaderMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dayMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dayMetaText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  dayMetaTextLight: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Day Content
  dayContent: {
    paddingBottom: spacing.lg,
  },

  // Time Section
  timeSection: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  timeSlotIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    flex: 1,
  },
  timeSlotCount: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },

  // Activity
  activityItem: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 14,
  },
  activityDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  activityName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#111827',
    flex: 1,
  },
  activityDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 6,
  },
  activityBadges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },

  // Tips Section
  tipsSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  tipsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.lg,
  },
  tipsSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#111827',
  },
  tipsSectionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  tipCard: {
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  tipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tipCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipEmoji: {
    fontSize: 14,
  },
  tipCategory: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#111827',
  },
  tipItem: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  tipBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 10,
  },
  tipItemText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },

  // Raw content fallback
  rawContentFallback: {
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  rawContentText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 22,
  },
});

export default MarkdownItineraryView;
