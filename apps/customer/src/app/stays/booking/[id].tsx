// /stays/booking/[id] — one stay booking: where it stands, the voucher,
// paying for a booking still on hold, cancelling, and reviewing after the
// stay. Web parity: app/stays/booking/[id]/page.jsx + StayVoucher.
//
// Reached right after paying (?paid=1 gets the celebration), from My
// Bookings, and from the emails (?review=1 opens the review form). The
// server decides everything that matters here — whether it can still be
// paid (payBy), what a cancellation refunds (cancelPreview), whether the
// host's phone may be shown, whether it can be reviewed — and the screen
// only presents it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { useGoBack } from '../../../lib/goBack';
import { isGuest } from '../../../lib/guestSession';
import { HOUSE_RULES, propertyTypeLabel, ruleText, timeLabel } from '../../../lib/stayLabels';
import {
  asApiError,
  childAgesLabel,
  directionsHref,
  fmtDateTime,
  fmtDay,
  fmtTime,
  guestsLabel,
  inr,
  mealPlanLabel,
  nightsLabel,
  payableOf,
  propertyPath,
  roomLine,
  whatsappHref,
  type StayBooking,
} from '../../../lib/stays';
import { PriceBreakdown } from '../../../components/stays/PriceBreakdown';
import {
  CancellationNote,
  HoldBanner,
  StayNotice,
  StayProblem,
  useToneColors,
  type NoticeTone,
} from '../../../components/stays/StayNotices';
import { CancelStaySheet } from '../../../components/stays/CancelStaySheet';
import { StayReviewForm } from '../../../components/stays/StayReviewForm';
import { useStayPayment } from '../../../components/stays/useStayPayment';

type IconName = keyof typeof Ionicons.glyphMap;
const PAID = ['confirmed', 'completed', 'no_show'];
const CANCEL_DAYS: Record<string, number> = { free_1d: 1, free_3d: 3, free_7d: 7 };

// The policy deadline for bookings without a cancelPreview (only confirmed
// ones get one): check-in day and time in IST, minus the policy's days.
// Same rule as the server's freeCancellationUntil.
function freeUntilFor(b: StayBooking): string | null {
  const days = b.snapshot?.cancellation ? CANCEL_DAYS[b.snapshot.cancellation] : undefined;
  if (!days || !b.checkIn) return null;
  const at = Date.parse(`${b.checkIn}T${b.snapshot?.checkInFrom || '12:00'}:00+05:30`);
  return Number.isNaN(at) ? null : new Date(at - days * 864e5).toISOString();
}

function StatusBanner({ booking, celebrate }: { booking: StayBooking; celebrate: boolean }) {
  const status = booking.status;
  const stayName = booking.snapshot?.stayName || 'Your stay';

  if (status === 'confirmed' && celebrate) {
    return (
      <LinearGradient colors={['#10B981', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.celebrate}>
        <View style={styles.celebrateIcon}>
          <Ionicons name="checkmark-done" size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.celebrateTitle} accessibilityRole="header">
            You're booked!
          </Text>
          <Text style={styles.celebrateText}>
            {stayName} is expecting you on {fmtDay(booking.checkIn)}.
            {booking.guest?.email ? ` We've emailed your voucher to ${booking.guest.email}.` : ''}
          </Text>
        </View>
      </LinearGradient>
    );
  }
  if (status === 'confirmed') {
    return <Banner tone="success" icon="checkmark-circle" title="You're booked!" text="Show this voucher, or just your booking reference, when you check in." />;
  }
  if (status === 'cancelled') {
    const c = booking.cancellation || {};
    const pay = booking.payment || {};
    const when = c.cancelledAt ? ` on ${fmtDay(c.cancelledAt)}` : '';
    const neverPaid = !pay.paidAt;
    let who: string;
    if (c.cancelledBy === 'customer') who = `You cancelled this booking${when}.`;
    else if (c.cancelledBy === 'vendor') who = `The property cancelled this booking${when}.`;
    else if (neverPaid) who = `This booking was released${when} because payment wasn't completed in time.`;
    else who = `This booking was cancelled${when}.`;
    // A payment that landed after the booking lapsed is refunded in full,
    // which shows up as refundedAmount rather than the cancellation's amount.
    const amount = Math.max(Number(c.refundAmount) || 0, Number(pay.refundedAmount) || 0);
    let refund: string | null = null;
    if (!neverPaid) {
      if (amount <= 0) refund = 'No refund was due under the cancellation policy.';
      else if (pay.refundedAt) refund = `${inr(amount)} was refunded on ${fmtDay(pay.refundedAt)}. Banks can take 5–7 working days to show it.`;
      else if (pay.refundFailureReason) refund = `Your ${inr(amount)} refund is being processed. Our team is on it.`;
      else refund = `Your ${inr(amount)} refund is being processed and goes back to your original payment method.`;
    }
    const reason = c.reason && c.cancelledBy !== 'system' ? `Reason: ${c.reason}` : null;
    return <Banner tone="error" icon="close-circle" title="Booking cancelled" text={[who, reason, refund].filter(Boolean).join('\n')} />;
  }
  if (status === 'completed') {
    return (
      <Banner
        tone="info"
        icon="bed"
        title="Hope you enjoyed your stay"
        text={`You checked out on ${fmtDay(booking.checkOut)}. Thanks for booking with Prayana.`}
      />
    );
  }
  if (status === 'no_show') {
    return (
      <Banner
        tone="warning"
        icon="person-remove"
        title="Marked as a no-show"
        text="The property recorded that you didn't arrive. If that's not right, contact them using the details below."
      />
    );
  }
  return null;
}

function Banner({ tone, icon, title, text }: { tone: NoticeTone; icon: IconName; title: string; text: string }) {
  const c = useToneColors(tone);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.border }]} accessibilityRole="summary">
      <Ionicons name={icon} size={22} color={c.text} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.bannerText, { color: c.text }]}>{text}</Text>
      </View>
    </View>
  );
}

function Detail({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={16} color={themeColors.textTertiary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.overline, { color: themeColors.textTertiary }]}>{label}</Text>
        <View>{children}</View>
      </View>
    </View>
  );
}

function ActionButton({ icon, label, onPress, a11y }: { icon: IconName; label: string; onPress: () => void; a11y: string }) {
  const { themeColors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.action, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Ionicons name={icon} size={16} color={themeColors.text} />
      <Text style={[styles.actionText, { color: themeColors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const open = (url: string | null) => {
  if (url) Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: "Couldn't open that" }));
};

export default function StayBookingScreen() {
  const router = useRouter();
  const goBack = useGoBack('/bookings');
  const params = useLocalSearchParams<{ id: string; paid?: string; review?: string }>();
  const id = String(params.id || '');
  const arrivedPaid = params.paid === '1';
  const { user, isLoading: authLoading } = useAuth();
  const signedIn = !isGuest(user);
  const { themeColors, brand, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { startPayment, phase, busy, reset } = useStayPayment();

  const [booking, setBooking] = useState<StayBooking | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [holdEnded, setHoldEnded] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(params.review === '1');
  const scrollRef = useRef<ScrollView>(null);
  const reviewY = useRef(0);
  const scrolledToReview = useRef(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // A follow-up look after a verify that didn't answer; cleared on leaving.
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (later.current) clearTimeout(later.current);
  }, []);

  useEffect(() => {
    if (!signedIn || !id) return undefined;
    let alive = true;
    staysAPI
      .getBooking(id)
      .then((res: { data?: StayBooking }) => {
        if (!alive) return;
        setBooking(res?.data || null);
        setLoadState(res?.data ? 'ready' : 'not_found');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const status = asApiError(e).status;
        setLoadState(status === 403 || status === 404 ? 'not_found' : 'error');
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [signedIn, id, reloadKey]);

  const topBar = (title: string) => (
    <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={26} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.topBarTitle, { color: themeColors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 26 }} />
    </View>
  );

  // ---- before there's a booking ----
  if (authLoading || (signedIn && loadState === 'loading' && !booking)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        {topBar('Your stay')}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }
  if (!signedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        {topBar('Your stay')}
        <StayProblem
          icon="log-in-outline"
          title="Sign in to see your booking"
          text="Your voucher is kept with the account you booked with."
          primary={{
            label: 'Sign in',
            onPress: () =>
              router.push({
                pathname: '/(auth)/login',
                params: { redirectTo: `/stays/booking/${id}${params.review === '1' ? '?review=1' : ''}` },
              } as any),
          }}
        />
      </SafeAreaView>
    );
  }
  if (!booking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        {topBar('Your stay')}
        {loadState === 'error' ? (
          <StayProblem
            icon="cloud-offline-outline"
            title="We couldn't load your booking"
            text="Check your connection and try again."
            primary={{
              label: 'Try again',
              onPress: () => {
                setLoadState('loading');
                reload();
              },
            }}
            secondary={{ label: 'Go to My Bookings', onPress: () => router.replace('/bookings?category=stays' as any) }}
          />
        ) : (
          <StayProblem
            icon="search-outline"
            title="We couldn't find that booking"
            text="It may have been made with a different account. Check you're signed in with the one you booked with."
            primary={{ label: 'Go to My Bookings', onPress: () => router.replace('/bookings?category=stays' as any) }}
            secondary={{ label: 'Browse stays', onPress: () => router.replace('/stays' as any) }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ---- the booking ----
  const s = booking.snapshot || {};
  const status = booking.status;
  const paid = PAID.includes(status);
  const celebrate = status === 'confirmed' && (arrivedPaid || justPaid);
  const preview = booking.cancelPreview;
  const payable = payableOf(booking.pricing);
  const place = [...new Set([s.city, s.state].filter(Boolean))].join(', ');
  const rules = HOUSE_RULES.filter((r) => typeof s.houseRules?.[r.id] === 'boolean');
  const directions = paid ? directionsHref(s.coordinates) : null;
  const wa = paid ? whatsappHref(s.hostPhone) : null;
  const hostPhone = paid ? s.hostPhone : null;
  const hostEmail = paid ? s.hostEmail : null;
  const bookAgain = () =>
    router.push(
      (s.slug
        ? propertyPath(s.slug, {
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            adults: booking.adults,
            children: booking.childrenAges || [],
            rooms: booking.units,
          })
        : '/stays') as any,
    );

  const payNow = () => {
    setNotice(null);
    startPayment({
      prefill: { name: booking.guest?.name, email: booking.guest?.email, phone: booking.guest?.phone },
      ensureBooking: async () => ({ id: booking._id, reference: booking.reference }),
      onPaid: (confirmed) => {
        reset();
        setJustPaid(true);
        if (confirmed?._id) setBooking(confirmed);
        else reload();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      },
      onProblem: ({ stage, code, message }) => {
        if (stage === 'order' && code === 'HOLD_EXPIRED') {
          setHoldEnded(true);
        } else if (stage === 'order' && code === 'NOT_PENDING') {
          reload(); // paid or released elsewhere — show which
        } else if (stage === 'verify' && (code === 'BOOKING_NO_LONGER_PENDING' || code === 'ALREADY_PAID')) {
          setNotice({ tone: code === 'ALREADY_PAID' ? 'info' : 'warning', text: message });
          reload();
        } else if (stage === 'verify') {
          // Razorpay's webhook confirms a real payment by itself; look again shortly.
          setNotice({ tone: 'info', text: "We're confirming your payment. This page updates in a moment." });
          later.current = setTimeout(reload, 4000);
        } else {
          Toast.show({ type: 'error', text1: message });
        }
      },
    });
  };

  const copyReference = async () => {
    try {
      await Clipboard.setStringAsync(booking.reference);
      Toast.show({ type: 'success', text1: 'Booking reference copied' });
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't copy", text2: 'Long-press the reference to select it.' });
    }
  };

  const card = [styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }];
  const muted = { color: themeColors.textSecondary };
  const payLabel = phase === 'verifying' ? 'Confirming…' : phase === 'open' ? 'Waiting for payment…' : `Pay ${inr(payable)}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {topBar(status === 'payment_pending' ? 'Finish your booking' : 'Your stay')}

      {/* The review form's text boxes sit near the bottom. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: spacing['3xl'] + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                reload();
              }}
              tintColor={colors.primary[500]}
              colors={[colors.primary[500]]}
            />
          }
        >
          {/* Where it stands */}
          {status === 'payment_pending' ? (
            holdEnded ? (
              <HoldBanner
                payBy={null}
                expiredText="We held the rooms for 20 minutes and then released them. Check they're still free and book again."
                expiredAction={{ label: 'Book again', onPress: bookAgain }}
              />
            ) : (
              <HoldBanner
                payBy={booking.payBy}
                title={`Complete payment by ${fmtTime(booking.payBy)}`}
                onPay={payNow}
                busy={busy}
                payLabel={payLabel}
                expiredText="We held the rooms for 20 minutes and then released them. Check they're still free and book again."
                expiredAction={{ label: 'Book again', onPress: bookAgain }}
              />
            )
          ) : (
            <StatusBanner booking={booking} celebrate={celebrate} />
          )}

          {notice ? <StayNotice tone={notice.tone} text={notice.text} /> : null}

          {/* Property + reference */}
          <View style={card}>
            <View style={styles.propRow}>
              {s.coverPhoto ? (
                <Image source={{ uri: s.coverPhoto }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.16)' : brand[50] }]}>
                  <Ionicons name="bed-outline" size={28} color={brand[400]} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, { color: isDarkMode ? brand[300] : brand[700] }]}>{propertyTypeLabel(s.propertyType)}</Text>
                <Text style={[styles.stayName, { color: themeColors.text }]}>{s.stayName || 'Your stay'}</Text>
                {place ? (
                  <View style={styles.inline}>
                    <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
                    <Text style={[styles.small, muted, { flex: 1 }]} numberOfLines={1}>
                      {place}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={[styles.refRow, { borderTopColor: themeColors.border, backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: themeColors.textTertiary }]}>BOOKING REFERENCE</Text>
                <Text style={[styles.reference, { color: themeColors.text }]} selectable>
                  {booking.reference}
                </Text>
              </View>
              <TouchableOpacity
                onPress={copyReference}
                style={[styles.copyBtn, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={`Copy booking reference ${booking.reference}`}
              >
                <Ionicons name="copy-outline" size={15} color={themeColors.text} />
                <Text style={[styles.actionText, { color: themeColors.text }]}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stay details */}
          <View style={[card, styles.pad]}>
            <View style={[styles.datesGrid, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: themeColors.textTertiary }]}>CHECK-IN</Text>
                <Text style={[styles.dateText, { color: themeColors.text }]}>{fmtDay(booking.checkIn)}</Text>
                {s.checkInFrom ? <Text style={[styles.small, muted]}>From {timeLabel(s.checkInFrom)}</Text> : null}
              </View>
              <View style={[styles.datesDivider, { backgroundColor: themeColors.border }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: themeColors.textTertiary }]}>CHECK-OUT</Text>
                <Text style={[styles.dateText, { color: themeColors.text }]}>{fmtDay(booking.checkOut)}</Text>
                {s.checkOutBy ? <Text style={[styles.small, muted]}>By {timeLabel(s.checkOutBy)}</Text> : null}
              </View>
            </View>
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Detail icon="bed-outline" label="ROOM">
                <Text style={[styles.body, { color: themeColors.text }]}>
                  {roomLine(s.roomTypeName, booking.units, s.roomKind)} · {nightsLabel(booking.nights)}
                </Text>
              </Detail>
              <Detail icon="restaurant-outline" label="MEALS">
                <Text style={[styles.body, { color: themeColors.text }]}>{mealPlanLabel(s.mealPlan)}</Text>
              </Detail>
              <Detail icon="people-outline" label="GUESTS">
                <Text style={[styles.body, { color: themeColors.text }]}>
                  {guestsLabel(booking.adults, booking.childrenAges)}
                  {booking.childrenAges?.length ? ` (${childAgesLabel(booking.childrenAges)})` : ''}
                </Text>
                {booking.guest?.name ? (
                  <Text style={[styles.small, muted]}>
                    Booked for {booking.guest.name}
                    {booking.guest.phone ? ` · ${booking.guest.phone}` : ''}
                  </Text>
                ) : null}
              </Detail>
              {booking.arrivalTime ? (
                <Detail icon="time-outline" label="ARRIVING">
                  <Text style={[styles.body, { color: themeColors.text }]}>Around {timeLabel(booking.arrivalTime)}</Text>
                </Detail>
              ) : null}
              {booking.specialRequests ? (
                <Detail icon="document-text-outline" label="YOUR REQUESTS">
                  <Text style={[styles.body, { color: themeColors.text }]}>{booking.specialRequests}</Text>
                </Detail>
              ) : null}
            </View>
          </View>

          {/* Getting there & the host */}
          {status !== 'cancelled' && (s.address || hostPhone || hostEmail || !paid) ? (
            <View style={[card, styles.pad, { gap: spacing.sm }]}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]}>Getting there</Text>
              {s.address ? (
                <View style={styles.inlineTop}>
                  <Ionicons name="location-outline" size={16} color={themeColors.textTertiary} style={{ marginTop: 1 }} />
                  <Text style={[styles.body, { color: themeColors.text, flex: 1 }]} selectable>
                    {s.address}
                  </Text>
                </View>
              ) : null}
              {directions || hostPhone || wa || hostEmail ? (
                <View style={styles.actions}>
                  {directions ? <ActionButton icon="navigate-outline" label="Directions" a11y="Directions, opens Google Maps" onPress={() => open(directions)} /> : null}
                  {hostPhone ? (
                    <ActionButton icon="call-outline" label="Call" a11y={`Call the property on ${hostPhone}`} onPress={() => open(`tel:${hostPhone.replace(/\s/g, '')}`)} />
                  ) : null}
                  {wa ? <ActionButton icon="logo-whatsapp" label="WhatsApp" a11y="Message the property on WhatsApp" onPress={() => open(wa)} /> : null}
                  {hostEmail ? <ActionButton icon="mail-outline" label="Email" a11y={`Email the property at ${hostEmail}`} onPress={() => open(`mailto:${hostEmail}`)} /> : null}
                </View>
              ) : null}
              {hostPhone || hostEmail ? (
                <Text style={[styles.small, muted]} selectable>
                  Host: {[hostPhone, hostEmail].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {!paid ? (
                <Text style={[styles.small, { color: themeColors.textTertiary }]}>
                  The host's phone number and directions appear here once you've paid.
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* House rules */}
          {rules.length ? (
            <View style={[card, styles.pad, { gap: spacing.sm }]}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]}>House rules</Text>
              {rules.map((r) => {
                const yes = s.houseRules?.[r.id] === true;
                return (
                  <View key={r.id} style={styles.inlineTop}>
                    <Ionicons name={yes ? 'checkmark' : 'close'} size={16} color={yes ? '#059669' : themeColors.textTertiary} style={{ marginTop: 1 }} />
                    <Text style={[styles.body, { color: yes ? themeColors.text : themeColors.textSecondary, flex: 1 }]}>{ruleText(r.label, yes)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Price */}
          <View style={[card, styles.pad, { gap: spacing.md }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>{booking.payment?.paidAt ? 'What you paid' : 'Price'}</Text>
            <PriceBreakdown
              pricing={booking.pricing}
              roomKind={s.roomKind}
              couponCode={booking.pricing?.couponCode}
              totalLabel={booking.payment?.paidAt ? 'Total paid' : 'Total'}
              payLabel={booking.payment?.paidAt ? 'You paid' : 'You pay'}
            />
            <Text style={[styles.small, muted]}>
              GST included.
              {booking.payment?.paidAt ? ` Paid on ${fmtDateTime(booking.payment.paidAt)}.` : ''}
              {booking.tax?.supplierGstin ? ` Property GSTIN ${booking.tax.supplierGstin}.` : ''}
            </Text>
          </View>

          {/* Cancellation policy */}
          <View style={[card, styles.pad, { gap: spacing.sm }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Cancellation policy</Text>
            <CancellationNote policy={s.cancellation} freeUntil={preview?.freeUntil ?? freeUntilFor(booking)} />
          </View>

          {/* Cancelling — only a confirmed stay, and only before check-in day */}
          {status === 'confirmed' && preview ? (
            <View style={[card, styles.pad, { gap: spacing.sm }]}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]}>Need to cancel?</Text>
              {preview.allowed ? (
                <>
                  {Number(preview.refundPercent) > 0 ? (
                    <Text style={[styles.body, muted]}>
                      Cancel now and you get {inr(preview.refundAmount)} back ({preview.refundPercent}%).
                    </Text>
                  ) : (
                    <Text style={[styles.body, muted]}>You can still cancel, but there's no refund now.</Text>
                  )}
                  <Button title="Cancel booking" variant="outline" size="md" onPress={() => setCancelOpen(true)} textStyle={{ color: colors.error }} style={{ borderColor: colors.error }} />
                </>
              ) : (
                <>
                  <Text style={[styles.body, muted]}>
                    Check-in day is here, so this booking can't be cancelled online. Contact the property to change your stay
                    {hostPhone ? ` on ${hostPhone}` : ''}.
                  </Text>
                  {hostPhone ? (
                    <ActionButton icon="call-outline" label="Call the property" a11y={`Call the property on ${hostPhone}`} onPress={() => open(`tel:${hostPhone.replace(/\s/g, '')}`)} />
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* Review */}
          {booking.canReview ? (
            <View
              style={[card, styles.pad, { gap: spacing.md }]}
              onLayout={(e) => {
                reviewY.current = e.nativeEvent.layout.y;
                // Arrived from the review email: bring the form into view once.
                if (params.review === '1' && !scrolledToReview.current) {
                  scrolledToReview.current = true;
                  setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, reviewY.current - spacing.md), animated: true }), 250);
                }
              }}
            >
              <View style={styles.inlineTop}>
                <Ionicons name="star-outline" size={20} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: themeColors.text }]}>How was your stay?</Text>
                  <Text style={[styles.small, muted]}>Your review helps other travellers choose, and the property improve.</Text>
                </View>
              </View>
              {reviewOpen ? (
                <StayReviewForm
                  bookingId={booking._id}
                  onSubmitted={() => {
                    setReviewOpen(false);
                    reload();
                  }}
                />
              ) : (
                <Button title="Write a review" onPress={() => setReviewOpen(true)} size="md" fullWidth icon={<Ionicons name="create-outline" size={17} color="#fff" />} />
              )}
            </View>
          ) : booking.hasReviewed ? (
            <View style={[card, styles.pad, styles.inlineTop]}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>You reviewed this stay</Text>
                <Text style={[styles.small, muted]}>Thanks for sharing. It's on the property's page for other travellers.</Text>
              </View>
            </View>
          ) : null}

          <Text style={[styles.small, styles.footNote, { color: themeColors.textTertiary }]}>
            Questions about your booking? Quote <Text style={{ fontWeight: fontWeight.bold }}>{booking.reference}</Text> when you contact us.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {phase === 'verifying' ? (
        <View style={[styles.overlay, { backgroundColor: isDarkMode ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.88)' }]} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.overlayTitle, { color: themeColors.text }]}>Confirming your booking…</Text>
          <Text style={[styles.small, muted]}>Please don't close the app.</Text>
        </View>
      ) : null}

      <CancelStaySheet
        booking={booking}
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onCancelled={(updated) => {
          setCancelOpen(false);
          setJustPaid(false);
          if (updated?._id) setBooking(updated);
          else reload();
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  celebrate: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderRadius: borderRadius.xl, padding: spacing.lg },
  celebrateIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrateTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  celebrateText: { color: 'rgba(255,255,255,0.92)', fontSize: fontSize.sm, marginTop: 4, lineHeight: 19 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md },
  bannerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  bannerText: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  pad: { padding: spacing.lg },
  propRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  thumb: { width: 76, height: 76, borderRadius: borderRadius.lg },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 10, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  stayName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  inlineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  small: { fontSize: fontSize.xs, lineHeight: 17 },
  body: { fontSize: fontSize.sm, lineHeight: 20 },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  overline: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.6 },
  reference: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  datesGrid: { flexDirection: 'row', gap: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md },
  datesDivider: { width: StyleSheet.hairlineWidth },
  dateText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 12,
    height: 40,
    alignSelf: 'flex-start',
  },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  footNote: { textAlign: 'center', paddingHorizontal: spacing.lg },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  overlayTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
