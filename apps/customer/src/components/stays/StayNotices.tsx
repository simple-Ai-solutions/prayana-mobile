// StayNotices — the ways the stay screens say "this needs your attention":
//
//   StayNotice       an inline strip (hold ran out, unpaid bookings waiting…)
//                    that leaves the screen usable;
//   StayProblem      a whole-screen card when there's nothing to do here
//                    (sold out, broken link, booking not found);
//   HoldBanner       "Rooms held until 3:45 PM · 18:05 left · Pay now", with a
//                    live countdown mirroring the server's payBy;
//   CancellationNote one line on what cancelling costs.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { cancellationPolicy } from '../../lib/stayLabels';
import { fmtCountdown, fmtDateTime, fmtTime } from '../../lib/stays';

type IconName = keyof typeof Ionicons.glyphMap;
export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<NoticeTone, { icon: IconName; light: [string, string, string]; dark: [string, string, string] }> = {
  // [background, border, text]
  info: { icon: 'information-circle', light: ['#F0F9FF', '#BAE6FD', '#0C4A6E'], dark: ['rgba(14,165,233,0.14)', 'rgba(14,165,233,0.35)', '#E0F2FE'] },
  success: { icon: 'checkmark-circle', light: ['#ECFDF5', '#A7F3D0', '#064E3B'], dark: ['rgba(16,185,129,0.14)', 'rgba(16,185,129,0.35)', '#D1FAE5'] },
  warning: { icon: 'warning', light: ['#FFFBEB', '#FDE68A', '#78350F'], dark: ['rgba(245,158,11,0.14)', 'rgba(245,158,11,0.35)', '#FEF3C7'] },
  error: { icon: 'close-circle', light: ['#FEF2F2', '#FECACA', '#7F1D1D'], dark: ['rgba(239,68,68,0.14)', 'rgba(239,68,68,0.35)', '#FEE2E2'] },
};

export function useToneColors(tone: NoticeTone) {
  const { isDarkMode } = useTheme();
  const [bg, border, text] = isDarkMode ? TONES[tone].dark : TONES[tone].light;
  return { bg, border, text, icon: TONES[tone].icon };
}

export type NoticeAction = { label: string; onPress: () => void };

export function StayNotice({
  tone = 'info',
  title,
  text,
  action,
  icon,
}: {
  tone?: NoticeTone;
  title?: string;
  text?: string | null;
  action?: NoticeAction;
  icon?: IconName;
}) {
  const c = useToneColors(tone);
  return (
    <View
      style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
    >
      <Ionicons name={icon || c.icon} size={18} color={c.text} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.noticeTitle, { color: c.text }]}>{title}</Text> : null}
        {text ? <Text style={[styles.noticeText, { color: c.text }, title ? { marginTop: 2 } : null]}>{text}</Text> : null}
        {action ? (
          <TouchableOpacity onPress={action.onPress} accessibilityRole="button" style={{ marginTop: spacing.sm }}>
            <Text style={[styles.noticeAction, { color: c.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function StayProblem({
  icon = 'alert-circle-outline',
  title,
  text,
  primary,
  secondary,
}: {
  icon?: IconName;
  title: string;
  text?: string | null;
  primary?: NoticeAction;
  secondary?: NoticeAction;
}) {
  const { themeColors, brand, isDarkMode } = useTheme();
  return (
    <View style={styles.problemWrap}>
      <View style={[styles.problem, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={[styles.problemIcon, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.15)' : brand[50] }]}>
          <Ionicons name={icon} size={26} color={brand[600]} />
        </View>
        <Text style={[styles.problemTitle, { color: themeColors.text }]} accessibilityRole="header">
          {title}
        </Text>
        {text ? <Text style={[styles.problemText, { color: themeColors.textSecondary }]}>{text}</Text> : null}
        {primary ? <Button title={primary.label} onPress={primary.onPress} size="lg" fullWidth style={{ marginTop: spacing.lg }} /> : null}
        {secondary ? (
          <Button title={secondary.label} onPress={secondary.onPress} variant="outline" size="lg" fullWidth style={{ marginTop: spacing.sm }} />
        ) : null}
      </View>
    </View>
  );
}

/** Ticks once a second while `active`, for countdowns. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Seconds left until `payBy` (0 once it has passed or when there's none). */
export function useSecondsLeft(payBy?: string | null): number {
  const deadline = payBy ? Date.parse(payBy) : 0;
  const now = useNow(Boolean(deadline));
  return deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : 0;
}

export function HoldBanner({
  payBy,
  title,
  onPay,
  busy = false,
  payLabel = 'Pay now',
  expiredText = 'The rooms were held for 20 minutes and have been released.',
  expiredAction,
}: {
  payBy?: string | null;
  title?: string;
  onPay?: () => void;
  busy?: boolean;
  payLabel?: string;
  expiredText?: string;
  expiredAction?: NoticeAction;
}) {
  const secondsLeft = useSecondsLeft(payBy);
  const expired = secondsLeft <= 0;
  const urgent = !expired && secondsLeft < 180;
  const c = useToneColors(expired ? 'warning' : urgent ? 'error' : 'warning');

  if (expired) {
    return (
      <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border, flexDirection: 'column' }]} accessibilityRole="summary">
        <View style={styles.holdTitleRow}>
          <Ionicons name="hourglass-outline" size={18} color={c.text} />
          <Text style={[styles.noticeTitle, { color: c.text }]}>Your hold has ended</Text>
        </View>
        <Text style={[styles.noticeText, { color: c.text }]}>{expiredText}</Text>
        {expiredAction ? (
          <Button title={expiredAction.label} onPress={expiredAction.onPress} size="md" style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border, flexDirection: 'column' }]}>
      <View style={styles.holdTitleRow}>
        <Ionicons name="time-outline" size={18} color={c.text} />
        <Text style={[styles.noticeTitle, { color: c.text, flex: 1 }]}>{title || `Rooms held until ${fmtTime(payBy)}`}</Text>
      </View>
      <Text
        style={[styles.noticeText, { color: c.text }]}
        accessibilityLabel={`Pay before ${fmtTime(payBy)} to keep these rooms. After that they go back on sale.`}
      >
        <Text style={styles.countdown}>{fmtCountdown(secondsLeft)}</Text> left to pay. After that they go back on sale.
      </Text>
      {onPay ? (
        <Button title={payLabel} onPress={onPay} loading={busy} size="md" fullWidth style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

export function CancellationNote({ policy, freeUntil }: { policy?: string | null; freeUntil?: string | null }) {
  const { themeColors } = useTheme();
  const p = cancellationPolicy(policy);
  const free = p.id !== 'non_refundable' && Boolean(freeUntil);
  const text = free
    ? `Free cancellation until ${fmtDateTime(freeUntil)}. After that, no refund.`
    : p.id === 'non_refundable'
      ? `${p.label}: no refund if you cancel.`
      : "The free cancellation window for these dates has passed, so there's no refund if you cancel.";
  const color = free ? '#059669' : themeColors.textSecondary;
  return (
    <View style={styles.cancelRow}>
      <Ionicons name={free ? 'shield-checkmark-outline' : 'alert-circle-outline'} size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={[styles.cancelText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  noticeTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  noticeText: { fontSize: fontSize.sm, lineHeight: 19 },
  noticeAction: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textDecorationLine: 'underline' },
  holdTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countdown: { fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  problemWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  problem: { borderWidth: 1, borderRadius: borderRadius['2xl'], padding: spacing['2xl'], alignItems: 'center' },
  problemIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  problemTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  problemText: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  cancelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cancelText: { flex: 1, fontSize: fontSize.sm, lineHeight: 19 },
});
