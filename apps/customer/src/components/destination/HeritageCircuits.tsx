import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, shadow, useTheme } from '@prayana/shared-ui';
import { getPlaceImageUrl } from '@prayana/shared-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_IMAGE_HEIGHT = 90;
const INITIAL_CIRCUITS_SHOWN = 3;
const INITIAL_PLACES_SHOWN = 4;

const BORDER_COLORS = [
  '#F97316',
  '#8B5CF6',
  '#10B981',
  '#3B82F6',
  '#EC4899',
  '#EAB308',
];

interface Circuit {
  name: string;
  places: any[];
  count: number;
}

interface HeritageCircuitsProps {
  administrativeCircuits: Record<string, any[]>;
  dynamicCircuits: Record<string, any[]>;
  onPlacePress: (place: any) => void;
  filteredTag: string;
}

export const HeritageCircuits: React.FC<HeritageCircuitsProps> = ({
  administrativeCircuits,
  dynamicCircuits,
  onPlacePress,
  filteredTag,
}) => {
  const { isDarkMode, themeColors } = useTheme();
  const [expandedCircuits, setExpandedCircuits] = useState<Set<string>>(new Set());
  const [showAllCircuits, setShowAllCircuits] = useState(false);

  // Merge both circuit types into a single sorted array
  const allCircuits = useMemo<Circuit[]>(() => {
    const merged: Record<string, any[]> = {};

    // Merge administrative circuits
    if (administrativeCircuits) {
      Object.entries(administrativeCircuits).forEach(([name, places]) => {
        merged[name] = [...(merged[name] || []), ...places];
      });
    }

    // Merge dynamic circuits
    if (dynamicCircuits) {
      Object.entries(dynamicCircuits).forEach(([name, places]) => {
        merged[name] = [...(merged[name] || []), ...places];
      });
    }

    // Convert to array and deduplicate places by name
    const circuits: Circuit[] = Object.entries(merged).map(([name, places]) => {
      const uniquePlaces = places.filter(
        (place, index, self) =>
          index === self.findIndex((p) => p.name === place.name)
      );
      return { name, places: uniquePlaces, count: uniquePlaces.length };
    });

    // Sort by count descending, "Other Attractions" to end
    circuits.sort((a, b) => {
      if (a.name === 'Other Attractions') return 1;
      if (b.name === 'Other Attractions') return -1;
      return b.count - a.count;
    });

    return circuits;
  }, [administrativeCircuits, dynamicCircuits]);

  // Filter places within circuits by tag
  const filteredCircuits = useMemo<Circuit[]>(() => {
    if (!filteredTag || filteredTag === 'all') return allCircuits;

    return allCircuits
      .map((circuit) => {
        const filtered = circuit.places.filter((place) => {
          const tags = place.tags || place.categories || [];
          const category = place.category || '';
          const type = place.type || '';
          return (
            tags.some(
              (t: string) => t.toLowerCase() === filteredTag.toLowerCase()
            ) ||
            category.toLowerCase() === filteredTag.toLowerCase() ||
            type.toLowerCase() === filteredTag.toLowerCase()
          );
        });
        return { ...circuit, places: filtered, count: filtered.length };
      })
      .filter((circuit) => circuit.count > 0);
  }, [allCircuits, filteredTag]);

  const visibleCircuits = showAllCircuits
    ? filteredCircuits
    : filteredCircuits.slice(0, INITIAL_CIRCUITS_SHOWN);

  const toggleCircuitExpansion = useCallback((circuitName: string) => {
    setExpandedCircuits((prev) => {
      const next = new Set(prev);
      if (next.has(circuitName)) {
        next.delete(circuitName);
      } else {
        next.add(circuitName);
      }
      return next;
    });
  }, []);

  if (filteredCircuits.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
        <Ionicons name="map-outline" size={32} color={themeColors.textTertiary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          No circuits found for this filter
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          {'\uD83D\uDDFA\uFE0F'} Heritage Circuits
        </Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
          Curated routes through {filteredCircuits.length} themed trails
        </Text>
      </View>

      {/* Circuit Cards */}
      {visibleCircuits.map((circuit, circuitIndex) => {
        const borderColor = BORDER_COLORS[circuitIndex % BORDER_COLORS.length];
        const isExpanded = expandedCircuits.has(circuit.name);
        const visiblePlaces = isExpanded
          ? circuit.places
          : circuit.places.slice(0, INITIAL_PLACES_SHOWN);
        const hasMorePlaces = circuit.places.length > INITIAL_PLACES_SHOWN;

        return (
          <View
            key={circuit.name}
            style={[
              styles.circuitCard,
              {
                borderLeftColor: borderColor,
                backgroundColor: themeColors.card,
                borderColor: themeColors.cardBorder,
              },
              shadow.sm,
            ]}
          >
            {/* Circuit Header */}
            <View style={styles.circuitHeader}>
              <Text
                style={[styles.circuitName, { color: themeColors.text }]}
                numberOfLines={1}
              >
                {circuit.name}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: borderColor + '20' },
                ]}
              >
                <Text style={[styles.countBadgeText, { color: borderColor }]}>
                  {circuit.count} places
                </Text>
              </View>
            </View>

            {/* 2-Column Place Grid */}
            <View style={styles.placesGrid}>
              {visiblePlaces.map((place, placeIndex) => {
                const imageUrl = getPlaceImageUrl(place);
                const rating =
                  place.rating || place.averageRating || place.stars;

                return (
                  <TouchableOpacity
                    key={`${place.name}-${placeIndex}`}
                    activeOpacity={0.85}
                    onPress={() => onPlacePress(place)}
                    style={styles.placeCard}
                  >
                    {/* Place Image */}
                    <View style={styles.placeImageContainer}>
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.placeImage}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View
                          style={[
                            styles.placeImage,
                            styles.placeholderImage,
                            { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' },
                          ]}
                        >
                          <Ionicons
                            name="image-outline"
                            size={24}
                            color={themeColors.textTertiary}
                          />
                        </View>
                      )}

                      {/* Rating Badge */}
                      {rating && (
                        <View style={styles.ratingBadge} pointerEvents="none">
                          <Ionicons
                            name="star"
                            size={10}
                            color="#EAB308"
                          />
                          <Text style={styles.ratingText}>
                            {typeof rating === 'number'
                              ? rating.toFixed(1)
                              : rating}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Place Name */}
                    <Text
                      style={[styles.placeName, { color: themeColors.text }]}
                      numberOfLines={2}
                    >
                      {place.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Expand/Collapse Button */}
            {hasMorePlaces && (
              <TouchableOpacity
                onPress={() => toggleCircuitExpansion(circuit.name)}
                style={[
                  styles.expandButton,
                  { borderTopColor: themeColors.border },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.expandButtonText, { color: borderColor }]}>
                  {isExpanded
                    ? 'Show Less'
                    : `Show All ${circuit.count} Places`}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={borderColor}
                />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Show All Circuits Button */}
      {filteredCircuits.length > INITIAL_CIRCUITS_SHOWN && !showAllCircuits && (
        <TouchableOpacity
          onPress={() => setShowAllCircuits(true)}
          style={[
            styles.showAllButton,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFF7ED',
              borderColor: colors.primary[300],
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="layers-outline" size={18} color={colors.primary[500]} />
          <Text style={styles.showAllButtonText}>
            Show All {filteredCircuits.length} Circuits
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.primary[500]} />
        </TouchableOpacity>
      )}

      {showAllCircuits && filteredCircuits.length > INITIAL_CIRCUITS_SHOWN && (
        <TouchableOpacity
          onPress={() => setShowAllCircuits(false)}
          style={[
            styles.showAllButton,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFF7ED',
              borderColor: colors.primary[300],
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="layers-outline" size={18} color={colors.primary[500]} />
          <Text style={styles.showAllButtonText}>Show Fewer Circuits</Text>
          <Ionicons name="chevron-up" size={16} color={colors.primary[500]} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const PLACE_CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.lg * 2 - 12) / 2;

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
  },
  emptyContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
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
  circuitCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  circuitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  circuitName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    flex: 1,
    marginRight: spacing.sm,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  placesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  placeCard: {
    width: PLACE_CARD_WIDTH,
  },
  placeImageContainer: {
    position: 'relative',
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  placeImage: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    borderRadius: 8,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  placeName: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  expandButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  showAllButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },
});

export default HeritageCircuits;
