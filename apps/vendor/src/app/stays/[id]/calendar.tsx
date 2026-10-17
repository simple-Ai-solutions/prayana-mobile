// Rates & availability for one stay: the next 60 nights of each room type
// (price, rooms free, bookings here and on other sites, closed nights) and
// the day-to-day changes an owner makes — a festival price, closing nights,
// rooms out for repair. Tap a night, then another for a range, then act on
// it from the sheet. Ported from the web calendar page's phone day list.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, LoadingSpinner } from '../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../theme/vendorColors';
import { staysAPI, CalendarChange } from '../_components/api';
import { usePalette, Palette, ScreenHeader, Banner, Sheet, SwitchRow, RupeeInput, NumberStepper, LinkButton } from '../_components/controls';
import {
  addDays,
  apiError,
  dayLabel,
  dayOfMonth,
  daysBetween,
  monthLong,
  plural,
  rangeLabel,
  rupees,
  todayIST,
  unitNoun,
  weekdayShort,
} from '../_components/stayConfig';

const DAYS = 60;
const MAX_PRICE = 1000000;

interface Cell {
  date: string;
  booked: number;
  blocked: number;
  externalBooked?: number;
  closed: boolean;
  priceOverride: number | null;
  price: number | null;
  weekend: boolean;
  free: number;
  past: boolean;
}

interface CalRoomType {
  _id: string;
  name: string;
  kind: string;
  capacity: number;
  price: { perNight: number | null; weekendPerNight: number | null };
  cells: Cell[];
}

interface CalData {
  from: string;
  days: number;
  today: string;
  roomTypes: CalRoomType[];
}

interface Selection {
  anchor: string;
  from: string;
  to: string;
  picking: boolean;
}

const order = (a: string, b: string) => (a <= b ? { from: a, to: b } : { from: b, to: a });
const inRange = (sel: Selection | null, date: string) => !!sel && date >= sel.from && date <= sel.to;

function priceKind(cell: Cell, rt: CalRoomType) {
  if (cell.priceOverride != null) return 'override';
  if (cell.weekend && Number(rt.price?.weekendPerNight) > 0) return 'weekend';
  return 'base';
}

function cellLabel(cell: Cell, rt: CalRoomType) {
  const noun = unitNoun(rt);
  const kind = priceKind(cell, rt);
  return [
    dayLabel(cell.date),
    cell.price ? `${rupees(cell.price)}${kind === 'override' ? ' (your custom price)' : kind === 'weekend' ? ' (weekend price)' : ''}` : 'no price',
    cell.closed ? 'closed' : cell.free === 0 ? 'sold out' : `${cell.free} of ${rt.capacity} free`,
    cell.booked ? `${cell.booked} booked` : null,
    cell.externalBooked ? `${cell.externalBooked} sold on other sites` : null,
    cell.blocked ? `${plural(cell.blocked, noun)} out of service` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function DayRow({ cell, rt, today, selected, edge, onPress, p }: { cell: Cell; rt: CalRoomType; today: string; selected: boolean; edge: boolean; onPress: () => void; p: Palette }) {
  const kind = priceKind(cell, rt);
  const noun = unitNoun(rt);
  const bg = edge ? p.soft.blue.bg : selected ? p.soft.blue.bg : cell.closed ? p.soft.gray.bg : p.c.surface;
  const border = edge ? colors.primary[500] : selected ? p.soft.blue.border : p.c.border;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={cellLabel(cell, rt)}
      style={[styles.day, { backgroundColor: bg, borderColor: border }, edge && styles.dayEdge]}
    >
      <View style={styles.dayDate}>
        <Text style={[styles.dayWeek, { color: cell.weekend ? (p.dark ? '#c4b5fd' : '#7c3aed') : p.c.textTertiary }]}>
          {cell.date === today ? 'TODAY' : weekdayShort(cell.date).toUpperCase()}
        </Text>
        <Text style={[styles.dayNum, { color: p.c.text }]}>{dayOfMonth(cell.date)}</Text>
      </View>
      <View style={styles.dayMid}>
        {kind === 'override' ? (
          <View style={styles.overridePill}>
            <Text style={styles.overrideText}>{rupees(cell.price)}</Text>
          </View>
        ) : (
          <View style={styles.priceRow}>
            {kind === 'weekend' ? <View style={[styles.weekendDot, { backgroundColor: p.dark ? '#a78bfa' : '#8b5cf6' }]} /> : null}
            <Text style={[styles.price, { color: cell.price ? p.c.text : p.c.textTertiary }]}>{cell.price ? rupees(cell.price) : 'No price'}</Text>
          </View>
        )}
        {cell.booked > 0 || cell.blocked > 0 || (cell.externalBooked || 0) > 0 ? (
          <View style={styles.subRow}>
            {cell.booked > 0 ? <Text style={[styles.sub, { color: p.success }]}>{cell.booked} booked</Text> : null}
            {(cell.externalBooked || 0) > 0 ? (
              <Text style={[styles.sub, { color: p.soft.violet.fg }]}>{cell.externalBooked} sold elsewhere</Text>
            ) : null}
            {cell.blocked > 0 ? (
              <View style={styles.subIcon}>
                <Ionicons name="construct-outline" size={11} color={p.c.textTertiary} />
                <Text style={[styles.sub, { color: p.c.textTertiary }]}>{plural(cell.blocked, noun)} out of service</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.dayRight}>
        {cell.closed ? (
          <>
            <Ionicons name="lock-closed" size={13} color={p.c.textSecondary} />
            <Text style={[styles.left, styles.bold, { color: p.c.textSecondary }]}>Closed</Text>
          </>
        ) : cell.free === 0 ? (
          <Text style={[styles.left, styles.bold, { color: p.danger }]}>Sold out</Text>
        ) : (
          <Text style={[styles.left, { color: p.c.textSecondary }]}>
            <Text style={[styles.bold, { color: p.c.text }]}>{cell.free}</Text> of {rt.capacity} free
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ActionsSheet({
  visible,
  sel,
  rt,
  roomTypes,
  applyAll,
  onApplyAll,
  busy,
  onApply,
  onClose,
  onClear,
}: {
  visible: boolean;
  sel: Selection;
  rt: CalRoomType;
  roomTypes: CalRoomType[];
  applyAll: boolean;
  onApplyAll: (v: boolean) => void;
  busy: string | null;
  onApply: (key: string, change: Partial<CalendarChange>) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const p = usePalette();
  const inView = rt.cells.filter((c) => c.date >= sel.from && c.date <= sel.to);
  const first = inView[0];
  const [price, setPrice] = useState<number | null>(first?.priceOverride ?? null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<number>(first?.blocked ?? 0);
  const nights = daysBetween(sel.from, sel.to) + 1;
  const noun = applyAll ? 'room' : unitNoun(rt);
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  const maxBlocked = applyAll ? Math.max(0, ...roomTypes.map((r) => r.capacity || 0)) : rt.capacity || 0;
  const closedInView = inView.filter((c) => c.closed).length;
  const customInView = inView.filter((c) => c.priceOverride != null).length;
  const isBusy = !!busy;

  const savePrice = () => {
    if (!price || price <= 0) return setPriceError('Enter a price');
    if (price > MAX_PRICE) return setPriceError(`Up to ${rupees(MAX_PRICE)} a night`);
    setPriceError(null);
    onApply('price', { priceOverride: price });
  };

  return (
    <Sheet
      visible={visible}
      title={sel.from === sel.to ? dayLabel(sel.from) : `${dayLabel(sel.from)} → ${dayLabel(sel.to)}`}
      subtitle={[
        plural(nights, 'night'),
        closedInView ? `${closedInView} closed` : null,
        customInView ? `${customInView} with a custom price` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      onClose={onClose}
      footer={<Button title="Clear selection" variant="ghost" onPress={onClear} fullWidth />}
    >
      {roomTypes.length > 1 ? (
        <SwitchRow
          label="Apply to all room types"
          hint={applyAll ? `Changes all ${roomTypes.length} room types` : `Changes only ${rt.name}`}
          value={applyAll}
          onChange={onApplyAll}
          disabled={isBusy}
        />
      ) : null}

      <View style={[styles.block, { borderTopColor: p.c.border }]}>
        <Text style={[styles.blockTitle, { color: p.c.text }]}>Price</Text>
        <Text style={[styles.blockHint, { color: p.c.textSecondary }]}>
          {applyAll
            ? 'Every room type gets this price on these nights.'
            : rt.price?.perNight
              ? `Normal price ${rupees(rt.price.perNight)}${rt.price.weekendPerNight ? `, Fri & Sat ${rupees(rt.price.weekendPerNight)}` : ''} per ${noun}.`
              : 'No normal price set yet.'}
        </Text>
        <RupeeInput
          label="Price for these nights"
          unit={`/ ${noun} / night`}
          value={price}
          onChange={(v) => {
            setPrice(v);
            if (priceError) setPriceError(null);
          }}
          error={priceError}
        />
        <View style={styles.btnRow}>
          <Button title="Set price" size="sm" onPress={savePrice} loading={busy === 'price'} disabled={isBusy} style={styles.flex} />
          <Button
            title="Normal price"
            size="sm"
            variant="outline"
            onPress={() => onApply('reset', { priceOverride: null })}
            loading={busy === 'reset'}
            disabled={isBusy}
            icon={<Ionicons name="arrow-undo-outline" size={15} color={colors.primary[500]} />}
            style={styles.flex}
          />
        </View>
      </View>

      <View style={[styles.block, { borderTopColor: p.c.border }]}>
        <Text style={[styles.blockTitle, { color: p.c.text }]}>Open or close</Text>
        <Text style={[styles.blockHint, { color: p.c.textSecondary }]}>Closed nights can't be booked. Bookings you already have stay as they are.</Text>
        <View style={styles.btnRow}>
          <Button
            title="Close (stop sell)"
            size="sm"
            variant="outline"
            onPress={() => onApply('close', { closed: true })}
            loading={busy === 'close'}
            disabled={isBusy}
            icon={<Ionicons name="lock-closed-outline" size={15} color={colors.primary[500]} />}
            style={styles.flex}
          />
          <Button
            title="Open"
            size="sm"
            variant="outline"
            onPress={() => onApply('open', { closed: false })}
            loading={busy === 'open'}
            disabled={isBusy}
            icon={<Ionicons name="lock-open-outline" size={15} color={colors.primary[500]} />}
            style={styles.flex}
          />
        </View>
      </View>

      <View style={[styles.block, { borderTopColor: p.c.border }]}>
        <Text style={[styles.blockTitle, { color: p.c.text }]}>{Noun}s out of service</Text>
        <Text style={[styles.blockHint, { color: p.c.textSecondary }]}>e.g. under repair or kept for family. Guests can't book these {noun}s.</Text>
        <NumberStepper
          label={`${Noun}s out of service`}
          hint={applyAll ? "Capped at each room type's own count" : `${rt.capacity || 0} ${noun}s in total`}
          value={blocked}
          onChange={setBlocked}
          min={0}
          max={maxBlocked}
        />
        <Button title="Save" size="sm" variant="outline" onPress={() => onApply('blocked', { blocked })} loading={busy === 'blocked'} disabled={isBusy} />
      </View>
    </Sheet>
  );
}

function Legend({ noun }: { noun: string }) {
  const p = usePalette();
  return (
    <View style={[styles.legend, { borderColor: p.c.border }]}>
      <View style={styles.legendItem}>
        <View style={styles.overridePillSm} />
        <Text style={[styles.legendText, { color: p.c.textSecondary }]}>Your custom price</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.weekendDot, { backgroundColor: p.dark ? '#a78bfa' : '#8b5cf6' }]} />
        <Text style={[styles.legendText, { color: p.c.textSecondary }]}>Weekend price</Text>
      </View>
      <View style={styles.legendItem}>
        <Ionicons name="lock-closed" size={11} color={p.c.textSecondary} />
        <Text style={[styles.legendText, { color: p.c.textSecondary }]}>Closed</Text>
      </View>
      <View style={styles.legendItem}>
        <Text style={[styles.legendText, { color: p.soft.violet.fg }]}>Sold elsewhere</Text>
        <Text style={[styles.legendText, { color: p.c.textSecondary }]}>= {noun}s booked on synced sites</Text>
      </View>
    </View>
  );
}

type Row = { type: 'month'; key: string; label: string } | { type: 'day'; key: string; cell: Cell };

export default function StayCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stayId = String(id);
  const router = useRouter();
  const p = usePalette();

  const [stay, setStay] = useState<{ name?: string; status?: string } | null>(null);
  const [from, setFrom] = useState(() => todayIST());
  const [data, setData] = useState<CalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rtId, setRtId] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    staysAPI
      .getMine(stayId)
      .then((res) => setStay(res?.data || null))
      .catch(() => {});
  }, [stayId]);

  const load = useCallback(async () => {
    try {
      const res = await staysAPI.getCalendar(stayId, { from, days: DAYS });
      if (res?.success === false) throw new Error(res.message);
      setData(res?.data || null);
      setError(null);
    } catch (e) {
      setError(apiError(e, "Couldn't load the calendar"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stayId, from]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Calendar sync (or a booking) may have changed nights; refresh on return.
  const loadRef = useRef(load);
  loadRef.current = load;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) loadRef.current();
      focusedOnce.current = true;
    }, []),
  );

  const today = data?.today || todayIST();
  const roomTypes = data?.roomTypes || [];
  const rt = roomTypes.find((r) => String(r._id) === rtId) || roomTypes[0] || null;

  const rows = useMemo<Row[]>(() => {
    const cells = (rt?.cells || []).filter((c) => !c.past);
    const out: Row[] = [];
    cells.forEach((c, i) => {
      if (i === 0 || c.date.slice(0, 7) !== cells[i - 1].date.slice(0, 7)) out.push({ type: 'month', key: `m-${c.date.slice(0, 7)}`, label: monthLong(c.date) });
      out.push({ type: 'day', key: c.date, cell: c });
    });
    return out;
  }, [rt]);

  const pick = (date: string) => {
    if (date < today) return;
    if (!sel || !sel.picking) setSel({ anchor: date, from: date, to: date, picking: true });
    else if (date === sel.anchor) setSel({ ...sel, picking: false });
    else setSel({ anchor: sel.anchor, ...order(sel.anchor, date), picking: false });
  };
  const clear = () => {
    setSel(null);
    setSheetOpen(false);
  };

  const apply = async (key: string, change: Partial<CalendarChange>) => {
    if (!sel || !rt) return;
    setBusy(key);
    try {
      const res = await staysAPI.updateCalendar(stayId, { roomTypeIds: applyAll ? 'all' : [String(rt._id)], from: sel.from, to: sel.to, ...change });
      if (res?.success === false) throw new Error(res.message);
      Toast.show({ type: 'success', text1: res?.message || 'Calendar updated' });
      clear();
      load();
    } catch (e) {
      // 403 for team roles that can't change prices: the server says so.
      Toast.show({ type: 'error', text1: "Couldn't update the calendar", text2: apiError(e, 'Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const shift = (n: number) => {
    const next = addDays(from, n);
    setFrom(next < todayIST() ? todayIST() : next);
    setSel(null);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/stays/${stayId}`));
  const notLive = stay && stay.status !== 'published';

  const header = (
    <View>
      {notLive ? (
        <Banner tone="amber" style={styles.gap}>
          Not live yet. Guests can book once we approve it, but you can set prices and close dates now.
        </Banner>
      ) : null}
      <View style={styles.linksRow}>
        <LinkButton compact icon="sync-outline" label="Calendar sync" onPress={() => router.push(`/stays/${stayId}/sync`)} />
        <LinkButton compact icon="clipboard-outline" label="Bookings" onPress={() => router.push(`/stays/bookings?stayId=${stayId}`)} />
      </View>

      {roomTypes.length > 1 ? (
        <FlatList
          horizontal
          data={roomTypes}
          keyExtractor={(r) => String(r._id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist"
          renderItem={({ item: r }) => {
            const on = rt && r._id === rt._id;
            return (
              <TouchableOpacity
                onPress={() => {
                  setRtId(String(r._id));
                  setSel(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: !!on }}
                accessibilityLabel={`${r.name}, ${plural(r.capacity, unitNoun(r))}`}
                style={[styles.tab, { borderColor: on ? colors.primary[500] : p.c.border, backgroundColor: on ? colors.primary[500] : p.c.surface }]}
              >
                <Text style={[styles.tabText, { color: on ? '#fff' : p.c.text }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={[styles.tabCount, { color: on ? 'rgba(255,255,255,0.8)' : p.c.textTertiary }]}>{r.capacity}</Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : null}

      {rt ? (
        <View style={styles.rtInfo}>
          <Text style={[styles.rtName, { color: p.c.text }]}>{rt.name}</Text>
          <Text style={[styles.rtMeta, { color: p.c.textSecondary }]}>
            {[
              plural(rt.capacity, unitNoun(rt)),
              rt.price?.perNight ? `${rupees(rt.price.perNight)} a night` : 'No price set',
              rt.price?.weekendPerNight ? `Fri & Sat ${rupees(rt.price.weekendPerNight)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => shift(-DAYS)}
              disabled={from <= today}
              accessibilityRole="button"
              accessibilityLabel={`Previous ${DAYS} days`}
              style={[styles.navBtn, { borderColor: p.c.border }, from <= today && styles.disabled]}
            >
              <Ionicons name="chevron-back" size={18} color={p.c.text} />
            </TouchableOpacity>
            <Text style={[styles.range, { color: p.c.text }]} accessibilityLiveRegion="polite">
              {data ? rangeLabel(data.from < today ? today : data.from, addDays(data.from, data.days - 1)) : ''}
            </Text>
            <TouchableOpacity
              onPress={() => shift(DAYS)}
              accessibilityRole="button"
              accessibilityLabel={`Next ${DAYS} days`}
              style={[styles.navBtn, { borderColor: p.c.border }]}
            >
              <Ionicons name="chevron-forward" size={18} color={p.c.text} />
            </TouchableOpacity>
          </View>
          {!sel ? (
            <View style={styles.tip}>
              <Ionicons name="hand-left-outline" size={14} color={p.c.textTertiary} />
              <Text style={[styles.tipText, { color: p.c.textTertiary }]}>Tap a day, then another to pick a range.</Text>
            </View>
          ) : null}
          <Legend noun={unitNoun(rt)} />
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Rates & availability" subtitle={stay?.name || null} onBack={back} />
      {loading && !data ? (
        <LoadingSpinner fullScreen />
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: p.c.text }]}>{error}</Text>
          <Button title="Try again" onPress={() => { setLoading(true); load(); }} />
        </View>
      ) : !roomTypes.length ? (
        <View style={styles.center}>
          <Ionicons name="bed-outline" size={36} color={p.c.textTertiary} />
          <Text style={[styles.errorText, { color: p.c.text }]}>No room types yet</Text>
          <Text style={[styles.tipText, { color: p.c.textSecondary, textAlign: 'center' }]}>Add your rooms and their prices first, then manage each night here.</Text>
          <Button title="Add rooms" onPress={() => router.push(`/stays/${stayId}`)} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          ListHeaderComponent={header}
          extraData={[sel, rt?._id]}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary[500]} />}
          renderItem={({ item }) =>
            item.type === 'month' ? (
              <Text style={[styles.month, { color: p.c.textTertiary }]} accessibilityRole="header">
                {item.label}
              </Text>
            ) : rt ? (
              <DayRow
                cell={item.cell}
                rt={rt}
                today={today}
                selected={inRange(sel, item.cell.date)}
                edge={!!sel && (item.cell.date === sel.from || item.cell.date === sel.to)}
                onPress={() => pick(item.cell.date)}
                p={p}
              />
            ) : null
          }
          ListFooterComponent={error ? <Text style={[styles.tipText, { color: p.danger, marginTop: spacing.md }]}>{error}</Text> : null}
        />
      )}

      {sel && rt ? (
        <View style={[styles.selBar, { backgroundColor: p.c.surface, borderTopColor: p.c.border }]}>
          <View style={styles.flex}>
            <Text style={[styles.selTitle, { color: p.c.text }]} numberOfLines={1}>
              {sel.from === sel.to ? dayLabel(sel.from) : `${dayLabel(sel.from)} → ${dayLabel(sel.to)}`}
            </Text>
            <Text style={[styles.tipText, { color: p.c.textSecondary }]}>
              {plural(daysBetween(sel.from, sel.to) + 1, 'night')}
              {sel.picking ? ' · tap another day for a range' : ''}
            </Text>
          </View>
          <Button title="Clear" variant="ghost" size="sm" onPress={clear} />
          <Button title="Change" size="sm" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}

      {sel && rt ? (
        <ActionsSheet
          key={`${sel.from}|${sel.to}|${rt._id}`}
          visible={sheetOpen}
          sel={sel}
          rt={rt}
          roomTypes={roomTypes}
          applyAll={applyAll}
          onApplyAll={setApplyAll}
          busy={busy}
          onApply={apply}
          onClose={() => setSheetOpen(false)}
          onClear={clear}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: fontWeight.semibold },
  disabled: { opacity: 0.35 },
  gap: { marginBottom: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing['2xl'] },
  errorText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, textAlign: 'center' },

  linksRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36, maxWidth: 260 },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flexShrink: 1 },
  tabCount: { fontSize: fontSize.xs },

  rtInfo: { marginBottom: spacing.sm },
  rtName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  rtMeta: { fontSize: fontSize.xs, marginTop: 2 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  navBtn: { width: 36, height: 36, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  range: { flex: 1, textAlign: 'center', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  tipText: { fontSize: fontSize.xs, lineHeight: 16 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.sm, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11 },

  month: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: spacing.md, marginBottom: spacing.xs, paddingHorizontal: 2 },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: 6, minHeight: 56 },
  dayEdge: { borderWidth: 2 },
  dayDate: { width: 44, alignItems: 'center' },
  dayWeek: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.4 },
  dayNum: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  dayMid: { flex: 1, minWidth: 0 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  weekendDot: { width: 7, height: 7, borderRadius: 4 },
  overridePill: { alignSelf: 'flex-start', backgroundColor: '#2563eb', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  overridePillSm: { width: 16, height: 10, borderRadius: 3, backgroundColor: '#2563eb' },
  overrideText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, marginTop: 2 },
  subIcon: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sub: { fontSize: 11 },
  dayRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  left: { fontSize: fontSize.xs },

  selBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1 },
  selTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  block: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  blockTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  blockHint: { fontSize: fontSize.xs, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
});
