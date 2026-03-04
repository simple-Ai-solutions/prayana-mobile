import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, shadow, useTheme } from '@prayana/shared-ui';
import { getPlaceImageUrl } from '@prayana/shared-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;
const AUTO_ADVANCE_INTERVAL = 5000;

interface HeroCarouselProps {
  places: any[];
  hero: {
    collectionTitle: string;
    tagline: string;
    stats: {
      totalSites: number;
      circuits: number;
      hiddenGems: number;
      avgRating: number;
    };
  };
  locationName: string;
  onPlacePress?: (place: any) => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  places,
  hero,
  locationName,
  onPlacePress,
}) => {
  const { isDarkMode, themeColors } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);

  const topPlaces = places.slice(0, 5);
  const slideCount = topPlaces.length || 1;

  // Auto-advance slides
  useEffect(() => {
    if (slideCount <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, AUTO_ADVANCE_INTERVAL);

    return () => clearInterval(interval);
  }, [slideCount]);

  const handleDotPress = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const currentPlace = topPlaces[currentSlide];
  const imageUrl = currentPlace ? getPlaceImageUrl(currentPlace) : null;

  const statBadges = [
    { label: `${hero.stats.totalSites} Sites`, icon: 'location' as const },
    { label: `${hero.stats.circuits} Circuits`, icon: 'map' as const },
    { label: `${hero.stats.hiddenGems} Hidden Gems`, icon: 'diamond' as const },
    { label: `${hero.stats.avgRating}\u2605 Avg`, icon: 'star' as const },
  ];

  return (
    <View style={styles.container}>
      {/* Slide Image */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPlacePress && currentPlace && onPlacePress(currentPlace)}
        disabled={!onPlacePress || !currentPlace}
        style={styles.slideContainer}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.slideImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
          />
        ) : (
          <View style={[styles.slideImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={48} color={colors.gray[400]} />
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.gradientOverlay}
        />

        {/* Content Overlay */}
        <View style={styles.contentOverlay} pointerEvents="none">
          <Text style={styles.collectionTitle} numberOfLines={2}>
            {hero.collectionTitle}
          </Text>
          <Text style={styles.tagline} numberOfLines={2}>
            {hero.tagline}
          </Text>

          {/* Stat Badges Row */}
          <View style={styles.statsRow}>
            {statBadges.map((badge, index) => (
              <View key={index} style={styles.statBadge}>
                <Text style={styles.statBadgeText}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Place name indicator */}
        {currentPlace?.name && (
          <View style={styles.placeNameContainer} pointerEvents="none">
            <Ionicons name="location" size={12} color={colors.primary[400]} />
            <Text style={styles.placeName} numberOfLines={1}>
              {currentPlace.name}
            </Text>
          </View>
        )}

        {/* Add badge */}
        {onPlacePress && currentPlace && (
          <View style={styles.addBadge} pointerEvents="none">
            <Ionicons name="add" size={20} color="#ffffff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Dot Indicators */}
      {slideCount > 1 && (
        <View style={[styles.dotsContainer, { backgroundColor: themeColors.background }]}>
          {topPlaces.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleDotPress(index)}
              activeOpacity={0.7}
              style={styles.dotTouchArea}
            >
              <View
                style={[
                  styles.dot,
                  index === currentSlide ? styles.dotActive : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  slideImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  placeholderImage: {
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  collectionTitle: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  placeNameContainer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  placeName: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: '#ffffff',
    maxWidth: 200,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 6,
  },
  dotTouchArea: {
    padding: 4,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary[500],
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  addBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default HeroCarousel;
