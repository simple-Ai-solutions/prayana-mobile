// Order-page pieces ported from the web's app/esim/order/[orderId]/page.jsx:
//   - useInstallStatus + EsimInstallBadge: "eSIM installed on your device" /
//     "Waiting for installation", polled every 30s until installed;
//   - EsimInvoiceButton: downloads the GST invoice PDF and opens the share sheet;
//   - EsimTroubleshoot: the common install / connection problems and fixes.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';

type InstallStatus = { installed: boolean | null; statusCode?: string } | null;

/** Polls install status for an active order until the profile is installed. */
export function useInstallStatus(orderId: string | undefined, active: boolean): InstallStatus {
  const [status, setStatus] = useState<InstallStatus>(null);
  useEffect(() => {
    if (!orderId || !active || status?.installed === true || status?.statusCode === 'not_supported') return;
    let alive = true;
    const check = async () => {
      try {
        const res: any = await esimAPI.getInstallStatus(orderId);
        if (alive && res?.success && res.data) setStatus(res.data);
      } catch {
        // Silent: the badge simply doesn't show.
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [orderId, active, status?.installed, status?.statusCode]);
  return status;
}

export function EsimInstallBadge({ status }: { status: InstallStatus }) {
  if (!status || status.statusCode === 'not_supported' || status.installed == null) return null;
  const done = status.installed === true;
  return (
    <View style={[s.badge, { backgroundColor: done ? '#f0fdf4' : '#fffbeb', borderColor: done ? '#bbf7d0' : '#fde68a' }]}>
      <View style={[s.badgeDot, { backgroundColor: done ? '#16a34a' : '#f59e0b' }]}>
        <Ionicons name={done ? 'checkmark' : 'time'} size={13} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.badgeTitle, { color: done ? '#15803d' : '#b45309' }]}>
          {done ? 'eSIM installed on your device' : 'Waiting for installation'}
        </Text>
        <Text style={[s.badgeSub, { color: done ? '#16a34a' : '#d97706' }]}>
          {done ? 'It will connect as soon as you land.' : 'Scan the QR code below to install it. This updates by itself.'}
        </Text>
      </View>
    </View>
  );
}

export function EsimInvoiceButton({ orderId, reference }: { orderId: string; reference?: string }) {
  const { themeColors } = useTheme();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const dest = `${FileSystem.cacheDirectory}Prayana-eSIM-invoice-${reference || orderId}.pdf`;
      const res = await FileSystem.downloadAsync(esimAPI.invoiceUrl(orderId), dest, {
        headers: (await esimAPI.invoiceHeaders()) as Record<string, string>,
      });
      if (res.status !== 200) {
        // The server answers with JSON when there is no invoice yet.
        let message = 'The invoice is not ready yet. Please try again later.';
        try {
          const body = JSON.parse(await FileSystem.readAsStringAsync(dest));
          if (body?.message) message = body.message;
        } catch {}
        Toast.show({ type: 'error', text1: "Couldn't get the invoice", text2: message });
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf', dialogTitle: 'eSIM invoice', UTI: 'com.adobe.pdf' });
      } else {
        Toast.show({ type: 'success', text1: 'Invoice downloaded' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: "Couldn't get the invoice", text2: e?.message || 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={download} disabled={busy} style={[s.invoice, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]} accessibilityRole="button">
      {busy ? <ActivityIndicator size="small" color="#E61417" /> : <Ionicons name="document-text-outline" size={17} color="#E61417" />}
      <Text style={[s.invoiceText, { color: themeColors.text }]}>{busy ? 'Preparing invoice…' : 'Download GST invoice'}</Text>
      <Ionicons name="download-outline" size={16} color={themeColors.textTertiary} />
    </Pressable>
  );
}

const ISSUES = [
  {
    problem: "QR code won't scan",
    solution:
      'Try the manual method instead. Go to Settings → Cellular (or Connections → SIM manager) → Add eSIM → Enter details manually, and use the SM-DP+ address and activation code shown in your order.',
  },
  {
    problem: 'eSIM installed but no data connection',
    solution:
      '1. Turn Data Roaming ON for the eSIM line.\n2. Set the eSIM as your mobile data line.\n3. Turn Airplane mode on and off.\n4. Restart your phone.',
  },
  {
    problem: 'eSIM not connecting to network',
    solution:
      '1. Make sure you are in the country the plan covers.\n2. Turn Airplane mode on and off.\n3. In network settings, try choosing a network manually.\n4. APN settings are usually automatic; check them if nothing else works.',
  },
  {
    problem: 'eSIM disappeared from my settings',
    solution:
      'This can happen after a phone reset or update. Once an eSIM profile is deleted it cannot be installed again from the same QR code. Please contact our support team.',
  },
  {
    problem: 'Error during eSIM installation',
    solution:
      '1. Use a stable Wi-Fi connection while installing.\n2. Keep the settings screen open while the eSIM downloads.\n3. If it fails, wait a few minutes and try again.\n4. Restart your phone and scan the QR code again.',
  },
];

export function EsimTroubleshoot() {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={[s.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={s.cardHead}>
        <Ionicons name="warning-outline" size={17} color="#eab308" />
        <Text style={[s.cardTitle, { color: themeColors.text }]}>Troubleshooting</Text>
      </View>
      {ISSUES.map((it, i) => {
        const on = open === i;
        return (
          <View key={it.problem} style={[s.issue, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: themeColors.border }]}>
            <Pressable onPress={() => setOpen(on ? null : i)} style={s.issueHead} accessibilityRole="button" accessibilityState={{ expanded: on }}>
              <Text style={[s.issueQ, { color: themeColors.text }]}>{it.problem}</Text>
              <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textTertiary} />
            </Pressable>
            {on ? <Text style={[s.issueA, { color: themeColors.textSecondary }]}>{it.solution}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  badgeDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontSize: 14, fontWeight: '800' },
  badgeSub: { fontSize: 12, marginTop: 2 },
  invoice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  invoiceText: { flex: 1, fontSize: 14, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  cardTitle: { fontSize: 15.5, fontWeight: '800' },
  issue: { paddingVertical: 12 },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  issueQ: { flex: 1, fontSize: 14, fontWeight: '600' },
  issueA: { fontSize: 13, lineHeight: 19, marginTop: 8 },
});
