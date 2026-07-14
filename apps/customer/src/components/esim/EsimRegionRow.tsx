// EsimRegionRow — the "Browse by region" rows on the eSIM landing page:
// a photo thumbnail with a plan-count badge, the region name, its highlight
// countries, and a live "FROM ₹X / 1 GB".
//
// The price is sampled from the region's real countries. If those requests have
// not landed yet the price line is simply omitted — it is never invented.
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { EsimRegion } from '../../lib/esimRegions';

interface Props {
  region: EsimRegion;
  /** Cheapest bundle found across the region's sample countries. */
  fromINR?: number;
  /** Live plan count across those countries. The static table under-reports. */
  planCount?: number;
  onPress: () => void;
}

export const EsimRegionRow: React.FC<Props> = ({ region, fromINR, planCount, onPress }) => {
  const { themeColors } = useTheme();

  const highlights =
    region.highlights.slice(0, 4).join(' · ') +
    (region.totalCountries > 4 ? ` + ${region.totalCountries - 4} more` : '');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${region.name}, ${region.totalCountries} countries`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <ImageBackground
        source={{ uri: region.image }}
        style={styles.thumb}
        imageStyle={styles.thumbImg}
      >
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{planCount ?? region.plansCount} plans</Text>
        </View>
      </ImageBackground>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: themeColors.text }]} numberOfLines={1}>
            {region.name}
          </Text>
          <View style={[styles.chevron, { backgroundColor: themeColors.text }]}>
            <Ionicons name="chevron-forward" size={13} color={themeColors.background} />
          </View>
        </View>

        <Text style={[styles.highlights, { color: themeColors.textSecondary }]} numberOfLines={2}>
          {highlights}
        </Text>

        {!!fromINR && (
          <Text style={[styles.from, { color: themeColors.textSecondary }]}>
            FROM{' '}
            <Text style={[styles.fromPrice, { color: themeColors.text }]}>
              ₹{fromINR.toLocaleString('en-IN')}
            </Text>{' '}
            / 1 GB
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumb: { width: 96, justifyContent: 'flex-start', backgroundColor: '#1a1a1a' },
  thumbImg: {},
  countBadge: {
    alignSelf: 'flex-start',
    margin: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  countText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#111827' },

  body: { flex: 1, padding: spacing.md, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  chevron: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlights: { fontSize: fontSize.xs, lineHeight: 17 },
  from: { fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 0.4, marginTop: 2 },
  fromPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
});

export default EsimRegionRow;
