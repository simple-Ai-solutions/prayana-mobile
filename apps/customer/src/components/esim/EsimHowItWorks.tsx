// EsimHowItWorks — the 4-step explainer from the web's eSIM landing page.
// Numbered circles in the brand-red gradient, connected by a vertical rail.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight } from '@prayana/shared-ui';

const STEPS: Array<{ title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }> = [
  {
    title: 'Check compatibility',
    desc: 'Make sure your phone supports eSIM — most models from 2019 onwards do.',
    icon: 'phone-portrait-outline',
  },
  {
    title: 'Pick your destination',
    desc: 'Choose the country you are travelling to and the data plan that fits your trip.',
    icon: 'globe-outline',
  },
  {
    title: 'Scan the QR code',
    desc: 'We send a QR code right after payment. Scan it to install the eSIM profile.',
    icon: 'qr-code-outline',
  },
  {
    title: 'Land and connect',
    desc: 'Your plan activates the moment you connect to a network at your destination.',
    icon: 'checkmark-circle-outline',
  },
];

export const EsimHowItWorks: React.FC = () => {
  const { themeColors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: themeColors.text }]}>How it works</Text>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
        Connected in four steps — no shop, no plastic SIM.
      </Text>

      <View style={styles.steps}>
        {STEPS.map((s, i) => {
          const last = i === STEPS.length - 1;
          return (
            <View key={s.title} style={styles.step}>
              <View style={styles.rail}>
                <LinearGradient
                  colors={['#FF3344', '#E61417', '#C30E11']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>{i + 1}</Text>
                </LinearGradient>
                {!last && <View style={[styles.line, { backgroundColor: themeColors.border }]} />}
              </View>

              <View style={styles.stepBody}>
                <View style={styles.stepHead}>
                  <Ionicons name={s.icon} size={16} color="#E61417" />
                  <Text style={[styles.stepTitle, { color: themeColors.text }]}>{s.title}</Text>
                </View>
                <Text style={[styles.stepDesc, { color: themeColors.textSecondary }]}>{s.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sub: { fontSize: fontSize.sm, marginTop: 2 },

  steps: { marginTop: spacing.lg },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 32 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E61417',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  line: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },

  stepBody: { flex: 1, paddingBottom: spacing.lg },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  stepDesc: { fontSize: fontSize.sm, lineHeight: 20, marginTop: 3 },
});

export default EsimHowItWorks;
