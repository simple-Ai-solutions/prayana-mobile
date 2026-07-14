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
  onPressExperience: (e: Experience) => void;
  onViewMore: (group: CountryGroup) => void;
}

export const CountryExperiences: React.FC<Props> = ({
  group,
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
      {/* Header — the country's real total, straight from the catalogue. */}
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
        <View style={styles.heroText}>
          <Text style={styles.country} numberOfLines={1}>
            {group.country}
          </Text>
          <Text style={styles.count}>
            {group.total.toLocaleString('en-IN')} experience{group.total === 1 ? '' : 's'}
          </Text>
        </View>
      </ImageBackground>

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
  heroText: { padding: spacing.lg },
  country: {
    color: '#FFFFFF',
    fontSize: 24,
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
