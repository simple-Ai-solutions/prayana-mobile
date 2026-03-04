import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, colors, fontSize, fontWeight, spacing, borderRadius } from '@prayana/shared-ui';

const INTERESTS = [
  'Historical Sites', 'Nature & Wildlife', 'Adventure Sports', 'Food & Cuisine',
  'Art & Culture', 'Photography', 'Shopping', 'Nightlife', 'Religious Sites',
  'Museums', 'Beaches', 'Mountains', 'Local Markets', 'Architecture',
  'Festivals', 'Wellness & Spa', 'Local Experiences', 'Street Food',
  'Luxury Travel', 'Budget Travel',
];

const TRAVEL_STYLES = [
  { id: 'relaxed', label: 'Relaxed', emoji: '🌿', desc: 'Slow pace, lots of free time' },
  { id: 'balanced', label: 'Balanced', emoji: '⚖️', desc: 'Mix of activities & downtime' },
  { id: 'packed', label: 'Packed', emoji: '⚡', desc: 'See as much as possible' },
];

const BUDGET_RANGES = [
  { id: 'budget', label: 'Budget', emoji: '💰', desc: 'Under ₹3,000/day' },
  { id: 'medium', label: 'Mid-Range', emoji: '💳', desc: '₹3,000–₹10,000/day' },
  { id: 'luxury', label: 'Luxury', emoji: '✨', desc: '₹10,000+/day' },
];

export default function TravelPreferencesScreen() {
  const router = useRouter();
  const { isDarkMode, themeColors } = useTheme();

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [travelStyle, setTravelStyle] = useState<string>('balanced');
  const [budgetRange, setBudgetRange] = useState<string>('medium');
  const [saving, setSaving] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: persist preferences to backend
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    Alert.alert('Saved!', 'Your travel preferences have been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Travel Preferences</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Interests */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Your Interests</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Select all that apply — helps Isha personalize your trips
          </Text>
          <View style={styles.chipsWrap}>
            {INTERESTS.map((interest) => {
              const selected = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  onPress={() => toggleInterest(interest)}
                  activeOpacity={0.75}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: colors.primary[500], borderColor: colors.primary[500] }
                      : { backgroundColor: themeColors.card, borderColor: themeColors.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#fff' : themeColors.text }]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Travel Style */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Travel Style</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            How do you like to travel?
          </Text>
          <View style={styles.optionsRow}>
            {TRAVEL_STYLES.map((style) => {
              const selected = travelStyle === style.id;
              return (
                <TouchableOpacity
                  key={style.id}
                  onPress={() => setTravelStyle(style.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.optionCard,
                    { backgroundColor: themeColors.card, borderColor: selected ? colors.primary[500] : themeColors.border },
                    selected && styles.optionCardSelected,
                  ]}
                >
                  <Text style={styles.optionEmoji}>{style.emoji}</Text>
                  <Text style={[styles.optionLabel, { color: themeColors.text }]}>{style.label}</Text>
                  <Text style={[styles.optionDesc, { color: themeColors.textSecondary }]}>{style.desc}</Text>
                  {selected && (
                    <View style={styles.optionCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Budget Range */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Budget Range</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Per person, per day
          </Text>
          <View style={styles.optionsRow}>
            {BUDGET_RANGES.map((budget) => {
              const selected = budgetRange === budget.id;
              return (
                <TouchableOpacity
                  key={budget.id}
                  onPress={() => setBudgetRange(budget.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.optionCard,
                    { backgroundColor: themeColors.card, borderColor: selected ? colors.primary[500] : themeColors.border },
                    selected && styles.optionCardSelected,
                  ]}
                >
                  <Text style={styles.optionEmoji}>{budget.emoji}</Text>
                  <Text style={[styles.optionLabel, { color: themeColors.text }]}>{budget.label}</Text>
                  <Text style={[styles.optionDesc, { color: themeColors.textSecondary }]}>{budget.desc}</Text>
                  {selected && (
                    <View style={styles.optionCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AI tip */}
        <View style={[styles.tip, { backgroundColor: isDarkMode ? '#0d2424' : '#f0fdfc', borderColor: colors.primary[200] }]}>
          <Ionicons name="sparkles" size={18} color={colors.primary[500]} />
          <Text style={[styles.tipText, { color: isDarkMode ? colors.primary[300] : colors.primary[700] }]}>
            Isha uses these preferences to generate better trip ideas and activity recommendations tailored just for you.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  saveBtn: { minWidth: 44, alignItems: 'flex-end' },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  content: { paddingBottom: 40 },

  section: { paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    alignItems: 'center',
    position: 'relative',
  },
  optionCardSelected: {
    borderWidth: 2,
  },
  optionEmoji: { fontSize: 28, marginBottom: 6 },
  optionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  optionDesc: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 13,
  },
  optionCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing['2xl'],
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
