// /stays/checkout — guest details, coupon, terms, price and payment for one
// stay. Web parity: app/stays/checkout/page.jsx.
//
// Arrives from the property screen with the whole selection in the params
// (slug, room, checkIn, checkOut, rooms, adults, children — the web's query
// string, so a shared link maps 1:1). The screen prices it again with the
// server (quote) rather than trusting anything carried over, so the guest
// pays exactly what the server will charge, GST and any coupon included.
//
// Paying: booking → order → Razorpay → verify → the booking screen.
// Creating the booking holds the rooms for 20 minutes, so its id is kept (in
// state and in memory, per selection) and every later Pay — after closing
// the payment sheet, after stepping back to the property — pays for that
// same hold instead of taking more rooms off sale.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, TextInput, useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { useGoBack } from '../../lib/goBack';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { isGuest } from '../../lib/guestSession';
import { requiredDocsFor, type AcceptedLegalDoc } from '../../lib/legalRegistry';
import { LegalAcceptanceBlock, isAcceptanceComplete } from '../../components/common/LegalAcceptanceBlock';
import { TIME_OPTIONS, propertyTypeLabel, timeLabel } from '../../lib/stayLabels';
import {
  SPECIAL_REQUESTS_MAX,
  asApiError,
  asSentence,
  checkoutPath,
  childAgesLabel,
  clearHold,
  discountOf,
  errorCode,
  errorText,
  fmtCountdown,
  fmtDay,
  guestsLabel,
  inr,
  mealPlanLabel,
  nightsLabel,
  normalizePhone,
  parseSelection,
  payableOf,
  phoneForField,
  propertyPath,
  readHold,
  roomDetailsLine,
  roomLine,
  saveHold,
  validateGuest,
  type GuestErrors,
  type GuestValues,
  type HoldRecord,
  type StayBooking,
  type StayDetail,
  type StayQuote,
  type StaySelection,
} from '../../lib/stays';
import { PriceBreakdown } from '../../components/stays/PriceBreakdown';
import { CouponField } from '../../components/stays/CouponField';
import { StaySheet } from '../../components/stays/StaySheet';
import {
  CancellationNote,
  HoldBanner,
  StayNotice,
  StayProblem,
  useSecondsLeft,
  type NoticeAction,
  type NoticeTone,
} from '../../components/stays/StayNotices';
import { releaseHold, useStayPayment, type PayProblem } from '../../components/stays/useStayPayment';

const SELECTION_CODES = ['BAD_PARTY', 'TOO_MANY_GUESTS', 'BAD_DATES', 'NO_ROOM'];
const TERMS_NEEDED = 'Tick the box to accept the terms before you pay.';

type Problem = { kind: 'not_found' | 'sold_out' | 'selection' | 'network'; message?: string };
type Notice = { tone: NoticeTone; title?: string; text?: string; action?: NoticeAction };
type FormState = { name: string | null; phone: string | null; email: string | null; arrivalTime: string; specialRequests: string };

// What must match for an existing hold to be paid as-is: the booking carries
// these details and its coupon, so a guest who edits them after holding gets
// a fresh booking (at the right price).
const detailsSignature = (v: GuestValues, couponCode: string | null) =>
  JSON.stringify([
    (v.name || '').trim(),
    normalizePhone(v.phone),
    (v.email || '').trim().toLowerCase(),
    v.arrivalTime || '',
    (v.specialRequests || '').trim(),
    couponCode || '',
  ]);

const quoteFor = (sel: StaySelection, couponCode: string | null) =>
  staysAPI.quote(sel.slug, {
    roomTypeId: sel.roomTypeId,
    checkIn: sel.checkIn,
    checkOut: sel.checkOut,
    units: sel.units,
    adults: sel.adults,
    childrenAges: sel.childrenAges,
    ...(couponCode ? { couponCode } : {}),
  });

export default function StayCheckoutScreen() {
  const router = useRouter();
  const goBack = useGoBack('/stays');
  const params = useLocalSearchParams<Record<string, string>>();
  const paramsKey = JSON.stringify(params);
  const parsed = useMemo(() => parseSelection(params), [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { themeColors } = useTheme();

  if (!parsed.ok) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <TopBar title="Confirm and pay" onBack={goBack} />
        <StayProblem
          icon="search-outline"
          title="This booking link doesn't work"
          text={`${parsed.reason} Pick your room and dates again and we'll bring you right back.`}
          primary={
            parsed.slug
              ? { label: 'Back to the property', onPress: () => router.replace(propertyPath(parsed.slug) as any) }
              : { label: 'Browse stays', onPress: () => router.replace('/stays' as any) }
          }
          secondary={parsed.slug ? { label: 'Browse stays', onPress: () => router.replace('/stays' as any) } : undefined}
        />
      </SafeAreaView>
    );
  }
  // Keyed by the selection so changing it starts a clean checkout.
  return <Checkout key={JSON.stringify(parsed.sel)} sel={parsed.sel} />;
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={26} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.topBarTitle, { color: themeColors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Checkout({ sel }: { sel: StaySelection }) {
  const router = useRouter();
  const goBack = useGoBack('/stays');
  const requireAuth = useRequireAuth();
  const { user, backendProfile } = useAuth();
  const signedIn = !isGuest(user);
  const { themeColors, brand, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { startPayment, phase, busy } = useStayPayment();

  const [stay, setStay] = useState<StayDetail | null>(null);
  const [quote, setQuote] = useState<StayQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // The coupon the shown price includes (mirrored from the quote), so a
  // reload prices the same way. Quotes are numbered and only the latest
  // request's answer is shown.
  const couponRef = useRef<string | null>(null);
  const quoteSeq = useRef(0);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [acceptedLegalDocs, setAcceptedLegalDocs] = useState<AcceptedLegalDoc[]>([]);
  const [termsMessage, setTermsMessage] = useState<string | null>(null);
  const legalRefusals = useRef(0);

  // null = untouched: shows the signed-in profile's value until the guest types.
  const [form, setForm] = useState<FormState>({ name: null, phone: null, email: null, arrivalTime: '', specialRequests: '' });
  const [errors, setErrors] = useState<GuestErrors>({});
  const [arrivalOpen, setArrivalOpen] = useState(false);

  const [hold, setHold] = useState<HoldRecord | null>(null);
  const [holdShown, setHoldShown] = useState(false);
  const [holdLapsed, setHoldLapsed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const termsY = useRef(0);
  const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });

  // The pay footer sits outside the KeyboardAvoidingView and hides while
  // typing — inside it, it rode up over the field being typed into.
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ---- load the property and price the selection ----
  useEffect(() => {
    let alive = true;
    const seq = ++quoteSeq.current;
    Promise.allSettled([staysAPI.getStay(sel.slug), quoteFor(sel, couponRef.current)]).then(([stayRes, quoteRes]) => {
      if (!alive) return;
      if (stayRes.status === 'rejected') {
        setProblem(asApiError(stayRes.reason).status === 404 ? { kind: 'not_found' } : { kind: 'network' });
        return;
      }
      if (quoteRes.status === 'rejected') {
        const e = quoteRes.reason;
        const code = errorCode(e);
        if (asApiError(e).status === 404) setProblem({ kind: 'not_found' });
        else if (code === 'SOLD_OUT') setProblem({ kind: 'sold_out', message: errorText(e) });
        else if (code) setProblem({ kind: 'selection', message: errorText(e) });
        else setProblem({ kind: 'network' });
        return;
      }
      setStay((stayRes.value?.data as StayDetail) || null);
      if (seq === quoteSeq.current) setQuote((quoteRes.value?.data as StayQuote) || null);
    });
    return () => {
      alive = false;
    };
  }, [sel, reloadKey]);

  useEffect(() => {
    couponRef.current = quote?.coupon?.applied ? quote.coupon.code : null;
  }, [quote]);

  // Re-price with a coupon code (or none). The quote's `coupon` says whether
  // the code applied and, if not, why.
  const requote = useCallback(
    async (code: string | null) => {
      const seq = ++quoteSeq.current;
      setQuoting(true);
      try {
        const res = await quoteFor(sel, code);
        if (seq !== quoteSeq.current) return;
        if (!res?.data) throw new Error('No price returned');
        setQuote(res.data as StayQuote);
      } catch (e) {
        if (seq !== quoteSeq.current) return;
        const c = errorCode(e);
        // The rooms themselves can have changed since the screen loaded.
        if (asApiError(e).status === 404) setProblem({ kind: 'not_found' });
        else if (c === 'SOLD_OUT') setProblem({ kind: 'sold_out', message: errorText(e) });
        else if (c) setProblem({ kind: 'selection', message: errorText(e) });
        else setCouponError("Couldn't check the coupon. Check your connection and try again.");
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    },
    [sel],
  );

  // ---- pick up a hold made earlier in this app session ----
  const ready = Boolean(stay && quote);
  useEffect(() => {
    if (!signedIn || !ready) return undefined;
    const saved = readHold(sel);
    if (!saved) return undefined;
    let alive = true;
    staysAPI
      .getBooking(saved.id)
      .then((res: { data?: StayBooking }) => {
        if (!alive) return;
        const b = res?.data;
        if (b?.status === 'payment_pending' && b.payBy && Date.parse(b.payBy) > Date.now()) {
          // Show the details the hold was made with, so paying it is honest.
          const restored: GuestValues = {
            name: b.guest?.name || '',
            phone: phoneForField(b.guest?.phone),
            email: b.guest?.email || '',
            arrivalTime: b.arrivalTime || '',
            specialRequests: b.specialRequests || '',
          };
          const heldCoupon = discountOf(b.pricing) > 0 ? b.pricing?.couponCode || null : null;
          setForm(restored);
          setHold({ id: b._id, reference: b.reference, payBy: b.payBy, sig: detailsSignature(restored, heldCoupon) });
          setHoldShown(true);
          if (heldCoupon !== couponRef.current) requote(heldCoupon);
          return;
        }
        clearHold(sel);
        if (b?.status === 'payment_pending') releaseHold(b._id, 'Hold expired');
        if (b?.status === 'confirmed') {
          setNotice({
            tone: 'success',
            title: "You've already booked this stay",
            text: `Your booking ${b.reference} is confirmed.`,
            action: { label: 'View booking', onPress: () => router.replace(`/stays/booking/${b._id}` as any) },
          });
        }
      })
      .catch((e: unknown) => {
        // Only forget the hold when it's really gone; a dropped connection
        // must not lead to a second booking.
        const status = asApiError(e).status;
        if (alive && (status === 403 || status === 404)) clearHold(sel);
      });
    return () => {
      alive = false;
    };
  }, [signedIn, sel, ready, requote, router]);

  // ---- form values: what's typed, else the signed-in profile ----
  const profileName = String(backendProfile?.name || user?.displayName || '');
  const values: GuestValues = {
    name: form.name ?? (signedIn && !['Guest', 'Guest User', 'Travel User'].includes(profileName) ? profileName : ''),
    phone: form.phone ?? phoneForField(String(backendProfile?.phone || user?.phoneNumber || '')),
    email: form.email ?? (signedIn ? String(backendProfile?.email || user?.email || '') : ''),
    arrivalTime: form.arrivalTime,
    specialRequests: form.specialRequests,
  };
  const setField = (field: keyof GuestValues, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  // ---- coupon & terms ----
  const applyCoupon = (code: string) => {
    setCouponError(null);
    return requote(code);
  };
  const removeCoupon = () => {
    setCouponError(null);
    return requote(null);
  };
  const onTermsChange = (next: AcceptedLegalDoc[]) => {
    setAcceptedLegalDocs(next);
    if (isAcceptanceComplete(next, 'stay')) setTermsMessage(null);
  };
  const askForTerms = (message: string) => {
    setTermsMessage(message);
    scrollTo(termsY.current);
  };

  // ---- paying ----
  const showHoldEnded = () => {
    setHold(null);
    setHoldShown(false);
    setHoldLapsed(true);
    setNotice({
      tone: 'warning',
      title: 'Your hold ran out',
      text: "We hold rooms for 20 minutes while you pay, then put them back on sale. Tap Pay to check they're still free and hold them again.",
    });
  };

  const onCreateFailed = (e: unknown) => {
    const code = errorCode(e);
    if (asApiError(e).status === 401) {
      Toast.show({ type: 'error', text1: 'Your sign-in has expired', text2: 'Please sign out and sign in again.' });
    } else if (code === 'SOLD_OUT') {
      setProblem({ kind: 'sold_out', message: errorText(e) });
    } else if (code === 'TOO_MANY_PENDING') {
      setNotice({
        tone: 'warning',
        title: 'You have unpaid bookings waiting',
        text: errorText(e),
        action: { label: 'See your stays', onPress: () => router.push('/bookings?category=stays' as any) },
      });
    } else if (code === 'BAD_GUEST') {
      setNotice({ tone: 'error', text: errorText(e) });
    } else if (code === 'BAD_COUPON') {
      // Per-guest limits are only checked now. Take the code off and show the
      // full price before they pay it.
      const reason = errorText(e, "This coupon can't be used on this booking.");
      setCouponError(reason);
      Toast.show({ type: 'error', text1: asSentence(reason), text2: "We've taken the coupon off. Check the new price, then pay." });
      requote(null);
    } else if (code === 'LEGAL_REQUIRED') {
      // Our terms changed since the screen loaded (or the tick didn't reach us).
      legalRefusals.current += 1;
      setAcceptedLegalDocs([]);
      askForTerms(
        legalRefusals.current > 1
          ? "We still couldn't record that you accepted the terms. Update the app to load the latest version, then accept them and pay."
          : 'Our booking terms were updated. Please tick the box again to accept the latest version, then pay.',
      );
    } else if (code && SELECTION_CODES.includes(code)) {
      setProblem({ kind: 'selection', message: errorText(e) });
    } else if (asApiError(e).status === 404) {
      setProblem({ kind: 'not_found' });
    } else {
      Toast.show({ type: 'error', text1: "Couldn't hold your rooms", text2: errorText(e, 'Please try again.') });
    }
  };

  const onPayProblem = ({ stage, code, message }: PayProblem, bookingId: string) => {
    if (stage === 'order') {
      if (code === 'HOLD_EXPIRED') {
        releaseHold(bookingId, 'Hold expired');
        clearHold(sel);
        showHoldEnded();
      } else if (code === 'NOT_PENDING') {
        // Paid already (the webhook can beat us) or released — find out which.
        staysAPI
          .getBooking(bookingId)
          .then((res: { data?: StayBooking }) => {
            clearHold(sel);
            if (res?.data?.status === 'confirmed') router.replace(`/stays/booking/${bookingId}` as any);
            else showHoldEnded();
          })
          .catch(() => Toast.show({ type: 'error', text1: message }));
      } else {
        Toast.show({ type: 'error', text1: message });
      }
      return;
    }
    if (code === 'BOOKING_NO_LONGER_PENDING' || code === 'ALREADY_PAID') {
      clearHold(sel);
      setHold(null);
      setHoldShown(false);
      setNotice({
        tone: code === 'ALREADY_PAID' ? 'info' : 'warning',
        text: message,
        action: { label: 'View booking', onPress: () => router.replace(`/stays/booking/${bookingId}` as any) },
      });
      return;
    }
    // The payment may well have gone through — Razorpay's webhook confirms it
    // on its own. The booking screen shows where it landed.
    Toast.show({ type: 'info', text1: "We're confirming your payment", text2: 'Your booking shows the latest.' });
    router.replace(`/stays/booking/${bookingId}` as any);
  };

  const pay = () => {
    if (busy || quoting || !stay || !quote) return;
    Keyboard.dismiss();
    const errs = validateGuest(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      Toast.show({ type: 'error', text1: 'Please check your details' });
      scrollTo(formY.current);
      return;
    }
    if (!isAcceptanceComplete(acceptedLegalDocs, 'stay')) {
      Toast.show({ type: 'error', text1: 'Please accept the terms to continue' });
      askForTerms(TERMS_NEEDED);
      return;
    }
    // Normally signed in already (Reserve asks); a link opened as a guest is
    // asked here. What's typed stays on the screen.
    if (!requireAuth({ reason: 'Sign in to book your stay. Your booking and voucher will be saved to your account.', redirectAfter: checkoutPath(sel) })) {
      return;
    }

    setNotice(null);
    const guest = { name: values.name.trim(), email: values.email.trim(), phone: normalizePhone(values.phone) || '' };
    const couponCode = quote.coupon?.applied ? quote.coupon.code : null;
    const sig = detailsSignature(values, couponCode);

    startPayment({
      prefill: guest,
      ensureBooking: async () => {
        let current: HoldRecord | null = hold || readHold(sel);
        // A hold that has run out, or that carries details (or a coupon) the
        // guest has since changed, is released first: until the server's
        // sweep, our own stale hold could make the last room look sold out.
        if (current && ((current.payBy && Date.parse(current.payBy) <= Date.now()) || current.sig !== sig)) {
          const released = await releaseHold(current.id, current.sig !== sig ? 'Guest changed their details' : 'Hold expired');
          clearHold(sel);
          if (released.alreadyPaid) {
            router.replace(`/stays/booking/${current.id}?paid=1` as any);
            return null;
          }
          setHold(null);
          current = null;
        }
        if (current) {
          setHold(current);
          return { id: current.id, reference: current.reference };
        }
        try {
          const res = await staysAPI.createBooking({
            slug: sel.slug,
            roomTypeId: sel.roomTypeId,
            checkIn: sel.checkIn,
            checkOut: sel.checkOut,
            units: sel.units,
            adults: sel.adults,
            childrenAges: sel.childrenAges,
            guest,
            specialRequests: values.specialRequests.trim() || undefined,
            arrivalTime: values.arrivalTime || undefined,
            couponCode: couponCode || undefined,
            acceptedLegalDocs: requiredDocsFor('booking:stay').map((d) => ({ slug: d.slug, version: d.version })),
          });
          const b = res?.data as StayBooking | undefined;
          if (!b?._id) throw new Error('No booking returned');
          const next: HoldRecord = { id: b._id, reference: b.reference, payBy: b.payBy, sig };
          saveHold(sel, next);
          setHold(next);
          setHoldLapsed(false);
          return { id: next.id, reference: next.reference };
        } catch (e) {
          onCreateFailed(e);
          return null;
        }
      },
      onPaid: (_booking, bookingId) => {
        clearHold(sel);
        router.replace(`/stays/booking/${bookingId}?paid=1` as any);
      },
      onDismiss: () => setHoldShown(true),
      onProblem: onPayProblem,
    });
  };

  const holdSeconds = useSecondsLeft(hold && holdShown ? hold.payBy : null);
  // Back to the property screen underneath (it re-checks prices on focus),
  // or open it fresh when the checkout was the first screen.
  const backToProperty = useGoBack(
    propertyPath(sel.slug, { checkIn: sel.checkIn, checkOut: sel.checkOut, adults: sel.adults, children: sel.childrenAges, rooms: sel.units }),
  );

  // ---- render ----

  if (problem) {
    const view =
      problem.kind === 'not_found' ? (
        <StayProblem
          icon="search-outline"
          title="This stay isn't taking bookings"
          text="The host may have paused it for now. There are plenty of other places to stay."
          primary={{ label: 'Browse stays', onPress: () => router.replace('/stays' as any) }}
        />
      ) : problem.kind === 'sold_out' ? (
        <StayProblem
          icon="calendar-outline"
          title="Those rooms just sold out"
          text={`${asSentence(problem.message) || 'Try another room or different dates.'}${
            holdLapsed ? ' If you were holding these rooms, they go back on sale within a few minutes.' : ''
          }`}
          primary={{ label: 'Back to the property', onPress: backToProperty }}
          secondary={{ label: 'Browse stays', onPress: () => router.replace('/stays' as any) }}
        />
      ) : problem.kind === 'selection' ? (
        <StayProblem
          icon="calendar-outline"
          title="Let's fix your booking"
          text={problem.message}
          primary={{ label: 'Back to the property', onPress: backToProperty }}
          secondary={{ label: 'Browse stays', onPress: () => router.replace('/stays' as any) }}
        />
      ) : (
        <StayProblem
          icon="cloud-offline-outline"
          title="We couldn't load this stay"
          text="Check your connection and try again."
          primary={{
            label: 'Try again',
            onPress: () => {
              setProblem(null);
              setStay(null);
              setQuote(null);
              setReloadKey((k) => k + 1);
            },
          }}
          secondary={{ label: 'Back to the property', onPress: backToProperty }}
        />
      );
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <TopBar title="Confirm and pay" onBack={goBack} />
        {view}
      </SafeAreaView>
    );
  }

  if (!stay || !quote) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <TopBar title="Confirm and pay" onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  const roomType = (stay.roomTypes || []).find((r) => String(r._id) === String(sel.roomTypeId));
  const place = [...new Set([stay.location?.locality, stay.location?.city, stay.location?.state].filter(Boolean))].join(', ');
  const payable = payableOf(quote.pricing);
  const holdMinutes = quote.holdMinutes || 20;
  const appliedCoupon = quote.coupon?.applied ? quote.coupon : null;
  // The quote's own answer when a code didn't apply; else a refusal at booking.
  const couponProblem = couponError || (quote.coupon && !quote.coupon.applied ? quote.coupon.reason || "This code doesn't apply." : null);
  const payLabel =
    phase === 'verifying' ? 'Confirming your booking…' : phase === 'open' ? 'Waiting for payment…' : `Pay ${inr(payable)}`;
  const international = values.phone.trim().startsWith('+');
  const card = [styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }];
  const muted = { color: themeColors.textSecondary };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      <TopBar title="Confirm and pay" onBack={goBack} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {(notice || (hold && holdShown && !busy)) && (
            <View style={{ gap: spacing.md }}>
              {hold && holdShown && !busy ? (
                <HoldBanner
                  payBy={hold.payBy}
                  onPay={pay}
                  busy={busy}
                  payLabel={`Pay ${inr(payable)}`}
                  expiredText="Pay again and we'll check the rooms are still free and hold them for you."
                  expiredAction={{ label: `Pay ${inr(payable)}`, onPress: pay }}
                />
              ) : null}
              {notice ? <StayNotice tone={notice.tone} title={notice.title} text={notice.text} action={notice.action} /> : null}
            </View>
          )}

          {/* What you're booking */}
          <View style={card}>
            {stay.coverPhoto ? (
              <Image source={{ uri: stay.coverPhoto }} style={styles.cover} contentFit="cover" />
            ) : null}
            <View style={styles.cardPad}>
              <Text style={[styles.typeLabel, { color: isDarkMode ? brand[300] : brand[700] }]}>{propertyTypeLabel(stay.propertyType)}</Text>
              <Text style={[styles.stayName, { color: themeColors.text }]}>{stay.name}</Text>
              {place ? (
                <View style={styles.inline}>
                  <Ionicons name="location-outline" size={14} color={themeColors.textTertiary} />
                  <Text style={[styles.small, muted, { flex: 1 }]} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.datesGrid, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overline, { color: themeColors.textTertiary }]}>CHECK-IN</Text>
                  <Text style={[styles.dateText, { color: themeColors.text }]}>{fmtDay(sel.checkIn)}</Text>
                  {stay.policies?.checkInFrom ? <Text style={[styles.small, muted]}>From {timeLabel(stay.policies.checkInFrom)}</Text> : null}
                </View>
                <View style={[styles.datesDivider, { backgroundColor: themeColors.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overline, { color: themeColors.textTertiary }]}>CHECK-OUT</Text>
                  <Text style={[styles.dateText, { color: themeColors.text }]}>{fmtDay(sel.checkOut)}</Text>
                  {stay.policies?.checkOutBy ? <Text style={[styles.small, muted]}>By {timeLabel(stay.policies.checkOutBy)}</Text> : null}
                </View>
              </View>

              <View style={styles.facts}>
                <View style={styles.inlineTop}>
                  <Ionicons name="bed-outline" size={16} color={themeColors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.body, { color: themeColors.text, fontWeight: fontWeight.semibold }]}>
                      {roomLine(quote.roomTypeName, quote.units, quote.roomKind)}
                    </Text>
                    {roomDetailsLine(roomType) ? <Text style={[styles.small, muted]}>{roomDetailsLine(roomType)}</Text> : null}
                  </View>
                </View>
                <View style={styles.inlineTop}>
                  <Ionicons name="restaurant-outline" size={16} color={themeColors.textTertiary} />
                  <Text style={[styles.body, muted]}>{mealPlanLabel(quote.mealPlan)}</Text>
                </View>
                <View style={styles.inlineTop}>
                  <Ionicons name="moon-outline" size={16} color={themeColors.textTertiary} />
                  <Text style={[styles.body, muted]}>{nightsLabel(quote.nights)}</Text>
                </View>
                <View style={styles.inlineTop}>
                  <Ionicons name="people-outline" size={16} color={themeColors.textTertiary} />
                  <Text style={[styles.body, muted, { flex: 1 }]}>
                    {guestsLabel(sel.adults, sel.childrenAges)}
                    {sel.childrenAges.length ? ` (${childAgesLabel(sel.childrenAges)})` : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Price */}
          <View style={[card, styles.cardPad, { gap: spacing.md }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Price details</Text>
            <View style={{ opacity: quoting ? 0.5 : 1 }}>
              <PriceBreakdown pricing={quote.pricing} roomKind={quote.roomKind} couponCode={appliedCoupon?.code} />
            </View>
            <CouponField
              applied={appliedCoupon ? { code: appliedCoupon.code, discount: appliedCoupon.discount, description: appliedCoupon.description } : null}
              error={couponProblem}
              onApply={applyCoupon}
              onRemove={removeCoupon}
              disabled={busy}
            />
            <CancellationNote policy={quote.cancellation} freeUntil={quote.freeCancellationUntil} />
          </View>

          {/* Who's checking in */}
          <View
            style={[card, styles.cardPad]}
            onLayout={(e: LayoutChangeEvent) => {
              formY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Who's checking in?</Text>
            <Text style={[styles.small, muted, { marginBottom: spacing.md }]}>The property gets these details with your booking.</Text>
            <TextInput
              label="Full name *"
              value={values.name}
              onChangeText={(t) => setField('name', t)}
              placeholder="As on your ID"
              autoComplete="name"
              textContentType="name"
              maxLength={80}
              editable={!busy}
              error={errors.name}
            />
            <TextInput
              label="Mobile number *"
              value={values.phone}
              onChangeText={(t) => setField('phone', t)}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={20}
              editable={!busy}
              error={errors.phone}
              hint="Outside India? Start with + and your country code."
              leftIcon={international ? undefined : <Text style={[styles.prefix, muted]}>+91</Text>}
            />
            <TextInput
              label="Email *"
              value={values.email}
              onChangeText={(t) => setField('email', t)}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={120}
              editable={!busy}
              error={errors.email}
              hint="For your booking voucher."
            />

            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Estimated arrival time (optional)</Text>
            <TouchableOpacity
              onPress={() => setArrivalOpen(true)}
              disabled={busy}
              style={[styles.select, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }]}
              accessibilityRole="button"
              accessibilityLabel={`Estimated arrival time: ${values.arrivalTime ? timeLabel(values.arrivalTime) : 'not sure yet'}. Change`}
            >
              <Ionicons name="time-outline" size={17} color={themeColors.textSecondary} />
              <Text style={[styles.selectText, { color: values.arrivalTime ? themeColors.text : themeColors.textTertiary }]}>
                {values.arrivalTime ? timeLabel(values.arrivalTime) : "I'm not sure yet"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
            {stay.policies?.checkInFrom ? (
              <Text style={[styles.small, muted, { marginTop: 4 }]}>Check-in starts at {timeLabel(stay.policies.checkInFrom)}.</Text>
            ) : null}

            <View style={{ height: spacing.md }} />
            <TextInput
              label="Special requests (optional)"
              value={values.specialRequests}
              onChangeText={(t) => setField('specialRequests', t)}
              placeholder="Early check-in, a ground-floor room, a cot for the baby…"
              multiline
              numberOfLines={3}
              maxLength={SPECIAL_REQUESTS_MAX}
              editable={!busy}
              error={errors.specialRequests}
              hint="The property will try, but can't always promise."
              style={styles.textarea}
            />
            <Text style={[styles.counter, { color: themeColors.textTertiary }]}>
              {values.specialRequests.length}/{SPECIAL_REQUESTS_MAX}
            </Text>
            {stay.policies?.minCheckInAge ? (
              <Text style={[styles.small, muted]}>
                The person checking in must be at least {stay.policies.minCheckInAge} and carry a photo ID.
              </Text>
            ) : null}
          </View>

          {/* Terms */}
          <View
            onLayout={(e: LayoutChangeEvent) => {
              termsY.current = e.nativeEvent.layout.y;
            }}
            style={{ gap: spacing.sm }}
          >
            {termsMessage ? (
              <Text style={styles.termsMessage} accessibilityRole="alert">
                {termsMessage}
              </Text>
            ) : null}
            <LegalAcceptanceBlock vertical="stay" value={acceptedLegalDocs} onChange={onTermsChange} />
          </View>

          <View style={{ gap: 6, paddingHorizontal: 2 }}>
            <View style={styles.inlineTop}>
              <Ionicons name="lock-closed-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.small, muted, { flex: 1 }]}>Your rooms are held for {holdMinutes} minutes while you pay.</Text>
            </View>
            <View style={styles.inlineTop}>
              <Ionicons name="shield-checkmark-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.small, muted, { flex: 1 }]}>GST is included in the total. Secure payment by Razorpay.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {keyboardUp ? null : (
        <View
          style={[
            styles.footer,
            { backgroundColor: themeColors.surface, borderTopColor: themeColors.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <Button title={payLabel} onPress={pay} size="lg" fullWidth loading={busy && phase === 'starting'} disabled={busy || quoting} icon={busy ? undefined : <Ionicons name="lock-closed" size={17} color="#fff" />} />
          <Text style={[styles.footerNote, { color: holdSeconds > 0 && holdSeconds < 180 ? colors.error : themeColors.textTertiary }]}>
            {hold && holdShown && holdSeconds > 0
              ? `Rooms held · ${fmtCountdown(holdSeconds)} left to pay`
              : `Rooms held ${holdMinutes} min while you pay · GST included`}
          </Text>
        </View>
      )}

      {phase === 'verifying' ? (
        <View style={[styles.overlay, { backgroundColor: isDarkMode ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.88)' }]} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.overlayTitle, { color: themeColors.text }]}>Confirming your booking…</Text>
          <Text style={[styles.small, muted]}>Please don't close the app.</Text>
        </View>
      ) : null}

      <StaySheet visible={arrivalOpen} title="Estimated arrival time" onClose={() => setArrivalOpen(false)} maxHeight={0.7}>
        {[{ value: '', label: "I'm not sure yet" }, ...TIME_OPTIONS].map((t) => {
          const on = values.arrivalTime === t.value;
          return (
            <TouchableOpacity
              key={t.value || 'none'}
              onPress={() => {
                setField('arrivalTime', t.value);
                setArrivalOpen(false);
              }}
              style={[styles.timeRow, { borderBottomColor: themeColors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.body, { color: on ? brand[600] : themeColors.text }, on && { fontWeight: fontWeight.bold }]}>{t.label}</Text>
              {on ? <Ionicons name="checkmark" size={18} color={brand[600]} /> : null}
            </TouchableOpacity>
          );
        })}
      </StaySheet>
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
  card: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  cardPad: { padding: spacing.lg },
  cover: { width: '100%', height: 140 },
  typeLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  stayName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  inlineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  small: { fontSize: fontSize.xs, lineHeight: 17 },
  body: { fontSize: fontSize.sm, lineHeight: 20 },
  datesGrid: { flexDirection: 'row', gap: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  datesDivider: { width: StyleSheet.hairlineWidth },
  overline: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.6 },
  dateText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },
  facts: { gap: spacing.sm, marginTop: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  prefix: { fontSize: fontSize.md, marginRight: spacing.sm },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectText: { flex: 1, fontSize: fontSize.md },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  counter: { fontSize: 10, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.sm },
  termsMessage: { color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  footerNote: { fontSize: fontSize.xs, textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  overlayTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
