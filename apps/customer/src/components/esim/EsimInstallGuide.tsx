// EsimInstallGuide — RN port of components/esim/EsimInstallGuide.jsx.
// Platform toggle (iPhone/iPad vs Android) over the web's six steps each.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

const ACCENT_RED = '#E61417';

type Platform = 'ios' | 'android';

const STEPS: Record<Platform, Array<{ title: string; desc: string }>> = {
  ios: [
    { title: 'Open Settings', desc: 'Go to Settings → Cellular (or Mobile Data).' },
    { title: 'Add eSIM', desc: 'Tap "Add eSIM" or "Add Cellular Plan".' },
    { title: 'Use QR code', desc: 'Choose "Use QR Code" and scan the code from your order.' },
    { title: 'Confirm the plan', desc: 'Tap Continue, then Add Cellular Plan to install it.' },
    { title: 'Label your plan', desc: 'Name it "Travel" so it is easy to tell from your usual line.' },
    { title: 'Turn on data roaming', desc: 'Select the eSIM as your data line and enable Data Roaming.' },
  ],
  android: [
    { title: 'Open Settings', desc: 'Go to Settings → Network & Internet → SIMs.' },
    { title: 'Add eSIM', desc: 'Tap the + beside SIMs, then "Download a SIM instead?".' },
    { title: 'Scan QR code', desc: 'Scan the QR code from your order.' },
    { title: 'Activate', desc: 'Follow the prompts to download and activate the profile.' },
    { title: 'Enable mobile data', desc: 'Set the eSIM as your mobile data SIM.' },
    { title: 'Turn on roaming', desc: 'Enable roaming for the eSIM so it connects abroad.' },
  ],
};

export const EsimInstallGuide: React.FC = () => {
  const { themeColors, isDarkMode } = useTheme();
  const [platform, setPlatform] = useState<Platform>('ios');

  return (
    <View
      style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
    >
      <Text style={[styles.title, { color: themeColors.text }]}>How to install your eSIM</Text>

      <View style={[styles.tabs, { backgroundColor: isDarkMode ? '#262626' : '#F3F4F6' }]}>
        {(
          [
            { key: 'ios' as const, label: 'iPhone / iPad', icon: 'logo-apple' as const },
            { key: 'android' as const, label: 'Android', icon: 'phone-portrait-outline' as const },
          ]
        ).map((t) => {
          const active = platform === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setPlatform(t.key)}
              style={[styles.tab, active && { backgroundColor: ACCENT_RED }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? '#FFFFFF' : themeColors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: active ? '#FFFFFF' : themeColors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {STEPS[platform].map((s, i) => (
        <View key={s.title} style={styles.step}>
          <LinearGradient
            colors={['#FF3344', '#E61417', '#C30E11']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>{i + 1}</Text>
          </LinearGradient>
          <View style={styles.stepBody}>
            <Text style={[styles.stepTitle, { color: themeColors.text }]}>{s.title}</Text>
            <Text style={[styles.stepDesc, { color: themeColors.textSecondary }]}>{s.desc}</Text>
          </View>
        </View>
      ))}

      <View
        style={[
          styles.tip,
          {
            backgroundColor: isDarkMode ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.08)',
            borderColor: 'rgba(59,130,246,0.20)',
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={15} color="#3B82F6" />
        <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>
          Install the eSIM before you fly, while you still have Wi-Fi. It only activates once you
          connect to a network at your destination.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },

  tabs: { flexDirection: 'row', padding: 3, borderRadius: 999, gap: 3, marginBottom: spacing.lg },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  tabText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  stepDesc: { fontSize: fontSize.xs, lineHeight: 18, marginTop: 2 },

  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  tipText: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
});

export default EsimInstallGuide;
