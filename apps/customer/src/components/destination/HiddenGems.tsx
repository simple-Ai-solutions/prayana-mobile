import React, { useState, useMemo } from 'react';
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
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;
const CARD_HEIGHT = 200;
const INITIAL_GEMS_SHOWN = 6;

interface HiddenGemsProps {
  gems: any[];
  onPlacePress: (place: any) => void;
  filteredTag: string;
}

export const HiddenGems: React.FC<HiddenGemsProps> = ({
  gems,
  onPlacePress,
  filteredTag,
}) => {
  const { isDarkMode, themeColors } = useTheme();
  const [showAll, setShowAll] = useState(false);

  // Filter by tag
  const filteredGems = useMemo(() => {
    if (!filteredTag || filteredTag === 'all') return gems;

    return gems.filter((gem) => {
      const tags = gem.tags || gem.categories || [];
      const category = gem.category || '';
      const type = gem.type || '';
      return (
        tags.some(
          (t: string) => t.toLowerCase() === filteredTag.toLowerCase()
        ) ||
        category.toLowerCase() === filteredTag.toLowerCase() ||
        type.toLowerCase() === filteredTag.toLowerCase()
      );
    });
  }, [gems, filteredTag]);

  const visibleGems = showAll
    ? filteredGems
    : filteredGems.slice(0, INITIAL_GEMS_SHOWN);

  const remainingCount = filteredGems.length - INITIAL_GEMS_SHOWN;

  if (filteredGems.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          {'\uD83D\uDC8E'} Hidden Gems
        </Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
          Lesser-known treasures
        </Text>
      </View>

      {/* 2-Column Grid */}
      <View style={styles.grid}>
        {visibleGems.map((gem, index) => {
          const imageUrl = getPlaceImageUrl(gem);
          const rating = gem.rating || gem.averageRating || gem.stars;
          const location =
            (typeof gem.location === 'string' ? gem.location : gem.location?.area || gem.location?.city || '') ||
            gem.area || gem.category || gem.type || '';

          return (
            <TouchableOpacity
              key={`${gem.name}-${index}`}
              activeOpacity={0.85}
              onPress={() => onPlacePress(gem)}
              style={[styles.card, shadow.md]}
            >
              {/* Image */}
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={[
                    styles.cardImage,
                    styles.placeholderImage,
                    { backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB' },
                  ]}
                >
                  <Ionicons
                    name="diamond-outline"
                    size={32}
                    color={themeColors.textTertiary}
                  />
                </View>
              )}

              {/* Gradient Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.gradientOverlay}
              />

              {/* Gem Badge - Top Left */}
              <View style={styles.gemBadge} pointerEvents="none">
                <Text style={styles.gemBadgeText}>{'\uD83D\uDC8E'}</Text>
              </View>

              {/* Rating Badge - Top Right */}
              {rating && (
                <View style={styles.ratingBadge} pointerEvents="none">
                  <Ionicons name="star" size={10} color="#EAB308" />
                  <Text style={styles.ratingText}>
                    {typeof rating === 'number' ? rating.toFixed(1) : rating}
                  </Text>
                </View>
              )}

              {/* Bottom Content */}
              <View style={styles.cardContent} pointerEvents="none">
                <Text style={styles.cardName} numberOfLines={2}>
                  {gem.name}
                </Text>
                {location ? (
                  <Text style={styles.cardLocation} numberOfLines={1}>
                    {location}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Discover More Button */}
      {!showAll && remainingCount > 0 && (
        <TouchableOpacity
          onPress={() => setShowAll(true)}
          style={[
            styles.discoverButton,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#ECFDF5',
              borderColor: '#10B981',
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="diamond-outline" size={18} color="#10B981" />
          <Text style={styles.discoverButtonText}>
            Discover {remainingCount} More Gems
          </Text>
          <Ionicons name="chevron-down" size={16} color="#10B981" />
        </TouchableOpacity>
      )}

      {showAll && remainingCount > 0 && (
        <TouchableOpacity
          onPress={() => setShowAll(false)}
          style={[
            styles.discoverButton,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#ECFDF5',
              borderColor: '#10B981',
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="diamond-outline" size={18} color="#10B981" />
          <Text style={styles.discoverButtonText}>Show Fewer Gems</Text>
          <Ionicons name="chevron-up" size={16} color="#10B981" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
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
  gemBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#059669',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gemBadgeText: {
    fontSize: 14,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  cardName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardLocation: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  discoverButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#10B981',
  },
});

export default HiddenGems;
