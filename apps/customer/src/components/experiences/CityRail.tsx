// CityRail — one city's horizontal rail from the web /global-experiences
// "What travellers can't stop booking" section (web CityRail). Header = an
// orange→fuchsia MapPin square + city + country + an orange "{total}
// experiences" pill + a "See all in {city}" button; body = a rail of cards.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight } from '@prayana/shared-ui';
import { CityGroup, Experience } from '../../lib/experiences';
import { ExperienceCard } from './ExperienceCard';

const ORANGE = '#F97316';

interface Props {
  group: CityGroup;
  onPressExperience: (e: Experience) => void;
  onSeeAll: (group: CityGroup) => void;
}

export const CityRail: React.FC<Props> = ({ group, onPressExperience, onSeeAll }) => {
  const { themeColors } = useTheme();
  if (!group.items?.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <LinearGradient
          colors={[ORANGE, '#D946EF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pin}
        >
          <Ionicons name="location" size={16} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.headText}>
          <Text style={[styles.city, { color: themeColors.text }]} numberOfLines={1}>
            {group.city}
          </Text>
          {!!group.country && (
            <Text style={[styles.country, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {group.country}
            </Text>
          )}
        </View>
        {group.total > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {group.total.toLocaleString('en-IN')} experiences
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {group.items.map((e) => (
          <ExperienceCard key={e._id} experience={e} width={230} onPress={onPressExperience} />
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() => onSeeAll(group)}
        style={styles.seeAll}
        accessibilityRole="button"
        accessibilityLabel={`See all in ${group.city}`}
      >
        <Text style={styles.seeAllText}>See all in {group.city}</Text>
        <Ionicons name="arrow-forward" size={14} color={ORANGE} />
      </TouchableOpacity>
    </View>
  );
};

export default CityRail;

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pin: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1 },
  city: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.4 },
  country: { fontSize: fontSize.xs, marginTop: 1 },
  countPill: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  countPillText: { color: '#C2410C', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  rail: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
  },
  seeAllText: { color: ORANGE, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
