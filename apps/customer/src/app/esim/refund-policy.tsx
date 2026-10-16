// /esim/refund-policy — eSIM Refund & Cancellation Policy.
// Mobile port of web app/esim/refund-policy/page.jsx. Static copy, kept word
// for word with the web page; update both together.
import React from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { goBack } from '../../lib/goBack';
import { ESIM_RED } from '../../components/esim/EsimPass';

const SUPPORT_EMAIL = 'support@prayanaai.com';

export default function EsimRefundPolicyScreen() {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const body = { color: themeColors.textSecondary };
  const strong = { fontWeight: '700' as const, color: themeColors.text };

  const H = ({ icon, color, children }: { icon?: keyof typeof Ionicons.glyphMap; color?: string; children: React.ReactNode }) => (
    <View style={s.hRow}>
      {icon ? <Ionicons name={icon} size={19} color={color ?? ESIM_RED} /> : null}
      <Text style={[s.h, { color: themeColors.text }]}>{children}</Text>
    </View>
  );
  const Bullets = ({ items }: { items: React.ReactNode[] }) => (
    <View style={s.list}>
      {items.map((it, i) => (
        <View key={i} style={s.li}>
          <Text style={[s.dot, body]}>•</Text>
          <Text style={[s.p, body, { flex: 1 }]}>{it}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.top}>
        <TouchableOpacity onPress={() => goBack('/esim')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[s.topTitle, { color: themeColors.text }]} numberOfLines={1}>Refund policy</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: themeColors.text }]}>eSIM Refund & Cancellation Policy</Text>
        <Text style={[s.updated, body]}>
          Last Updated: <Text style={{ fontWeight: '600' }}>April 21, 2026</Text>
        </Text>
        <View style={[s.rule, { backgroundColor: line }]} />

        <Text style={[s.p, body]}>
          This policy governs refunds and cancellations for eSIM data plans purchased on Prayana AI.
          eSIM plans are fulfilled through our telecom partner <Text style={strong}>Matrix Cellular (International)
          Services Limited</Text>. Our refund terms mirror our partner's terms — we cannot offer
          refunds beyond what the underlying carrier honors.
        </Text>

        <View style={s.section}>
          <H icon="time-outline">1. Pre-Activation Cancellation</H>
          <Text style={[s.p, body]}>
            If you have purchased an eSIM but <Text style={strong}>have not yet installed or activated it</Text> on a
            device, you may cancel and request a full refund.
          </Text>
          <Bullets items={[
            <>Refund window: within <Text style={strong}>7 days of purchase</Text>, and before the plan's travel start date</>,
            'Refund amount: full plan price, minus non-refundable payment gateway charges (typically 2–3%)',
            'Processing time: 5–10 business days to the original payment method',
            "Our support team will verify non-activation with Matrix's API before approving the refund",
          ]} />
        </View>

        <View style={s.section}>
          <H icon="close-circle-outline">2. Post-Activation — No Refund</H>
          <Text style={[s.p, body]}>
            Once an eSIM has been installed on a device or data has been consumed, the plan is considered
            activated and <Text style={strong}>is not eligible for refund</Text>. This is standard for data-only
            eSIM products because:
          </Text>
          <Bullets items={[
            'Activation consumes wholesale inventory from the carrier that cannot be reclaimed',
            'Data usage begins immediately on install and cannot be metered back',
            'The QR code is cryptographically tied to your device once scanned',
          ]} />
          <Text style={[s.p, body, { marginTop: 10 }]}>
            We strongly recommend reading the <Text style={strong}>Device Compatibility</Text> information on the
            checkout page <Text style={{ fontStyle: 'italic' }}>before</Text> completing payment.
          </Text>
        </View>

        <View style={s.section}>
          <H icon="warning-outline" color="#F59E0B">3. Defective or Non-Working eSIM</H>
          <Text style={[s.p, body]}>
            If your eSIM was purchased but the QR code does not install, or the SIM fails to register on
            the network in your destination country, contact support within <Text style={strong}>72 hours</Text> of
            attempted activation.
          </Text>
          <Bullets items={[
            "We will verify the issue with Matrix Cellular's technical team",
            'If confirmed non-activation at the carrier level, we will issue a full refund or a replacement eSIM at your choice',
            'Please provide: order ID, device model, screenshots of any error messages, and the attempted country of use',
          ]} />
        </View>

        <View style={s.section}>
          <H>4. Coverage Complaints</H>
          <Text style={[s.p, body]}>
            eSIM data coverage depends on local carrier agreements and your destination country's
            network infrastructure. Partial coverage, slower speeds in remote areas, or intermittent
            service in buildings/underground is <Text style={strong}>not grounds for a refund</Text> unless the
            service is completely unavailable in a country listed in the plan.
          </Text>
          <Text style={[s.p, body, { marginTop: 10 }]}>
            Coverage lists on plan pages are provided by Matrix Cellular and may change without notice.
          </Text>
        </View>

        <View style={s.section}>
          <H>5. Unused Data at Plan Expiry</H>
          <Text style={[s.p, body]}>
            Unused data at the end of the plan validity period does <Text style={strong}>not roll over</Text> and
            is not refundable. You may purchase a top-up (recharge) before expiry from your order page
            if you need additional data.
          </Text>
        </View>

        <View style={s.section}>
          <H>6. How to Request a Refund</H>
          <Text style={[s.p, body]}>To request a refund, contact us with the following:</Text>
          <Bullets items={[
            <>Your order ID (starts with <Text style={[s.code, { color: ESIM_RED }]}>RL</Text> for Matrix orders)</>,
            'The email address used to place the order',
            'Reason for the refund request',
            'For defective eSIMs: device model + screenshots of the failure',
          ]} />
          <View style={[s.contact, {
            backgroundColor: isDarkMode ? 'rgba(30,41,59,0.6)' : '#FEF2F2',
            borderColor: isDarkMode ? '#334155' : '#FEE2E2',
          }]}>
            <Ionicons name="mail-outline" size={20} color={ESIM_RED} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactTitle, { color: themeColors.text }]}>Support contact</Text>
              <Text style={[s.small, body, { marginTop: 4 }]}>
                Email:{' '}
                <Text style={[s.link, { color: ESIM_RED }]} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
                  {SUPPORT_EMAIL}
                </Text>
              </Text>
              <Text style={[s.tiny, body]}>Response SLA: within 24 business hours for refund requests.</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <H icon="shield-checkmark-outline" color="#22C55E">7. Disputes & Governing Law</H>
          <Text style={[s.p, body]}>
            This policy is governed by the laws of India. Any disputes arising from an eSIM purchase on
            Prayana AI will first be resolved through our support team. Unresolved matters are subject
            to the exclusive jurisdiction of the courts in our registered office city.
          </Text>
        </View>

        <View style={[s.footer, { borderTopColor: line }]}>
          <Text style={[s.small, body, { opacity: 0.8 }]}>
            This policy may be updated from time to time. Material changes will be notified via email to
            customers with active orders. The "Last Updated" date at the top reflects the most
            recent revision.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 },
  updated: { fontSize: 13, marginTop: 8 },
  rule: { height: 1, marginTop: 18, marginBottom: 20 },

  section: { marginTop: 28 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  h: { flex: 1, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  p: { fontSize: 15, lineHeight: 23 },
  list: { gap: 8, marginTop: 10, paddingLeft: 6 },
  li: { flexDirection: 'row', gap: 8 },
  dot: { fontSize: 15, lineHeight: 23 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' },

  contact: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16 },
  contactTitle: { fontSize: 14, fontWeight: '700' },
  small: { fontSize: 13.5, lineHeight: 20 },
  tiny: { fontSize: 12, marginTop: 8, opacity: 0.8 },
  link: { textDecorationLine: 'underline', fontWeight: '600' },

  footer: { borderTopWidth: 1, marginTop: 32, paddingTop: 20 },
});
