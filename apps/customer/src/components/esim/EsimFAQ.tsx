// EsimFAQ — RN port of components/esim/EsimFAQ.jsx.
// Same 8 questions, same single-open accordion, same brand-red header icon.
import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

const ACCENT_RED = '#E61417';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is an eSIM?',
    a: 'An eSIM is a digital SIM built into your phone. Instead of inserting a plastic card, you scan a QR code and the plan installs itself — so you can get a local data plan without visiting a shop.',
  },
  {
    q: 'How do I know if my phone supports eSIM?',
    a: 'Most phones released after 2019 support eSIM — including iPhone XS and newer, Google Pixel 3 and newer, and recent Samsung Galaxy S and Fold models. On your device, go to Settings → Cellular → Add eSIM. If that option exists, you are supported.',
  },
  {
    q: 'When does the data plan start?',
    a: 'Validity begins when the eSIM connects to a network at your destination, not when you buy it. You can safely install it before you fly.',
  },
  {
    q: 'Can I keep my regular SIM alongside the eSIM?',
    a: 'Yes. The eSIM runs alongside your physical SIM, so you keep receiving calls and texts on your usual number while using the eSIM for data.',
  },
  {
    q: 'What happens when my data runs out?',
    a: 'The connection stops once the allowance is used up. On supported plans you can buy a top-up from your order page without reinstalling anything.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Unactivated eSIMs can be refunded within 7 days of purchase. Once an eSIM has been activated it cannot be refunded, since the plan has been issued by the carrier.',
  },
  {
    q: 'Do I need to remove my physical SIM card?',
    a: 'No. Leave it in. Just set the eSIM as your data line in your phone settings when you arrive.',
  },
  {
    q: 'Will I get a local phone number?',
    a: 'Most travel eSIMs are data-only and do not include a local number. Plans that do include calling are labelled on the plan card. You can still call over WhatsApp or any data-based app.',
  },
];

export const EsimFAQ: React.FC = () => {
  const { themeColors, isDarkMode } = useTheme();
  const [open, setOpen] = useState<number | null>(null);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === i ? null : i));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="help-circle" size={20} color={ACCENT_RED} />
        <Text style={[styles.title, { color: themeColors.text }]}>Frequently asked questions</Text>
      </View>

      <View
        style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
      >
        {FAQS.map((f, i) => {
          const expanded = open === i;
          return (
            <View
              key={f.q}
              style={[
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: themeColors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggle(i)}
                style={styles.qRow}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <Text
                  style={[
                    styles.q,
                    { color: themeColors.text, fontWeight: expanded ? fontWeight.bold : fontWeight.medium },
                  ]}
                >
                  {f.q}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={17}
                  color={expanded ? ACCENT_RED : themeColors.textTertiary}
                />
              </TouchableOpacity>

              {expanded && (
                <View
                  style={[
                    styles.aWrap,
                    { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#FAFAFA' },
                  ]}
                >
                  <Text style={[styles.a, { color: themeColors.textSecondary }]}>{f.a}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.5 },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  q: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
  aWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.sm },
  a: { fontSize: fontSize.sm, lineHeight: 21 },
});

export default EsimFAQ;
