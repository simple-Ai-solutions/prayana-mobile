// The moment a booking goes through. Confetti falls, the check springs in,
// the phone gives a success tap, and the booking appears as a ticket: the
// activity's photo, when and who, a torn-ticket divider, the booking
// reference (tap to copy) and what was paid. From here: share the plan with
// friends, put it in a calendar, or go to My Bookings.
import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Linking, Platform, Pressable, Share, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { PressableScale } from '../ui/PressableScale';

const ORANGE = '#F97316';
const CONFETTI_COLORS = ['#F97316', '#E61417', '#4AC0CC', '#FACC15', '#22C55E', '#A855F7'];
const PIECES = 42;

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const { width, height } = useWindowDimensions();
  const fall = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }).map((_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.25,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        round: i % 4 === 0,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [width],
  );

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!alive || reduce) return;
      Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    return () => { alive = false; };
  }, [fall]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const start = p.delay;
        const local = fall.interpolate({ inputRange: [0, start, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -20,
              width: p.w,
              height: p.round ? p.w : p.h,
              borderRadius: p.round ? p.w / 2 : 2,
              backgroundColor: p.color,
              opacity: local.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.85] }) },
                { translateX: local.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: local.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

// ── Calendar link ────────────────────────────────────────────────────────────
// A Google Calendar "add event" link works on every phone without asking for
// calendar permission; it opens prefilled and the user taps Save.
function calendarUrl(title: string, date: Date, place?: string, ref?: string | null) {
  const ymd = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${ymd(date)}/${ymd(end)}`,
    details: ref ? `Prayana booking ${ref}` : 'Booked on Prayana',
    ...(place ? { location: place } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function BookingSuccess({
  title, image, place, date, dateLabel, timeLabel, guestsLabel, totalLabel, bookingRef, instant, payAtVenue,
  onViewBookings, onBackToActivity,
}: {
  title: string;
  image?: string | null;
  place?: string;
  date: Date;
  dateLabel: string;
  timeLabel?: string | null;
  guestsLabel: string;
  totalLabel: string;
  bookingRef?: string | null;
  instant?: boolean;
  payAtVenue?: boolean;
  onViewBookings: () => void;
  onBackToActivity: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }),
      Animated.timing(rise, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [pop, rise]);

  const copyRef = async () => {
    if (!bookingRef) return;
    await Clipboard.setStringAsync(bookingRef).catch(() => {});
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    Toast.show({ type: 'success', text1: 'Booking reference copied', visibilityTime: 1500 });
  };

  const share = () => {
    const lines = [
      `I'm going on ${title}! 🎉`,
      `📅 ${dateLabel}${timeLabel ? ` · ${timeLabel}` : ''}`,
      place ? `📍 ${place}` : null,
      bookingRef ? `Booking ${bookingRef}` : null,
      'Booked on Prayana AI',
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const addToCalendar = () => {
    Linking.openURL(calendarUrl(title, date, place, bookingRef)).catch(() => {
      Toast.show({ type: 'error', text1: "Couldn't open the calendar" });
    });
  };

  const ticketBg = isDarkMode ? '#141B26' : '#FFFFFF';
  const notchBg = themeColors.background;

  return (
    <View style={styles.wrap}>
      <Confetti />

      <Animated.View style={[styles.check, { transform: [{ scale: pop }] }]}>
        <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.checkFill}>
          <Ionicons name="checkmark" size={44} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={[styles.heading, { color: themeColors.text }]}>You're going!</Text>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
        {instant ? 'Your booking is confirmed.' : 'Your booking is placed. We’ll confirm it shortly.'}
      </Text>

      {/* ── The ticket ── */}
      <Animated.View
        style={[
          styles.ticket,
          { backgroundColor: ticketBg, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)' },
          {
            opacity: rise,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}
      >
        <View style={styles.photo}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <LinearGradient colors={[ORANGE, '#E61417']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
          {instant && (
            <View style={styles.instant}>
              <Ionicons name="flash" size={11} color="#fff" />
              <Text style={styles.instantText}>Confirmed</Text>
            </View>
          )}
          <View style={styles.photoText}>
            <Text style={styles.ticketTitle} numberOfLines={2}>{title}</Text>
            {!!place && (
              <View style={styles.placeRow}>
                <Ionicons name="location" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={styles.placeText} numberOfLines={1}>{place}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.facts}>
          <Fact label="Date" value={dateLabel} />
          {!!timeLabel && <Fact label="Time" value={timeLabel} />}
          <Fact label="Guests" value={guestsLabel} />
        </View>

        {/* Torn-ticket divider: a notch each side and a dashed line. */}
        <View style={styles.tearRow}>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: notchBg }]} />
          <View style={[styles.dash, { borderColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.15)' }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: notchBg }]} />
        </View>

        <View style={styles.bottom}>
          {bookingRef ? (
            <Pressable onPress={copyRef} accessibilityRole="button" accessibilityLabel={`Booking reference ${bookingRef}, tap to copy`}>
              <Text style={[styles.refLabel, { color: themeColors.textTertiary }]}>BOOKING REFERENCE</Text>
              <View style={styles.refRow}>
                <Text style={[styles.refValue, { color: themeColors.text }]}>{bookingRef}</Text>
                <Ionicons name="copy-outline" size={15} color={themeColors.textTertiary} />
              </View>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.refLabel, { color: themeColors.textTertiary }]}>{payAtVenue ? 'PAY AT VENUE' : 'PAID'}</Text>
            <Text style={[styles.total, { color: themeColors.text }]}>{totalLabel}</Text>
          </View>
        </View>
      </Animated.View>

      {payAtVenue && (
        <Text style={[styles.note, { color: themeColors.textSecondary }]}>
          Please pay at the venue on the day of the activity.
        </Text>
      )}

      {/* ── What next ── */}
      <View style={styles.quick}>
        <QuickAction icon="share-social-outline" label="Share with friends" onPress={share} />
        <QuickAction icon="calendar-outline" label="Add to calendar" onPress={addToCalendar} />
      </View>

      <PressableScale onPress={onViewBookings} style={styles.primary} accessibilityRole="button" wrapperStyle={{ width: '100%' }}>
        <Text style={styles.primaryText}>View My Bookings</Text>
      </PressableScale>
      <Pressable onPress={onBackToActivity} hitSlop={10} style={styles.secondary} accessibilityRole="button">
        <Text style={[styles.secondaryText, { color: themeColors.textSecondary }]}>Back to activity</Text>
      </Pressable>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: themeColors.textTertiary }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.factValue, { color: themeColors.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      wrapperStyle={{ flex: 1 }}
      style={[styles.quickBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#FFF7ED' }]}
    >
      <Ionicons name={icon} size={18} color={ORANGE} />
      <Text style={[styles.quickText, { color: themeColors.text }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 36, alignItems: 'center' },
  check: { width: 84, height: 84, borderRadius: 42, marginBottom: 16 },
  checkFill: { flex: 1, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  sub: { fontSize: 14, marginTop: 6, marginBottom: 24, textAlign: 'center' },

  ticket: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  photo: { height: 160, justifyContent: 'flex-end' },
  photoText: { padding: 16 },
  ticketTitle: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3, lineHeight: 24 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  placeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' },
  instant: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  instantText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  facts: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, gap: 12 },
  fact: { flex: 1 },
  factLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  factValue: { fontSize: 14, fontWeight: '700', marginTop: 3 },

  tearRow: { height: 28, justifyContent: 'center' },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 2 },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  dash: { marginHorizontal: 20, borderTopWidth: 1.5, borderStyle: 'dashed' },

  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
  refLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  refValue: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  total: { fontSize: 20, fontWeight: '800', marginTop: 2, letterSpacing: -0.4 },

  note: { fontSize: 13, textAlign: 'center', marginTop: 14 },
  quick: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14 },
  quickText: { fontSize: 13.5, fontWeight: '700' },
  primary: { marginTop: 14, backgroundColor: ORANGE, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { marginTop: 14, paddingVertical: 6 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});

export default BookingSuccess;
