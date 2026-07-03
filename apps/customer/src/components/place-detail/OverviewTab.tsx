import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, useTheme } from '@prayana/shared-ui';

interface OverviewTabProps {
  placeData: any;
}

// Section color themes — matches PWA's gradient cards
const SECTION_COLORS = {
  about: { icon: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', darkBg: '#1E293B', darkBorder: '#1E40AF' },
  highlights: { icon: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', darkBg: '#1E293B', darkBorder: '#92400E' },
  experiences: { icon: '#F97316', bg: '#FFF7ED', border: '#FED7AA', darkBg: '#1E293B', darkBorder: '#9A3412' },
  gems: { icon: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', darkBg: '#1E293B', darkBorder: '#5B21B6' },
  features: { icon: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', darkBg: '#1E293B', darkBorder: '#9D174D' },
  history: { icon: '#92400E', bg: '#FEF3C7', border: '#FDE68A', darkBg: '#1E293B', darkBorder: '#78350F' },
  culture: { icon: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', darkBg: '#1E293B', darkBorder: '#0369A1' },
  architecture: { icon: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', darkBg: '#1E293B', darkBorder: '#4338CA' },
  local: { icon: '#D97706', bg: '#FEF3C7', border: '#FCD34D', darkBg: '#1E293B', darkBorder: '#92400E' },
  tips: { icon: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', darkBg: '#1E293B', darkBorder: '#065F46' },
};

export const OverviewTab: React.FC<OverviewTabProps> = ({ placeData }) => {
  const { themeColors, isDarkMode } = useTheme();

  const detailedInfo = placeData?.detailedInfo || {};
  const description = detailedInfo.detailedDescription || placeData?.description || '';
  const historicalBackground = detailedInfo.historicalBackground || '';
  const culturalSignificance = detailedInfo.culturalSignificance || '';
  const architecture = detailedInfo.architecture || '';

  const highlights = Array.isArray(detailedInfo.highlights)
    ? detailedInfo.highlights
    : Array.isArray(placeData?.highlights) ? placeData.highlights : [];
  const bestExperiences = Array.isArray(detailedInfo.bestExperiences) ? detailedInfo.bestExperiences : [];
  const hiddenGems = Array.isArray(detailedInfo.hiddenGems) ? detailedInfo.hiddenGems : [];
  const uniqueFeatures = Array.isArray(detailedInfo.uniqueFeatures) ? detailedInfo.uniqueFeatures : [];
  const tips = Array.isArray(placeData?.tips) ? placeData.tips : [];

  const localContext = detailedInfo.localContext || {};
  const localLegends = localContext.localLegends || '';
  const festivals = localContext.festivals || '';
  const localCustoms = localContext.localCustoms || '';
  const localFood = Array.isArray(localContext.localFood) ? localContext.localFood : [];

  const significance = placeData?.significance || '';
  const nearbyAttractions = Array.isArray(placeData?.nearbyAttractions) ? placeData.nearbyAttractions : [];
  const facilities = Array.isArray(placeData?.facilities)
    ? placeData.facilities
    : Array.isArray(detailedInfo.practicalInfo?.facilities)
      ? detailedInfo.practicalInfo.facilities
      : [];
  const visitingInfo = placeData?.visitingInfo || {};

  const sectionCard = (theme: typeof SECTION_COLORS.about) => ({
    backgroundColor: isDarkMode ? theme.darkBg : theme.bg,
    borderColor: isDarkMode ? theme.darkBorder : theme.border,
  });

  return (
    <View style={styles.container}>
      {/* About */}
      {description ? (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.about)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.about.icon + '15' }]}>
              <Ionicons name="information-circle" size={20} color={SECTION_COLORS.about.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>About</Text>
          </View>
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {description}
          </Text>
        </View>
      ) : null}

      {/* Highlights */}
      {highlights.length > 0 && (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.highlights)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.highlights.icon + '15' }]}>
              <Ionicons name="star" size={20} color={SECTION_COLORS.highlights.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Highlights</Text>
            <View style={[styles.countBadge, { backgroundColor: SECTION_COLORS.highlights.icon + '15' }]}>
              <Text style={[styles.countText, { color: SECTION_COLORS.highlights.icon }]}>{highlights.length}</Text>
            </View>
          </View>
          {highlights.map((h: string, idx: number) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>
                {typeof h === 'string' ? h : String(h)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Best Experiences */}
      {bestExperiences.length > 0 && (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.experiences)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.experiences.icon + '15' }]}>
              <Ionicons name="trophy" size={20} color={SECTION_COLORS.experiences.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Best Experiences</Text>
          </View>
          {bestExperiences.map((exp: string, idx: number) => (
            <View key={idx} style={[styles.numberedCard, { backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', borderColor: isDarkMode ? '#4B5563' : '#FED7AA' }]}>
              <View style={[styles.numberBadge, { backgroundColor: SECTION_COLORS.experiences.icon + '15' }]}>
                <Text style={[styles.numberText, { color: SECTION_COLORS.experiences.icon }]}>{idx + 1}</Text>
              </View>
              <Text style={[styles.numberedCardText, { color: themeColors.text }]}>
                {typeof exp === 'string' ? exp : String(exp)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Hidden Gems */}
      {hiddenGems.length > 0 && (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.gems)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.gems.icon + '15' }]}>
              <Ionicons name="diamond" size={20} color={SECTION_COLORS.gems.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Hidden Gems</Text>
          </View>
          {hiddenGems.map((gem: string, idx: number) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="sparkles" size={18} color={SECTION_COLORS.gems.icon} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>
                {typeof gem === 'string' ? gem : String(gem)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Unique Features */}
      {uniqueFeatures.length > 0 && (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.features)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.features.icon + '15' }]}>
              <Ionicons name="finger-print" size={20} color={SECTION_COLORS.features.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Unique Features</Text>
          </View>
          {uniqueFeatures.map((f: string, idx: number) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="arrow-forward-circle" size={18} color={SECTION_COLORS.features.icon} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>
                {typeof f === 'string' ? f : String(f)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Historical Background */}
      {historicalBackground ? (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.history)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.history.icon + '15' }]}>
              <Ionicons name="book" size={20} color={SECTION_COLORS.history.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Historical Background</Text>
          </View>
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {historicalBackground}
          </Text>
        </View>
      ) : null}

      {/* Cultural Significance */}
      {culturalSignificance ? (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.culture)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.culture.icon + '15' }]}>
              <Ionicons name="earth" size={20} color={SECTION_COLORS.culture.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Cultural Significance</Text>
          </View>
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {culturalSignificance}
          </Text>
        </View>
      ) : null}

      {/* Architecture */}
      {architecture ? (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.architecture)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.architecture.icon + '15' }]}>
              <Ionicons name="business" size={20} color={SECTION_COLORS.architecture.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Architecture</Text>
          </View>
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {architecture}
          </Text>
        </View>
      ) : null}

      {/* Local Culture */}
      {(localLegends || festivals || localCustoms || localFood.length > 0) ? (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.local)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.local.icon + '15' }]}>
              <Ionicons name="people" size={20} color={SECTION_COLORS.local.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Local Culture</Text>
          </View>
          {localLegends ? (
            <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', borderColor: isDarkMode ? '#4B5563' : SECTION_COLORS.local.border }]}>
              <Text style={[styles.localCardLabel, { color: SECTION_COLORS.local.icon }]}>Local Legends</Text>
              <Text style={[styles.localCardText, { color: themeColors.textSecondary }]}>{localLegends}</Text>
            </View>
          ) : null}
          {festivals ? (
            <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', borderColor: isDarkMode ? '#4B5563' : SECTION_COLORS.local.border }]}>
              <Text style={[styles.localCardLabel, { color: SECTION_COLORS.local.icon }]}>Festivals</Text>
              <Text style={[styles.localCardText, { color: themeColors.textSecondary }]}>{festivals}</Text>
            </View>
          ) : null}
          {localCustoms ? (
            <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', borderColor: isDarkMode ? '#4B5563' : SECTION_COLORS.local.border }]}>
              <Text style={[styles.localCardLabel, { color: SECTION_COLORS.local.icon }]}>Local Customs</Text>
              <Text style={[styles.localCardText, { color: themeColors.textSecondary }]}>{localCustoms}</Text>
            </View>
          ) : null}
          {localFood.length > 0 && (
            <>
              <Text style={[styles.localCardLabel, { color: SECTION_COLORS.local.icon, marginTop: spacing.sm, marginBottom: 6 }]}>Local Food</Text>
              <View style={styles.foodRow}>
                {localFood.map((food: string, idx: number) => (
                  <View key={idx} style={[styles.foodChip, { backgroundColor: isDarkMode ? '#374151' : '#FEF3C7', borderColor: isDarkMode ? '#4B5563' : '#FCD34D' }]}>
                    <Text style={[styles.foodChipText, { color: themeColors.text }]}>{food}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      ) : null}

      {/* Significance (legacy fallback) */}
      {significance && !culturalSignificance ? (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.culture)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.culture.icon + '15' }]}>
              <Ionicons name="sparkles" size={20} color={SECTION_COLORS.culture.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Significance</Text>
          </View>
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {significance}
          </Text>
        </View>
      ) : null}

      {/* Quick Visit Info */}
      {(visitingInfo.duration || visitingInfo.bestTime) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Ionicons name="time" size={20} color="#8B5CF6" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Quick Info</Text>
          </View>
          <View style={styles.quickInfoRow}>
            {visitingInfo.duration && (
              <View style={[styles.quickInfoCard, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: isDarkMode ? '#1E40AF' : '#BFDBFE' }]}>
                <Ionicons name="time-outline" size={20} color={colors.primary[500]} />
                <Text style={[styles.quickInfoLabel, { color: themeColors.textTertiary }]}>Duration</Text>
                <Text style={[styles.quickInfoValue, { color: themeColors.text }]}>{visitingInfo.duration}</Text>
              </View>
            )}
            {visitingInfo.bestTime && (
              <View style={[styles.quickInfoCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFBEB', borderColor: isDarkMode ? '#92400E' : '#FDE68A' }]}>
                <Ionicons name="sunny-outline" size={20} color="#F59E0B" />
                <Text style={[styles.quickInfoLabel, { color: themeColors.textTertiary }]}>Best Time</Text>
                <Text style={[styles.quickInfoValue, { color: themeColors.text }]}>{visitingInfo.bestTime}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Facilities */}
      {facilities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="grid-outline" size={20} color="#10B981" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Facilities</Text>
          </View>
          <View style={styles.facilityWrap}>
            {facilities.map((f: string, idx: number) => (
              <View key={idx} style={[styles.facilityChip, { backgroundColor: isDarkMode ? '#1E293B' : '#ECFDF5', borderColor: isDarkMode ? '#065F46' : '#A7F3D0' }]}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
                <Text style={[styles.facilityText, { color: themeColors.text }]}>
                  {typeof f === 'string' ? f : String(f)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Nearby Attractions (legacy fallback) */}
      {nearbyAttractions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EC4899' + '15' }]}>
              <Ionicons name="location" size={20} color="#EC4899" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Nearby Attractions</Text>
          </View>
          {nearbyAttractions.map((a: string, idx: number) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="navigate-circle-outline" size={18} color="#EC4899" />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>
                {typeof a === 'string' ? a : String(a)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <View style={[styles.sectionCard, sectionCard(SECTION_COLORS.tips)]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: SECTION_COLORS.tips.icon + '15' }]}>
              <Ionicons name="bulb" size={20} color={SECTION_COLORS.tips.icon} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Tips</Text>
          </View>
          {tips.map((t: string, idx: number) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="bulb-outline" size={18} color={SECTION_COLORS.tips.icon} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>
                {typeof t === 'string' ? t : String(t)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  section: { marginBottom: spacing.xl },
  sectionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countText: { fontSize: 11, fontWeight: fontWeight.bold },
  description: { fontSize: fontSize.md, lineHeight: 24 },

  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  listText: { flex: 1, fontSize: fontSize.md, lineHeight: 22 },

  numberedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  numberedCardText: {
    flex: 1,
    fontSize: fontSize.md,
    lineHeight: 22,
  },

  localCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  localCardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  localCardText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  foodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  foodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  foodChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  quickInfoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickInfoCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickInfoLabel: { fontSize: fontSize.xs },
  quickInfoValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center' },

  facilityWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  facilityText: { fontSize: fontSize.sm },
});

export default OverviewTab;
