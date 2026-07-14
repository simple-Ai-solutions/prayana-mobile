// CountryExperiences — one country block from the PWA's "Top experiences by
// country": a photo header carrying the country's real catalogue count, a
// horizontal rail of experiences, and a teal "View more".
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { CountryGroup, Experience } from '../../lib/experiences';
import { ExperienceCard } from './ExperienceCard';

const TEAL = '#4AC0CC'; // logo primary — PRAYANA_DESIGN_SYSTEM.pdf
const { width: SCREEN_W } = Dimensions.get('window');
// Peek the next card so the rail visibly affords a swipe.
const CARD_W = Math.round(SCREEN_W * 0.62);

interface Props {
  group: CountryGroup;
  /**
   * Accordion state. The PWA is explicit about this on mobile: "a full-width
   * country banner that expands its rail when tapped; only one country is open
   * at a time". Rendering every rail at once is a wall of content.
   */
  open: boolean;
  onToggle: (country: string) => void;
  onPressExperience: (e: Experience) => void;
  onViewMore: (group: CountryGroup) => void;
}

export const CountryExperiences: React.FC<Props> = ({
  group,
  open,
  onToggle,
  onPressExperience,
  onViewMore,
}) => {
  const { themeColors } = useTheme();

  if (!group.items.length) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
      ]}
    >
      {/* Banner — tap to expand/collapse. The count is the country's real
          catalogue total, not the handful of items we fetched. */}
      <TouchableOpacity
        onPress={() => onToggle(group.country)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${group.country}, ${group.total} experiences`}
      >
        <ImageBackground
          source={group.heroImage ? { uri: group.heroImage } : undefined}
          style={styles.hero}
          imageStyle={styles.heroImg}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroRow}>
            <View style={styles.heroText}>
              <Text style={styles.country} numberOfLines={1}>
                {group.country}
              </Text>
              <Text style={styles.count}>
                {group.total.toLocaleString('en-IN')} experience{group.total === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.chevron}>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#FFFFFF" />
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {open && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {group.items.map((e) => (
              <ExperienceCard
                key={e._id}
                experience={e}
                width={CARD_W}
                onPress={onPressExperience}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => onViewMore(group)}
            style={styles.more}
            accessibilityRole="button"
            accessibilityLabel={`View more experiences in ${group.country}`}
          >
            <Text style={styles.moreText}>View more</Text>
            <Ionicons name="chevron-forward" size={15} color={TEAL} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },

  hero: { height: 130, justifyContent: 'flex-end', backgroundColor: '#1f2937' },
  heroImg: {},
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroText: { flex: 1 },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  country: {
    color: '#FFFFFF',
    // fontSize['2xl'] is exactly 24 — use the token, not the number.
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.6,
  },
  count: { color: 'rgba(255,255,255,0.88)', fontSize: fontSize.sm, marginTop: 2 },

  rail: { gap: spacing.md, padding: spacing.md },

  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TEAL,
  },
  moreText: { color: TEAL, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});

export default CountryExperiences;
