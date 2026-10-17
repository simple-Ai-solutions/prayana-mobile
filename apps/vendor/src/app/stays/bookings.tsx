// Stay bookings for the partner: who's arriving, who's staying, who's been
// and gone, and who cancelled — across every property or one (?stayId=).
// Call or WhatsApp a guest straight from the card. A confirmed booking can be
// marked a no-show from the check-in day, or cancelled by the property with a
// full refund. Ported from the web stays bookings page.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Alert, Linking, ScrollView, TextInput as RNTextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Badge, Button, LoadingSpinner } from '../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme/vendorColors';
import { DEV_BYPASS_AUTH } from '../../config/devFlags';
import { staysAPI } from './_components/api';
import { usePalette, ScreenHeader, SelectField, Sheet, Banner } from './_components/controls';
import { StaySummary, apiError, dayLabel, hasOperations, mealLabel, plural, rupees, timeLabel, whatsappUrl, whenLabel } from './_components/stayConfig';

type Bucket = 'upcoming' | 'past' | 'cancelled' | 'all';
const TABS: { id: Bucket; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];
const EMPTY: Record<Bucket, { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }> = {
  upcoming: { icon: 'calendar-outline', title: 'No upcoming stays yet', text: 'Share your listing with past guests and on WhatsApp or Instagram. Paid bookings show up here right away.' },
  past: { icon: 'checkmark-circle-outline', title: 'No past stays yet', text: 'Stays move here after the guest checks out.' },
  cancelled: { icon: 'close-circle-outline', title: 'No cancellations', text: 'Bookings that you or a guest cancel show up here, with the refund.' },
  all: { icon: 'clipboard-outline', title: 'No bookings yet', text: 'Bookings show up here once a guest pays.' },
};
const STATUS: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'error' | 'default' }> = {
  confirmed: { label: 'Confirmed', variant: 'primary' },
  completed: { label: 'Completed', variant: 'success' },
  no_show: { label: 'No-show', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  payment_pending: { label: 'Awaiting payment', variant: 'default' },
};
const CANCELLED_BY: Record<string, string> = { vendor: 'you', customer: 'the guest', system: 'Prayana' };
const MIN_REASON = 5;

interface StayBooking {
  _id: string;
  reference?: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights?: number;
  units?: number;
  adults?: number;
  childrenAges?: number[];
  guest?: { name?: string; email?: string; phone?: string };
  specialRequests?: string | null;
  arrivalTime?: string | null;
  snapshot?: { stayName?: string; roomTypeName?: string; roomKind?: string; mealPlan?: string };
  pricing?: { total?: number; payable?: number; discount?: number };
  payment?: { paidAt?: string | null; refundedAt?: string | null; refundedAmount?: number | null };
  cancellation?: { cancelledAt?: string | null; cancelledBy?: string | null; reason?: string | null; refundAmount?: number | null };
  createdAt?: string;
}

function guestsLabel(b: StayBooking) {
  const kids = b.childrenAges || [];
  return [
    plural(b.adults || 0, 'adult'),
    kids.length ? `${plural(kids.length, 'child', 'children')} (age${kids.length === 1 ? '' : 's'} ${kids.join(', ')})` : null,
  ]
    .filter(Boolean)
    .join(', ');
}
function roomLabel(b: StayBooking) {
  const name = b.snapshot?.roomTypeName || 'Room';
  const units = b.units || 1;
  if (b.snapshot?.roomKind === 'dorm') return `${plural(units, 'bed')} in ${name}`;
  return units > 1 ? `${name} × ${units}` : name;
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={15} color={p.c.textTertiary} style={styles.detailIcon} />
      <View style={styles.flex}>
        <Text style={[styles.detailLabel, { color: p.c.textTertiary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: p.c.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function BookingCard({ b, today, busy, onNoShow, onCancel }: { b: StayBooking; today?: string; busy: boolean; onNoShow: (b: StayBooking) => void; onCancel: (b: StayBooking) => void }) {
  const p = usePalette();
  const status = STATUS[b.status] || { label: b.status, variant: 'default' as const };
  const confirmed = b.status === 'confirmed';
  const arrivingToday = confirmed && !!today && b.checkIn === today;
  const stayingNow = confirmed && !!today && b.checkIn < today && b.checkOut > today;
  const c = b.cancellation || {};
  const pay = b.payment || {};
  const stayName = b.snapshot?.stayName || 'your property';
  const phone = b.guest?.phone;

  const paymentLine =
    b.status === 'cancelled'
      ? !(Number(c.refundAmount) > 0)
        ? { text: 'No refund', color: p.c.textTertiary }
        : pay.refundedAt
          ? { text: `Refunded ${rupees(pay.refundedAmount || c.refundAmount)}`, color: p.success }
          : { text: `Refund of ${rupees(c.refundAmount)} on its way`, color: p.warning }
      : pay.paidAt
        ? { text: 'Paid online', color: p.success }
        : { text: 'Not paid', color: p.c.textTertiary };

  const open = (url: string) => Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: "Couldn't open that app" }));

  return (
    <View style={[styles.card, { backgroundColor: p.c.card, borderColor: arrivingToday ? colors.primary[500] : p.c.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={[styles.guestName, { color: p.c.text }]}>{b.guest?.name || 'Guest'}</Text>
          <View style={styles.badges}>
            <Badge label={status.label} variant={status.variant} />
            {arrivingToday ? <Badge label="Arriving today" variant="primary" /> : null}
            {stayingNow ? <Badge label="Staying now" variant="success" /> : null}
          </View>
          <Text style={[styles.small, { color: p.c.textTertiary }]}>
            Ref {b.reference}
            {b.createdAt ? ` · booked ${whenLabel(b.createdAt)}` : ''}
          </Text>
        </View>
        <View style={styles.amount}>
          <Text style={[styles.amountText, { color: p.c.text }]}>{rupees(b.pricing?.total)}</Text>
          <Text style={[styles.small, styles.bold, { color: paymentLine.color }]}>{paymentLine.text}</Text>
        </View>
      </View>

      <View style={[styles.dates, { backgroundColor: p.soft.gray.bg }]}>
        <View style={styles.datesRow}>
          <Ionicons name="calendar" size={15} color={p.brand} />
          <Text style={[styles.datesText, { color: p.c.text }]}>
            {dayLabel(b.checkIn)} → {dayLabel(b.checkOut)}
          </Text>
          <Text style={[styles.small, { color: p.c.textSecondary }]}>· {plural(b.nights || 0, 'night')}</Text>
        </View>
        <Text style={[styles.small, { color: p.c.textSecondary }]}>
          {stayName} · {roomLabel(b)}
        </Text>
      </View>

      <View style={styles.details}>
        <Detail icon="people-outline" label="GUESTS" value={guestsLabel(b)} />
        <Detail icon="restaurant-outline" label="MEALS" value={mealLabel(b.snapshot?.mealPlan)} />
        <Detail icon="time-outline" label="ARRIVAL" value={b.arrivalTime ? `Around ${timeLabel(b.arrivalTime)}` : 'Not given'} />
      </View>

      {b.specialRequests ? (
        <View style={[styles.request, { backgroundColor: p.soft.amber.bg, borderColor: p.soft.amber.border }]}>
          <Text style={[styles.requestText, { color: p.soft.amber.fg }]}>
            <Text style={styles.bold}>Special request: </Text>
            {b.specialRequests}
          </Text>
        </View>
      ) : null}

      {b.status === 'cancelled' ? (
        <Text style={[styles.cancelLine, { color: p.danger }]}>
          Cancelled by {CANCELLED_BY[c.cancelledBy || ''] || 'someone'}
          {c.cancelledAt ? ` on ${whenLabel(c.cancelledAt)}` : ''}
          {c.reason ? `: "${c.reason}".` : '.'}
          {Number(c.refundAmount) > 0 ? ` Guest refund ${rupees(c.refundAmount)}.` : ''}
        </Text>
      ) : null}

      {phone || b.guest?.email || confirmed ? (
        <View style={[styles.actions, { borderTopColor: p.c.border }]}>
          {phone ? (
            <>
              <TouchableOpacity style={[styles.contact, { borderColor: p.c.border }]} onPress={() => open(`tel:${phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${b.guest?.name || 'the guest'} on ${phone}`}>
                <Ionicons name="call-outline" size={16} color={p.brand} />
                <Text style={[styles.contactText, { color: p.c.text }]}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contact, { borderColor: p.c.border }]}
                onPress={() => open(whatsappUrl(phone, `Hi ${b.guest?.name || ''}, this is ${stayName} about your booking ${b.reference}.`))}
                accessibilityRole="button"
                accessibilityLabel={`WhatsApp ${b.guest?.name || 'the guest'}`}
              >
                <Ionicons name="logo-whatsapp" size={16} color={p.success} />
                <Text style={[styles.contactText, { color: p.c.text }]}>WhatsApp</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {b.guest?.email ? (
            <TouchableOpacity style={[styles.contact, { borderColor: p.c.border }]} onPress={() => open(`mailto:${b.guest?.email}`)} accessibilityRole="button" accessibilityLabel={`Email ${b.guest.email}`}>
              <Ionicons name="mail-outline" size={16} color={p.brand} />
              <Text style={[styles.contactText, { color: p.c.text }]}>Email</Text>
            </TouchableOpacity>
          ) : null}
          {confirmed ? (
            <View style={styles.ownerActions}>
              {today && b.checkIn <= today ? (
                <TouchableOpacity style={[styles.contact, { borderColor: p.c.border }]} onPress={() => onNoShow(b)} disabled={busy} accessibilityRole="button" accessibilityLabel="Mark as a no-show">
                  <Ionicons name="person-remove-outline" size={16} color={p.warning} />
                  <Text style={[styles.contactText, { color: p.c.text }]}>No-show</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.contact, { borderColor: p.soft.red.border }]} onPress={() => onCancel(b)} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel booking">
                <Ionicons name="close-circle-outline" size={16} color={p.danger} />
                <Text style={[styles.contactText, { color: p.danger }]}>{busy ? 'Working…' : 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CancelSheet({ booking, onClose, onDone }: { booking: StayBooking | null; onClose: () => void; onDone: (message: string) => void }) {
  const p = usePalette();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < MIN_REASON;
  // The server refunds what the guest paid (after any Prayana coupon).
  const refund = booking?.payment?.paidAt ? booking.pricing?.payable ?? booking.pricing?.total : 0;

  useEffect(() => {
    setReason('');
    setError(null);
    setBusy(false);
  }, [booking?._id]);

  const run = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = await staysAPI.vendorCancelBooking(booking._id, reason.trim());
      if (res?.success === false) throw new Error(res.message);
      onDone(res?.message || 'Booking cancelled. The guest gets a full refund.');
    } catch (e) {
      setError(apiError(e, "Couldn't cancel the booking. Try again."));
      setBusy(false);
    }
  };
  const submit = () => {
    if (tooShort) return setError('Tell the guest why (a sentence is enough)');
    Alert.alert('Cancel this booking?', `${booking?.guest?.name || 'The guest'} gets a full refund of ${rupees(refund)}. This can't be undone.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Sheet
      visible={!!booking}
      title={`Cancel ${booking?.guest?.name ? `${booking.guest.name}'s` : 'this'} booking?`}
      subtitle={booking ? `${booking.reference} · ${dayLabel(booking.checkIn)} → ${dayLabel(booking.checkOut)}` : undefined}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button title="Cancel booking" variant="danger" onPress={submit} loading={busy} disabled={tooShort} fullWidth />
          <Button title="Keep the booking" variant="ghost" onPress={onClose} disabled={busy} fullWidth />
        </>
      }
    >
      <Banner tone="red">{`The guest gets a full refund of ${rupees(refund)}. Cancelling hurts your listing — use it only if you truly can't host them.`}</Banner>
      <Text style={[styles.fieldLabel, { color: p.c.text }]}>Reason (we send it to the guest)</Text>
      <RNTextInput
        value={reason}
        onChangeText={(t) => {
          setReason(t);
          if (error) setError(null);
        }}
        multiline
        maxLength={500}
        textAlignVertical="top"
        placeholder="e.g. A water pipe burst and the room can't be used that week."
        placeholderTextColor={p.c.textTertiary}
        accessibilityLabel="Reason for cancelling"
        style={[styles.textarea, { color: p.c.text, borderColor: error ? p.danger : p.c.fieldBorder, backgroundColor: p.c.field }]}
      />
      <Text style={[styles.small, { color: error ? p.danger : p.c.textTertiary }]}>{error || `At least ${MIN_REASON} characters.`}</Text>
    </Sheet>
  );
}

export default function StayBookingsScreen() {
  const params = useLocalSearchParams<{ stayId?: string }>();
  const router = useRouter();
  const p = usePalette();
  const [stayId, setStayId] = useState<string>(params.stayId ? String(params.stayId) : '');
  const [bucket, setBucket] = useState<Bucket>('upcoming');
  const [list, setList] = useState<StayBooking[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [today, setToday] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stays, setStays] = useState<StaySummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<StayBooking | null>(null);
  const reqRef = useRef(0);

  // Properties for the filter: a stay that was never approved can't have bookings.
  useEffect(() => {
    staysAPI
      .listMine()
      .then((res) => setStays((res?.data || []).filter(hasOperations)))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (nextPage = 1) => {
      const req = ++reqRef.current;
      if (nextPage > 1) setLoadingMore(true);
      try {
        const res = await staysAPI.vendorBookings({ bucket, stayId: stayId || undefined, page: nextPage });
        if (req !== reqRef.current) return;
        if (res?.success === false) throw new Error(res.message);
        const data: StayBooking[] = Array.isArray(res?.data) ? res.data : [];
        setList((prev) => (nextPage > 1 ? [...prev, ...data] : data));
        setPage(res?.page || nextPage);
        setPages(res?.pages || 1);
        setCounts(res?.counts || null);
        setToday(res?.today);
        setError(null);
      } catch (e) {
        if (req !== reqRef.current) return;
        if (!DEV_BYPASS_AUTH) setError(apiError(e, "Couldn't load bookings"));
      } finally {
        if (req === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [bucket, stayId],
  );

  useEffect(() => {
    setLoading(true);
    setList([]);
    load(1);
  }, [load]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) loadRef.current(1);
      focusedOnce.current = true;
    }, []),
  );

  const markNoShow = (b: StayBooking) =>
    Alert.alert('Mark as a no-show?', `Only if ${b.guest?.name || 'the guest'} didn't arrive. Nights from tomorrow go back on sale, and the guest isn't refunded.`, [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Mark no-show',
        style: 'destructive',
        onPress: async () => {
          setBusyId(b._id);
          try {
            const res = await staysAPI.vendorMarkNoShow(b._id);
            if (res?.success === false) throw new Error(res.message);
            Toast.show({ type: 'success', text1: res?.message || 'Marked as a no-show' });
            load(1);
          } catch (e) {
            Toast.show({ type: 'error', text1: "Couldn't mark the no-show", text2: apiError(e, 'Try again.') });
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/stays'));
  const selectedStay = stays.find((s) => s._id === stayId);
  const empty = EMPTY[bucket];

  const stat = (icon: keyof typeof Ionicons.glyphMap, label: string, value: number | undefined, tone: 'blue' | 'violet' | 'green' | 'amber') => (
    <View style={[styles.stat, { backgroundColor: p.c.surface, borderColor: p.c.border }]} accessible accessibilityLabel={`${label}: ${value ?? 0}`}>
      <View style={[styles.statIcon, { backgroundColor: p.soft[tone].bg }]}>
        <Ionicons name={icon} size={16} color={p.soft[tone].fg} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.small, { color: p.c.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.statValue, { color: p.c.text }]}>{value ?? 0}</Text>
      </View>
    </View>
  );

  const header = (
    <View>
      {counts ? (
        <View style={styles.stats}>
          {stat('log-in-outline', 'Arriving today', counts.arrivingToday, 'blue')}
          {stat('calendar-outline', 'Upcoming', counts.upcoming, 'violet')}
          {stat('checkmark-circle-outline', 'Completed', counts.past, 'green')}
          {stat('close-circle-outline', 'Cancelled', counts.cancelled, 'amber')}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => {
          const on = t.id === bucket;
          const n = counts?.[t.id];
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setBucket(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.label}${n != null ? `, ${n}` : ''}`}
              style={[styles.tab, { borderColor: on ? colors.primary[500] : p.c.border, backgroundColor: on ? colors.primary[500] : p.c.surface }]}
            >
              <Text style={[styles.tabText, { color: on ? '#fff' : p.c.text }]}>{t.label}</Text>
              {n != null ? (
                <View style={[styles.tabCount, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : p.soft.gray.bg }]}>
                  <Text style={[styles.tabCountText, { color: on ? '#fff' : p.c.textSecondary }]}>{n}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {stays.length > 1 || stayId ? (
        <View style={styles.filter}>
          <SelectField
            compact
            sheetTitle="Property"
            value={stayId}
            options={[
              { value: '', label: 'All properties' },
              ...stays.map((s) => ({ value: s._id, label: s.name || 'Unnamed property' })),
              ...(stayId && !selectedStay ? [{ value: stayId, label: 'This property' }] : []),
            ]}
            onChange={setStayId}
          />
        </View>
      ) : null}

      {error ? (
        <Banner tone="red" style={styles.gap}>
          <Text style={{ color: p.soft.red.fg, fontSize: fontSize.sm }}>
            {error}{' '}
            <Text style={styles.bold} onPress={() => { setLoading(true); load(1); }} accessibilityRole="button">
              Try again
            </Text>
          </Text>
        </Banner>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top']}>
      <ScreenHeader
        title="Stay bookings"
        subtitle={selectedStay?.name || null}
        onBack={back}
        right={
          stayId ? (
            <TouchableOpacity onPress={() => router.push(`/stays/${stayId}/calendar`)} accessibilityRole="button" accessibilityLabel="Rates and availability" hitSlop={8} style={styles.headerIcon}>
              <Ionicons name="calendar-outline" size={22} color={p.brand} />
            </TouchableOpacity>
          ) : null
        }
      />
      <FlatList
        data={loading ? [] : list}
        keyExtractor={(b) => b._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => <BookingCard b={item} today={today} busy={busyId === item._id} onNoShow={markNoShow} onCancel={setCancelTarget} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? (
            <LoadingSpinner />
          ) : !error ? (
            <View style={[styles.empty, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
              <Ionicons name={empty.icon} size={30} color={p.c.textTertiary} />
              <Text style={[styles.emptyTitle, { color: p.c.text }]}>{empty.title}</Text>
              <Text style={[styles.emptyText, { color: p.c.textSecondary }]}>{empty.text}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !loading && page < pages ? (
            <Button title="Load more" variant="outline" onPress={() => load(page + 1)} loading={loadingMore} style={styles.more} />
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary[500]} />}
      />
      <CancelSheet
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={(message) => {
          setCancelTarget(null);
          Toast.show({ type: 'success', text1: 'Booking cancelled', text2: message });
          load(1);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: fontWeight.semibold },
  small: { fontSize: fontSize.xs, lineHeight: 16 },
  gap: { marginBottom: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  stat: { flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  statIcon: { width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36 },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tabCount: { borderRadius: 999, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  tabCountText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  filter: { marginBottom: spacing.md },

  card: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  guestName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  amount: { alignItems: 'flex-end' },
  amountText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  dates: { borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md, gap: 2 },
  datesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  datesText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  details: { marginTop: spacing.md, gap: spacing.sm },
  detail: { flexDirection: 'row', gap: spacing.sm },
  detailIcon: { marginTop: 2 },
  detailLabel: { fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 0.4 },
  detailValue: { fontSize: fontSize.sm },
  request: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  requestText: { fontSize: fontSize.sm, lineHeight: 19 },
  cancelLine: { fontSize: fontSize.sm, lineHeight: 19, marginTop: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md },
  ownerActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, minHeight: 38 },
  contactText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  empty: { alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing['2xl'], gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  emptyText: { fontSize: fontSize.sm, lineHeight: 19, textAlign: 'center' },
  more: { marginTop: spacing.lg },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginTop: spacing.md, marginBottom: spacing.xs },
  textarea: { borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.md, minHeight: 96, fontSize: fontSize.md },
});
