import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, useTheme } from '@prayana/shared-ui';

interface VisitInfoTabProps {
  placeData: any;
}

const FACILITY_ICONS: Record<string, string> = {
  parking: 'car-outline',
  restroom: 'water-outline',
  restrooms: 'water-outline',
  restaurant: 'restaurant-outline',
  food: 'fast-food-outline',
  wifi: 'wifi-outline',
  atm: 'card-outline',
  'first aid': 'medkit-outline',
  wheelchair: 'accessibility-outline',
  guide: 'people-outline',
  shop: 'bag-handle-outline',
  locker: 'lock-closed-outline',
  drinking: 'water-outline',
  toilet: 'water-outline',
  museum: 'library-outline',
  audio: 'headset-outline',
  souvenir: 'gift-outline',
};

const getFacilityIcon = (facility: string): string => {
  const lower = facility.toLowerCase();
  for (const [key, icon] of Object.entries(FACILITY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return 'checkmark-circle-outline';
};

// Color themes per info section — matches PWA design
const INFO_COLORS = {
  time: { icon: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', darkBg: '#1E293B' },
  fee: { icon: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', darkBg: '#1E293B' },
  hours: { icon: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', darkBg: '#1E293B' },
  best: { icon: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', darkBg: '#1E293B' },
};

export const VisitInfoTab: React.FC<VisitInfoTabProps> = ({ placeData }) => {
  const { themeColors, isDarkMode } = useTheme();

  const detailedInfo = placeData?.detailedInfo || {};
  const practicalInfo = detailedInfo.practicalInfo || {};
  const visitingTips = detailedInfo.visitingTips || {};
  const warningsAndCautions = Array.isArray(detailedInfo.warningsAndCautions) ? detailedInfo.warningsAndCautions : [];
  const visitingInfo = placeData?.visitingInfo || {};

  const duration = visitingTips.duration || visitingInfo.duration || placeData?.duration || '';
  const entryFee = practicalInfo.entryFee || visitingInfo.entryFee || placeData?.entryFee || '';
  const openingHours = practicalInfo.openingHours || visitingInfo.openingHours || placeData?.openingHours || '';
  const bestTime = visitingTips.bestSeason || visitingTips.bestTimeOfDay || visitingInfo.bestTime || placeData?.bestTimeToVisit || '';
  const photography = visitingTips.photography || placeData?.photography || '';
  const dressCode = visitingTips.dressCode || '';
  const accessibility = visitingTips.accessibility || '';
  const whatToBring = Array.isArray(visitingTips.whatToBring) ? visitingTips.whatToBring : [];

  const facilities = Array.isArray(practicalInfo.facilities)
    ? practicalInfo.facilities
    : Array.isArray(placeData?.facilities) ? placeData.facilities : [];
  const nearbyServices = Array.isArray(practicalInfo.nearbyServices) ? practicalInfo.nearbyServices : [];
  const tips = Array.isArray(placeData?.tips) ? placeData.tips : [];

  return (
    <View style={styles.container}>
      {/* Quick Info Grid — Color-coded cards */}
      {(duration || entryFee || openingHours || bestTime) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#3B82F6' + '15' }]}>
              <Ionicons name="time" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Quick Info</Text>
          </View>
          <View style={styles.infoGrid}>
            {duration ? (
              <View style={[styles.infoCard, { backgroundColor: isDarkMode ? INFO_COLORS.time.darkBg : INFO_COLORS.time.bg, borderColor: isDarkMode ? '#1E40AF' : INFO_COLORS.time.border }]}>
                <Ionicons name="time-outline" size={24} color={INFO_COLORS.time.icon} />
                <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>Duration</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{duration}</Text>
              </View>
            ) : null}
            {entryFee ? (
              <View style={[styles.infoCard, { backgroundColor: isDarkMode ? INFO_COLORS.fee.darkBg : INFO_COLORS.fee.bg, borderColor: isDarkMode ? '#065F46' : INFO_COLORS.fee.border }]}>
                <Ionicons name="ticket-outline" size={24} color={INFO_COLORS.fee.icon} />
                <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>Entry Fee</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{entryFee}</Text>
              </View>
            ) : null}
            {openingHours ? (
              <View style={[styles.infoCard, { backgroundColor: isDarkMode ? INFO_COLORS.hours.darkBg : INFO_COLORS.hours.bg, borderColor: isDarkMode ? '#5B21B6' : INFO_COLORS.hours.border }]}>
                <Ionicons name="calendar-outline" size={24} color={INFO_COLORS.hours.icon} />
                <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>Hours</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{openingHours}</Text>
              </View>
            ) : null}
            {bestTime ? (
              <View style={[styles.infoCard, { backgroundColor: isDarkMode ? INFO_COLORS.best.darkBg : INFO_COLORS.best.bg, borderColor: isDarkMode ? '#92400E' : INFO_COLORS.best.border }]}>
                <Ionicons name="sunny-outline" size={24} color={INFO_COLORS.best.icon} />
                <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>Best Time</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>{bestTime}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Dress Code */}
      {dressCode ? (
        <View style={[styles.highlightCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F5F3FF', borderColor: isDarkMode ? '#5B21B6' : '#DDD6FE' }]}>
          <Ionicons name="shirt-outline" size={20} color="#8B5CF6" />
          <View style={styles.highlightContent}>
            <Text style={[styles.highlightLabel, { color: '#8B5CF6' }]}>Dress Code</Text>
            <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{dressCode}</Text>
          </View>
        </View>
      ) : null}

      {/* Photography */}
      {photography ? (
        <View style={[styles.highlightCard, { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2FF', borderColor: isDarkMode ? '#4338CA' : '#C7D2FE' }]}>
          <Ionicons name="camera-outline" size={20} color="#6366F1" />
          <View style={styles.highlightContent}>
            <Text style={[styles.highlightLabel, { color: '#6366F1' }]}>Photography</Text>
            <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{photography}</Text>
          </View>
        </View>
      ) : null}

      {/* What to Bring */}
      {whatToBring.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#F97316' + '15' }]}>
              <Ionicons name="bag-check-outline" size={20} color="#F97316" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>What to Bring</Text>
          </View>
          <View style={styles.chipGrid}>
            {whatToBring.map((item: string, idx: number) => (
              <View key={idx} style={[styles.chip, { backgroundColor: isDarkMode ? '#1E293B' : '#FFF7ED', borderColor: isDarkMode ? '#9A3412' : '#FED7AA' }]}>
                <Ionicons name="bag-outline" size={14} color="#F97316" />
                <Text style={[styles.chipText, { color: themeColors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Facilities */}
      {facilities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary[500] + '15' }]}>
              <Ionicons name="grid-outline" size={20} color={colors.primary[500]} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Facilities</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.primary[500] + '15' }]}>
              <Text style={[styles.countText, { color: colors.primary[500] }]}>{facilities.length}</Text>
            </View>
          </View>
          <View style={styles.facilityGrid}>
            {facilities.map((f: string, idx: number) => (
              <View key={idx} style={[styles.facilityItem, { backgroundColor: isDarkMode ? '#1E293B' : '#F0F9FF', borderColor: isDarkMode ? '#0369A1' : '#BAE6FD' }]}>
                <Ionicons name={getFacilityIcon(f) as any} size={20} color={colors.primary[500]} />
                <Text style={[styles.facilityText, { color: themeColors.text }]} numberOfLines={2}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Nearby Services */}
      {nearbyServices.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#0EA5E9' + '15' }]}>
              <Ionicons name="storefront-outline" size={20} color="#0EA5E9" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Nearby Services</Text>
          </View>
          {nearbyServices.map((s: string, idx: number) => (
            <View key={idx} style={styles.tipItem}>
              <Ionicons name="pin-outline" size={16} color="#0EA5E9" />
              <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Warnings & Cautions */}
      {warningsAndCautions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EF4444' + '15' }]}>
              <Ionicons name="warning" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Warnings & Cautions</Text>
          </View>
          {warningsAndCautions.map((w: string, idx: number) => (
            <View key={idx} style={[styles.warningCard, { backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#FEF2F2', borderColor: isDarkMode ? '#991B1B' : '#FECACA' }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={[styles.warningText, { color: themeColors.text }]}>
                {typeof w === 'string' ? w : String(w)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Accessibility */}
      {accessibility ? (
        <View style={[styles.highlightCard, { backgroundColor: isDarkMode ? '#1E293B' : '#ECFDF5', borderColor: isDarkMode ? '#065F46' : '#A7F3D0' }]}>
          <Ionicons name="accessibility-outline" size={20} color="#10B981" />
          <View style={styles.highlightContent}>
            <Text style={[styles.highlightLabel, { color: '#10B981' }]}>Accessibility</Text>
            <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{accessibility}</Text>
          </View>
        </View>
      ) : null}

      {/* Visiting Tips */}
      {tips.length > 0 && (
        <View style={[styles.tipsCard, { backgroundColor: isDarkMode ? '#1E293B' : '#ECFDF5', borderColor: isDarkMode ? '#065F46' : '#A7F3D0' }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="bulb" size={20} color="#10B981" />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Visiting Tips</Text>
          </View>
          {tips.map((t: string, idx: number) => (
            <View key={idx} style={styles.tipItem}>
              <Ionicons name="bulb-outline" size={16} color="#10B981" />
              <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{t}</Text>
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

  // Quick info grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCard: {
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: { fontSize: fontSize.xs },
  infoValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center' },

  // Highlight cards (dress code, photography, accessibility)
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  highlightContent: { flex: 1 },
  highlightLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  highlightText: { fontSize: fontSize.sm, lineHeight: 20 },

  // Chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.sm },

  // Facilities grid
  facilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  facilityText: { fontSize: fontSize.sm },

  // Tips
  tipsCard: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  tipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  tipText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },

  // Warnings
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  warningText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
});

export default VisitInfoTab;
