import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  shadow,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { getInterestData, type InterestPlace, type InterestSection } from '../../data/interestData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 180;
const SECONDARY_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

// ============================================================
// MAIN SCREEN
// ============================================================
export default function InterestBrowseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { themeColors, isDarkMode } = useTheme();

  const data = useMemo(() => getInterestData(id || ''), [id]);

  if (!data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.gray[400]} />
          <Text style={[styles.errorText, { color: themeColors.text }]}>Collection not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { category, hero, whyVisit, sections, travelTips, seasonGuide } = data;

  const handlePlacePress = (place: InterestPlace) => {
    const query = place.searchQuery || place.name;
    const params = new URLSearchParams();
    if (place.image) params.set('previewImage', place.image);
    if (place.description) params.set('previewDesc', place.description);
    const qs = params.toString();
    router.push(`/destination/${encodeURIComponent(query)}${qs ? '?' + qs : ''}` as any);
  };

  // ============================================================
  // RENDER: HEADER BAR
  // ============================================================
  const renderHeader = () => (
    <View style={[styles.headerBar, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={24} color={themeColors.text} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerEmoji}>{category.icon}</Text>
        <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
          {category.title}
        </Text>
      </View>
      <View style={{ width: 24 }} />
    </View>
  );

  // ============================================================
  // RENDER: HERO SECTION
  // ============================================================
  const renderHero = () => (
    <View style={styles.heroSection}>
      {/* Featured Image */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => handlePlacePress(hero.featured)}>
        <View style={styles.heroFeaturedContainer}>
          <Image
            source={{ uri: hero.featured.image }}
            style={styles.heroFeaturedImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            priority="high"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroFeaturedOverlay}
          >
            <View style={styles.heroFeaturedContent}>
              <View style={styles.heroRatingBadge}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={styles.heroRatingText}>{hero.featured.rating}</Text>
              </View>
              <Text style={styles.heroFeaturedName}>{hero.featured.name}</Text>
              <Text style={styles.heroFeaturedLocation}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.8)" />
                {' '}{hero.featured.location}
              </Text>
              {hero.featured.tagline && (
                <Text style={styles.heroTagline}>{hero.featured.tagline}</Text>
              )}
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>

      {/* Secondary Images Row */}
      <View style={styles.heroSecondaryRow}>
        {hero.secondary.slice(0, 2).map((place) => (
          <TouchableOpacity
            key={place.id}
            activeOpacity={0.9}
            style={styles.heroSecondaryCard}
            onPress={() => handlePlacePress(place)}
          >
            <Image
              source={{ uri: place.image }}
              style={styles.heroSecondaryImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.heroSecondaryOverlay}
            >
              <Text style={styles.heroSecondaryName}>{place.name}</Text>
              <Text style={styles.heroSecondaryLoc}>{place.location}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Description */}
      <View style={[styles.heroDescContainer, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.heroDescTitle, { color: themeColors.text }]}>
          {category.heroTitle}{' '}
          <Text style={{ color: colors.primary[500] }}>{category.heroHighlight}</Text>
        </Text>
        <Text style={[styles.heroDescText, { color: themeColors.textSecondary }]}>
          {category.description}
        </Text>
      </View>
    </View>
  );

  // ============================================================
  // RENDER: WHY VISIT SECTION
  // ============================================================
  const renderWhyVisit = () => (
    <View style={[styles.whyVisitSection, { backgroundColor: isDarkMode ? colors.gray[900] : colors.primary[50] }]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{whyVisit.title}</Text>
      <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>{whyVisit.subtitle}</Text>
      <View style={styles.reasonsGrid}>
        {whyVisit.reasons.map((reason, idx) => (
          <View
            key={idx}
            style={[styles.reasonCard, {
              backgroundColor: isDarkMode ? colors.gray[800] : '#ffffff',
              ...shadow.sm,
            }]}
          >
            <Text style={styles.reasonIcon}>{reason.icon}</Text>
            <Text style={[styles.reasonTitle, { color: themeColors.text }]}>{reason.title}</Text>
            <Text style={[styles.reasonDesc, { color: themeColors.textSecondary }]} numberOfLines={3}>
              {reason.description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ============================================================
  // RENDER: DESTINATION CARD
  // ============================================================
  const renderDestinationCard = (place: InterestPlace, index: number) => (
    <TouchableOpacity
      key={place.id}
      style={[styles.destCard, { backgroundColor: themeColors.surface, ...shadow.sm }]}
      onPress={() => handlePlacePress(place)}
      activeOpacity={0.85}
    >
      <View style={styles.destImageContainer}>
        <Image
          source={{ uri: place.image }}
          style={styles.destImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={styles.destImageOverlay}
        />
        {/* Rank badge for first section */}
        {index < 3 && (
          <View style={[styles.rankBadge, {
            backgroundColor: index === 0 ? '#FBBF24' : index === 1 ? '#94A3B8' : '#D97706',
          }]}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}
        {/* Rating */}
        <View style={styles.destRatingBadge}>
          <Ionicons name="star" size={10} color="#FBBF24" />
          <Text style={styles.destRatingText}>{place.rating}</Text>
        </View>
      </View>
      <View style={styles.destContent}>
        <Text style={[styles.destName, { color: themeColors.text }]} numberOfLines={1}>{place.name}</Text>
        <Text style={[styles.destLocation, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {place.location}
        </Text>
        {place.stats && (
          <View style={styles.destStats}>
            {place.stats.idealDays && (
              <View style={styles.destStatItem}>
                <Ionicons name="time-outline" size={10} color={colors.primary[500]} />
                <Text style={[styles.destStatText, { color: themeColors.textTertiary }]}>{place.stats.idealDays}</Text>
              </View>
            )}
            {place.stats.bestTime && (
              <View style={styles.destStatItem}>
                <Ionicons name="calendar-outline" size={10} color={colors.primary[500]} />
                <Text style={[styles.destStatText, { color: themeColors.textTertiary }]}>{place.stats.bestTime}</Text>
              </View>
            )}
          </View>
        )}
        {place.highlights && place.highlights.length > 0 && (
          <View style={styles.destHighlights}>
            {place.highlights.slice(0, 2).map((h) => (
              <View key={h} style={[styles.highlightTag, { backgroundColor: isDarkMode ? colors.gray[700] : colors.primary[50] }]}>
                <Text style={[styles.highlightText, { color: isDarkMode ? colors.primary[300] : colors.primary[700] }]} numberOfLines={1}>{h}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // ============================================================
  // RENDER: COLLECTION SECTION
  // ============================================================
  const renderCollectionSection = (section: InterestSection, sectionIdx: number) => (
    <View key={section.id} style={styles.collectionSection}>
      <View style={styles.collectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{section.title}</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>{section.subtitle}</Text>
        </View>
      </View>
      <FlatList
        horizontal
        data={section.places}
        renderItem={({ item, index }) => renderDestinationCard(item, sectionIdx === 0 ? index : -1)}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.collectionScroll}
        snapToInterval={CARD_WIDTH + spacing.md}
        decelerationRate="fast"
      />
    </View>
  );

  // ============================================================
  // RENDER: SEASON GUIDE
  // ============================================================
  const SEASON_COLORS = [
    ['#06B6D4', '#0891b2'],
    ['#F59E0B', '#D97706'],
    ['#22c55e', '#15803d'],
    ['#EC4899', '#DB2777'],
  ];

  const renderSeasonGuide = () => (
    <View style={[styles.seasonSection, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{seasonGuide.title}</Text>
      <View style={styles.seasonGrid}>
        {seasonGuide.seasons.map((season, idx) => (
          <View
            key={idx}
            style={[styles.seasonCard, {
              backgroundColor: isDarkMode ? colors.gray[800] : '#ffffff',
              ...shadow.sm,
            }]}
          >
            <LinearGradient
              colors={SEASON_COLORS[idx % SEASON_COLORS.length] as [string, string]}
              style={styles.seasonCardHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.seasonIcon}>{season.icon}</Text>
              <Text style={styles.seasonName}>{season.name}</Text>
            </LinearGradient>
            <View style={styles.seasonCardBody}>
              <Text style={[styles.seasonDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                {season.description}
              </Text>
              {season.bestFor && season.bestFor.length > 0 && (
                <View style={styles.seasonBestFor}>
                  <Text style={[styles.seasonBestForLabel, { color: themeColors.textTertiary }]}>Best for:</Text>
                  <View style={styles.seasonPlaces}>
                    {season.bestFor.slice(0, 3).map((place) => (
                      <TouchableOpacity
                        key={place}
                        style={[styles.seasonPlaceTag, { backgroundColor: isDarkMode ? colors.gray[700] : colors.primary[50] }]}
                        onPress={() => router.push(`/destination/${encodeURIComponent(place)}` as any)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.seasonPlaceText, { color: isDarkMode ? colors.primary[300] : colors.primary[700] }]} numberOfLines={1}>
                          {place}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  // ============================================================
  // RENDER: TRAVEL TIPS
  // ============================================================
  const renderTravelTips = () => (
    <View style={[styles.tipsSection, { backgroundColor: isDarkMode ? colors.gray[900] : colors.primary[50] }]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{travelTips.title}</Text>
      <View style={styles.tipsList}>
        {travelTips.tips.map((tip, idx) => (
          <View
            key={idx}
            style={[styles.tipCard, {
              backgroundColor: isDarkMode ? colors.gray[800] : '#ffffff',
              ...shadow.sm,
            }]}
          >
            <View style={[styles.tipIconCircle, { backgroundColor: isDarkMode ? colors.gray[700] : colors.primary[50] }]}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={[styles.tipTitle, { color: themeColors.text }]}>{tip.title}</Text>
              <Text style={[styles.tipDesc, { color: themeColors.textSecondary }]} numberOfLines={3}>{tip.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {renderHeader()}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderHero()}
        {renderWhyVisit()}
        {sections.map((section, idx) => renderCollectionSection(section, idx))}
        {renderSeasonGuide()}
        {renderTravelTips()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Error
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  errorBtn: { backgroundColor: colors.primary[500], paddingHorizontal: 24, paddingVertical: 12, borderRadius: borderRadius.lg },
  errorBtnText: { color: '#fff', fontWeight: fontWeight.semibold, fontSize: fontSize.md },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  // Hero
  heroSection: { paddingBottom: spacing.lg },
  heroFeaturedContainer: { width: SCREEN_WIDTH, height: 240, position: 'relative' },
  heroFeaturedImage: { width: '100%', height: '100%' },
  heroFeaturedOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', justifyContent: 'flex-end', padding: spacing.lg },
  heroFeaturedContent: {},
  heroRatingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginBottom: 6 },
  heroRatingText: { color: '#fff', fontSize: 12, fontWeight: fontWeight.bold },
  heroFeaturedName: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  heroFeaturedLocation: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, marginTop: 2 },
  heroTagline: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, fontStyle: 'italic', marginTop: 4 },

  heroSecondaryRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.md },
  heroSecondaryCard: { width: SECONDARY_WIDTH, height: 130, borderRadius: borderRadius.lg, overflow: 'hidden', position: 'relative' },
  heroSecondaryImage: { width: '100%', height: '100%' },
  heroSecondaryOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', justifyContent: 'flex-end', padding: spacing.md },
  heroSecondaryName: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  heroSecondaryLoc: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.xs, marginTop: 1 },

  heroDescContainer: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: borderRadius.xl },
  heroDescTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  heroDescText: { fontSize: fontSize.sm, lineHeight: 22 },

  // Why Visit
  whyVisitSection: { paddingHorizontal: spacing.xl, paddingVertical: spacing['2xl'], marginTop: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 4 },
  sectionSubtitle: { fontSize: fontSize.sm, marginBottom: spacing.lg },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  reasonCard: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  reasonIcon: { fontSize: 28, marginBottom: spacing.sm },
  reasonTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center', marginBottom: 4 },
  reasonDesc: { fontSize: fontSize.xs, textAlign: 'center', lineHeight: 16 },

  // Collection Section
  collectionSection: { marginTop: spacing['2xl'] },
  collectionHeader: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  collectionScroll: { paddingHorizontal: spacing.xl, gap: spacing.md },

  // Destination Card
  destCard: { width: CARD_WIDTH, borderRadius: borderRadius.lg, overflow: 'hidden' },
  destImageContainer: { width: '100%', height: 120, position: 'relative' },
  destImage: { width: '100%', height: '100%' },
  destImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  rankBadge: { position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },
  destRatingBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  destRatingText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },
  destContent: { padding: spacing.md },
  destName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  destLocation: { fontSize: fontSize.xs, marginTop: 2 },
  destStats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  destStatItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  destStatText: { fontSize: 10 },
  destHighlights: { flexDirection: 'row', gap: 4, marginTop: spacing.sm, flexWrap: 'wrap' },
  highlightTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  highlightText: { fontSize: 9, fontWeight: fontWeight.medium },

  // Season Guide
  seasonSection: { paddingHorizontal: spacing.xl, paddingVertical: spacing['2xl'] },
  seasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  seasonCard: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  seasonCardHeader: { padding: spacing.md },
  seasonIcon: { fontSize: 22, marginBottom: 4 },
  seasonName: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  seasonCardBody: { padding: spacing.md },
  seasonDesc: { fontSize: fontSize.xs, lineHeight: 16, marginBottom: spacing.sm },
  seasonBestFor: {},
  seasonBestForLabel: { fontSize: 10, fontWeight: fontWeight.medium, marginBottom: 4 },
  seasonPlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  seasonPlaceTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  seasonPlaceText: { fontSize: 10, fontWeight: fontWeight.medium },

  // Travel Tips
  tipsSection: { paddingHorizontal: spacing.xl, paddingVertical: spacing['2xl'], marginTop: spacing.md },
  tipsList: { gap: spacing.md },
  tipCard: { flexDirection: 'row', padding: spacing.lg, borderRadius: borderRadius.lg, gap: spacing.md, alignItems: 'flex-start' },
  tipIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tipIcon: { fontSize: 22 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: 4 },
  tipDesc: { fontSize: fontSize.xs, lineHeight: 18 },
});
