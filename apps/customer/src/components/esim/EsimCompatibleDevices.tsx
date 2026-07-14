// EsimCompatibleDevices — RN port of components/esim/EsimCompatibleDevices.jsx.
// Three brand accordions (Apple / Samsung / Google & others) over the same
// hardcoded device lists the web ships, plus the Settings tip footer.
import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Brand {
  name: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  devices: string[];
}

const BRANDS: Brand[] = [
  {
    name: 'Apple',
    color: '#333333',
    icon: 'logo-apple',
    devices: [
      'iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max',
      'iPhone 15 series',
      'iPhone 14 series',
      'iPhone 13 series',
      'iPhone 12 series',
      'iPhone 11 series',
      'iPhone XS / XS Max / XR',
      'iPhone SE (2020 and newer)',
      'iPad Pro (3rd gen and newer)',
      'iPad Air (3rd gen and newer)',
      'iPad (7th gen and newer)',
    ],
  },
  {
    name: 'Samsung',
    color: '#1428A0',
    icon: 'phone-portrait-outline',
    devices: [
      'Galaxy S25 / S25+ / S25 Ultra',
      'Galaxy S24 series',
      'Galaxy S23 series',
      'Galaxy S22 series',
      'Galaxy S21 series',
      'Galaxy S20 series',
      'Galaxy Z Fold 3 and newer',
      'Galaxy Z Flip 3 and newer',
      'Galaxy Note 20 series',
      'Galaxy A55 / A54',
    ],
  },
  {
    name: 'Google & others',
    color: '#4285F4',
    icon: 'hardware-chip-outline',
    devices: [
      'Google Pixel 9 series',
      'Google Pixel 8 series',
      'Google Pixel 7 series',
      'Google Pixel 6 series',
      'Google Pixel 4 / 5',
      'Google Pixel 3 (limited carriers)',
      'OnePlus 11 / 12',
      'Motorola Razr (2019 and newer)',
      'Oppo Find X3 Pro / X5',
      'Huawei P40 / P50 Pro',
    ],
  },
];

export const EsimCompatibleDevices: React.FC = () => {
  const { themeColors, isDarkMode } = useTheme();
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === name ? null : name));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Compatible devices</Text>
        <LinearGradient
          colors={['#E61417', '#B91C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.countPill}
        >
          <Text style={styles.countPillText}>500+</Text>
        </LinearGradient>
      </View>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
        Works with all major smartphone brands.
      </Text>

      <View style={styles.list}>
        {BRANDS.map((b) => {
          const expanded = open === b.name;
          return (
            <View
              key={b.name}
              style={[
                styles.brandCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: expanded ? `${b.color}55` : themeColors.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggle(b.name)}
                style={styles.brandRow}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <View style={[styles.brandIcon, { backgroundColor: b.color }]}>
                  <Ionicons name={b.icon} size={19} color="#FFFFFF" />
                </View>
                <View style={styles.brandText}>
                  <Text style={[styles.brandName, { color: themeColors.text }]}>{b.name}</Text>
                  <Text style={[styles.brandCount, { color: themeColors.textTertiary }]}>
                    {b.devices.length} supported devices
                  </Text>
                </View>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={17}
                  color={themeColors.textTertiary}
                />
              </TouchableOpacity>

              {expanded && (
                <View
                  style={[
                    styles.devices,
                    { backgroundColor: isDarkMode ? `${b.color}12` : `${b.color}08` },
                  ]}
                >
                  {b.devices.map((d) => (
                    <View key={d} style={styles.deviceRow}>
                      <View style={[styles.check, { backgroundColor: `${b.color}22` }]}>
                        <Ionicons name="checkmark" size={11} color={b.color} />
                      </View>
                      <Text style={[styles.deviceText, { color: themeColors.textSecondary }]}>{d}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.tip,
          {
            backgroundColor: isDarkMode ? 'rgba(230,20,23,0.08)' : 'rgba(230,20,23,0.06)',
            borderColor: 'rgba(230,20,23,0.15)',
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={16} color="#E61417" />
        <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>
          Not sure? Open Settings → Cellular → Add eSIM on your phone. If that option is there, your
          device is compatible.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  countPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  countPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, marginTop: 2 },

  list: { marginTop: spacing.lg, gap: spacing.sm },
  brandCard: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { flex: 1 },
  brandName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  brandCount: { fontSize: fontSize.xs, marginTop: 1 },

  devices: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.xs, gap: 8 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deviceText: { flex: 1, fontSize: fontSize.sm },

  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  tipText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});

export default EsimCompatibleDevices;
