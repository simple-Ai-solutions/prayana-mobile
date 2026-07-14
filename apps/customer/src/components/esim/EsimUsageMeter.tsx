// EsimUsageMeter — RN port of components/esim/EsimUsageMeter.jsx.
//
// Crucially it does NOT draw a 0%-used bar before the eSIM has attached to a
// network. `usageOf()` returns null in that case and we show a plain "not
// activated" card instead: an empty progress bar reads as "live, nothing used
// yet", which is a materially different claim from "we have no data".
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { formatData } from '../../lib/esim';
import { BundleState } from '../../lib/esimOrder';

interface Props {
  usage: {
    state: BundleState;
    usedMB: number;
    remainingMB: number;
    totalMB: number;
    percent: number;
  } | null;
  /** The plan's full allowance, shown in the not-activated copy. */
  totalMB?: number;
  isUnlimited?: boolean;
}

const STATE_LABEL: Record<string, string> = {
  available: 'Ready to use',
  in_use: 'Active',
  depleted: 'Data depleted',
  expired: 'Expired',
  pending: 'Pending activation',
};

export const EsimUsageMeter: React.FC<Props> = ({ usage, totalMB, isUnlimited }) => {
  const { themeColors, isDarkMode } = useTheme();

  const card = [
    styles.card,
    { backgroundColor: themeColors.surface, borderColor: themeColors.border },
  ];

  if (!usage) {
    return (
      <View style={card}>
        <View style={styles.header}>
          <Ionicons name="wifi-outline" size={17} color={themeColors.textTertiary} />
          <Text style={[styles.title, { color: themeColors.text }]}>Data usage</Text>
          <View style={[styles.pill, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
            <Text style={[styles.pillText, { color: themeColors.textSecondary }]}>
              Not activated
            </Text>
          </View>
        </View>
        <Text style={[styles.note, { color: themeColors.textSecondary }]}>
          Usage appears once you install the eSIM and connect to a network at your destination.
          {isUnlimited
            ? ' Your unlimited plan is ready to use.'
            : totalMB
              ? ` Your ${formatData(totalMB)} plan is ready to use.`
              : ''}
        </Text>
      </View>
    );
  }

  const depleted = usage.state === 'depleted' || usage.state === 'expired';
  const low = usage.percent > 80;
  const barColor = depleted || low ? '#E61417' : '#16A34A';

  return (
    <View style={card}>
      <View style={styles.header}>
        <Ionicons name="wifi" size={17} color={barColor} />
        <Text style={[styles.title, { color: themeColors.text }]}>Data usage</Text>
        <View style={[styles.pill, { backgroundColor: `${barColor}1A` }]}>
          <Text style={[styles.pillText, { color: barColor }]}>
            {STATE_LABEL[usage.state ?? ''] ?? 'Active'}
          </Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
        <View
          style={[styles.fill, { width: `${usage.percent}%`, backgroundColor: barColor }]}
        />
      </View>

      <View style={styles.stats}>
        <Text style={[styles.stat, { color: themeColors.textSecondary }]}>
          {formatData(usage.usedMB)} used
        </Text>
        <Text style={[styles.stat, { color: barColor, fontWeight: fontWeight.bold }]}>
          {formatData(usage.remainingMB)} left
        </Text>
      </View>

      {depleted && (
        <View style={styles.warn}>
          <Ionicons name="alert-circle" size={14} color="#E61417" />
          <Text style={styles.warnText}>
            {usage.state === 'expired' ? 'This plan has expired.' : 'Your data is fully used.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: fontWeight.bold },

  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },

  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { fontSize: fontSize.xs },

  note: { fontSize: fontSize.xs, lineHeight: 18 },

  warn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  warnText: { color: '#E61417', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});

export default EsimUsageMeter;
