// Trip customisation on the package page, ported from the web's
// ChangeHotelModal / ChangeActivityModal / AddActivityModal / MealBadges and
// fitted to a phone:
//   DayCustomise       — per-day "Change hotel · Add activity · Edit meals"
//   SwapButton         — on an activity the operator marked swappable
//   RequestsSummary    — "Your requests (3)" card above the booking bar
//
// A hotel change switches package option, which the server prices. Activities
// and meals are sent as requests the team confirms (see lib/tripRequests).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { makeAPICall } from '@prayana/shared-services';
import { useTheme } from '@prayana/shared-ui';
import { useTripRequests, requestCount, type MealKey } from '../../lib/tripRequests';

const BLUE = '#2563eb';
const PURPLE = '#7c3aed';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// ─── Shared sheet ────────────────────────────────────────────────────────

function Sheet({ visible, onClose, title, sub, children, footer }: {
  visible: boolean; onClose: () => void; title: string; sub?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const { themeColors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheetWrap} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: themeColors.surface }]}>
          <View style={s.handle} />
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sheetTitle, { color: themeColors.text }]}>{title}</Text>
              {!!sub && <Text style={[s.sheetSub, { color: themeColors.textSecondary }]}>{sub}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={themeColors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>{children}</ScrollView>
          {footer}
        </View>
      </View>
    </Modal>
  );
}

const RequestNote = () => (
  <View style={s.note}>
    <Ionicons name="information-circle-outline" size={15} color="#0369a1" />
    <Text style={s.noteText}>
      Sent to our team with your booking. They confirm it, and any change in price, before you travel — nothing extra is charged now.
    </Text>
  </View>
);

// ─── Change hotel (= switch package option) ──────────────────────────────

type Variant = { name: string; displayName?: string; hotelCategory?: string; pricing?: { basePrice?: number; isOnRequest?: boolean }; hotels?: { name?: string; imageUrl?: string; city?: string }[] };

function HotelSheet({ visible, onClose, variants, current, onPick }: {
  visible: boolean; onClose: () => void; variants: Variant[]; current?: string; onPick: (name: string) => void;
}) {
  const { themeColors } = useTheme();
  const cur = variants.find((v) => v.name === current);
  const base = cur?.pricing?.basePrice || 0;
  return (
    <Sheet visible={visible} onClose={onClose} title="Change hotel" sub="Each option has its own hotels; the price updates with your choice.">
      {variants.map((v) => {
        const on = v.name === current;
        const diff = (v.pricing?.basePrice || 0) - base;
        const hotels = (v.hotels || []).filter((h) => h?.name).slice(0, 3);
        return (
          <Pressable
            key={v.name}
            onPress={() => { onPick(v.name); onClose(); }}
            style={[s.option, { borderColor: on ? BLUE : themeColors.border }, on && { backgroundColor: '#eff6ff' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <View style={s.optionHead}>
              <View style={{ flex: 1 }}>
                <Text style={[s.optionTitle, { color: themeColors.text }]}>{v.displayName || v.name}</Text>
                {!!v.hotelCategory && (
                  <Text style={[s.optionSub, { color: themeColors.textSecondary }]}>
                    {v.hotelCategory.charAt(0).toUpperCase() + v.hotelCategory.slice(1)} hotels
                  </Text>
                )}
              </View>
              {on ? (
                <View style={s.currentPill}><Text style={s.currentText}>Current</Text></View>
              ) : v.pricing?.isOnRequest ? (
                <Text style={[s.diff, { color: themeColors.textSecondary }]}>On request</Text>
              ) : (
                <Text style={[s.diff, { color: diff > 0 ? '#b45309' : '#15803d' }]}>
                  {diff === 0 ? 'Same price' : `${diff > 0 ? '+' : '−'}${inr(Math.abs(diff))}`}
                  {diff !== 0 && <Text style={s.per}> /person</Text>}
                </Text>
              )}
            </View>
            {hotels.length > 0 && (
              <View style={s.hotelList}>
                {hotels.map((h, i) => (
                  <View key={`${h.name}-${i}`} style={s.hotelRow}>
                    {h.imageUrl ? (
                      <Image source={{ uri: h.imageUrl }} style={s.hotelImg} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={[s.hotelImg, s.hotelPh]}><Ionicons name="bed-outline" size={14} color="#9ca3af" /></View>
                    )}
                    <Text style={[s.hotelName, { color: themeColors.text }]} numberOfLines={1}>
                      {h.name}{h.city ? <Text style={{ color: themeColors.textTertiary }}> · {h.city}</Text> : null}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

// ─── Add activity ────────────────────────────────────────────────────────

type Found = { externalId?: string; title: string; price?: number; image?: string; rating?: number; duration?: string };

function AddSheet({ visible, onClose, day, city }: { visible: boolean; onClose: () => void; day: number; city?: string }) {
  const { themeColors } = useTheme();
  const { added, addActivity, removeAdded } = useTripRequests();
  const [list, setList] = useState<Found[] | null>(null);

  useEffect(() => {
    if (!visible || !city || list) return;
    let alive = true;
    makeAPICall(`/activities/viator?city=${encodeURIComponent(city)}&limit=12`)
      .then((r: any) => {
        if (!alive) return;
        setList(((r?.data || []) as any[]).map((a) => ({
          externalId: a.externalId || a._id,
          title: a.title,
          price: a.pricing?.basePrice,
          image: a.images?.find((i: any) => i.isPrimary)?.url || a.images?.[0]?.url,
          rating: a.rating?.average,
          duration: a.duration?.label,
        })));
      })
      .catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [visible, city, list]);

  return (
    <Sheet visible={visible} onClose={onClose} title={`Add to Day ${day}`} sub={city ? `Experiences in and around ${city}` : undefined}>
      <RequestNote />
      {!list ? (
        <ActivityIndicator style={{ marginVertical: 30 }} color={BLUE} />
      ) : list.length === 0 ? (
        <Text style={[s.empty, { color: themeColors.textSecondary }]}>
          No experiences listed for {city || 'this stop'} yet. Mention what you'd like in special requests at checkout.
        </Text>
      ) : list.map((a) => {
        const on = added.some((x) => x.day === day && x.title === a.title);
        return (
          <View key={a.externalId || a.title} style={[s.actRow, { borderColor: on ? BLUE : themeColors.border }]}>
            {a.image ? <Image source={{ uri: a.image }} style={s.actImg} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[s.actImg, s.hotelPh]} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.actTitle, { color: themeColors.text }]} numberOfLines={2}>{a.title}</Text>
              <Text style={[s.actMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {[a.price ? `from ${inr(a.price)}` : null, a.duration, a.rating ? `★ ${a.rating.toFixed(1)}` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pressable
              onPress={() => (on
                ? removeAdded(day, a.title)
                : addActivity({ day, title: a.title, city, externalId: a.externalId, fromPrice: a.price }))}
              style={[s.addBtn, on && { backgroundColor: BLUE, borderColor: BLUE }]}
              accessibilityRole="button"
              accessibilityLabel={on ? `Remove ${a.title}` : `Add ${a.title}`}
            >
              <Ionicons name={on ? 'checkmark' : 'add'} size={16} color={on ? '#fff' : BLUE} />
              <Text style={[s.addText, on && { color: '#fff' }]}>{on ? 'Added' : 'Add'}</Text>
            </Pressable>
          </View>
        );
      })}
    </Sheet>
  );
}

// ─── Edit meals ──────────────────────────────────────────────────────────

const MEALS: MealKey[] = ['breakfast', 'lunch', 'dinner'];
const hasMeal = (m: any) => m === true || !!m?.included;

function MealSheet({ visible, onClose, day, meals }: { visible: boolean; onClose: () => void; day: number; meals: any }) {
  const { themeColors } = useTheme();
  const { meals: req, setMeal } = useTripRequests();
  return (
    <Sheet visible={visible} onClose={onClose} title={`Meals on Day ${day}`} sub="Add a meal the plan leaves out, or skip one you won't need.">
      <RequestNote />
      {MEALS.map((m) => {
        const original = hasMeal(meals?.[m]);
        const wanted = req[day]?.[m] ?? original;
        const changed = wanted !== original;
        return (
          <View key={m} style={[s.mealRow, { borderColor: themeColors.border }]}>
            <Ionicons name={m === 'breakfast' ? 'cafe-outline' : m === 'lunch' ? 'restaurant-outline' : 'moon-outline'} size={18} color={themeColors.text} />
            <View style={{ flex: 1 }}>
              <Text style={[s.mealName, { color: themeColors.text }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              <Text style={[s.actMeta, { color: changed ? '#b45309' : themeColors.textSecondary }]}>
                {changed ? (wanted ? 'Requested' : 'Skip requested') : original ? 'Included' : 'Not included'}
              </Text>
            </View>
            <Pressable
              onPress={() => setMeal(day, m, !wanted, original)}
              style={[s.addBtn, wanted && { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
              accessibilityRole="button"
            >
              <Text style={[s.addText, wanted && { color: '#047857' }]}>{wanted ? 'Skip' : 'Add'}</Text>
            </Pressable>
          </View>
        );
      })}
    </Sheet>
  );
}

// ─── Swap activity ───────────────────────────────────────────────────────

export function SwapButton({ day, activity }: { day: number; activity: any }) {
  const { themeColors } = useTheme();
  const { swapped, swapActivity, undoSwap } = useTripRequests();
  const [open, setOpen] = useState(false);
  const alts: any[] = activity?.alternativeActivities || [];
  if (!activity?.isSwappable || !alts.length) return null;
  const title = activity.title || activity.placeName;
  const chosen = swapped.find((w) => w.day === day && w.from === title);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.inlineBtn} accessibilityRole="button">
        <Ionicons name="swap-horizontal" size={13} color={PURPLE} />
        <Text style={s.inlineText}>{chosen ? `Swapping for ${chosen.to}` : 'Change'}</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Swap this activity" sub={`Instead of ${title}`}>
        <RequestNote />
        {alts.map((a, i) => {
          const name = a.title || a.name;
          const on = chosen?.to === name;
          return (
            <Pressable
              key={`${name}-${i}`}
              onPress={() => { (on ? undoSwap(day, title) : swapActivity({ day, from: title, to: name })); setOpen(false); }}
              style={[s.option, { borderColor: on ? BLUE : themeColors.border }]}
            >
              <Text style={[s.optionTitle, { color: themeColors.text }]}>{name}</Text>
              {!!a.description && <Text style={[s.optionSub, { color: themeColors.textSecondary }]} numberOfLines={2}>{a.description}</Text>}
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}

// ─── Per-day controls ────────────────────────────────────────────────────

export function DayCustomise({ day, city, meals, variants, currentVariant, onPickVariant }: {
  day: number; city?: string; meals?: any;
  variants: Variant[]; currentVariant?: string; onPickVariant: (name: string) => void;
}) {
  const { themeColors } = useTheme();
  const { added, removeAdded, meals: req } = useTripRequests();
  const [sheet, setSheet] = useState<'hotel' | 'add' | 'meals' | null>(null);
  // A hotel change only makes sense where options differ in hotels.
  const hotelChoice = new Set(variants.map((v) => v.hotelCategory || v.name)).size > 1;
  const dayAdded = added.filter((a) => a.day === day);
  const mealChanges = Object.keys(req[day] || {}).length;

  return (
    <View style={[s.dayBar, { borderTopColor: themeColors.border }]}>
      {dayAdded.length > 0 && (
        <View style={{ gap: 6, marginBottom: 10 }}>
          {dayAdded.map((a) => (
            <View key={a.title} style={s.addedRow}>
              <Ionicons name="add-circle" size={15} color={BLUE} />
              <Text style={s.addedText} numberOfLines={1}>{a.title}</Text>
              <Text style={s.addedTag}>REQUESTED</Text>
              <Pressable onPress={() => removeAdded(day, a.title)} hitSlop={8} accessibilityLabel={`Remove ${a.title}`}>
                <Ionicons name="close" size={15} color="#64748b" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayBtns}>
        {hotelChoice && (
          <Pressable onPress={() => setSheet('hotel')} style={[s.dayBtn, { borderColor: themeColors.border }]} accessibilityRole="button">
            <Ionicons name="bed-outline" size={14} color={PURPLE} />
            <Text style={s.dayBtnText}>Change hotel</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setSheet('add')} style={[s.dayBtn, s.dayBtnDashed]} accessibilityRole="button">
          <Ionicons name="add" size={15} color={BLUE} />
          <Text style={[s.dayBtnText, { color: BLUE }]}>Add activity</Text>
        </Pressable>
        {!!meals && (
          <Pressable onPress={() => setSheet('meals')} style={[s.dayBtn, { borderColor: mealChanges ? '#fcd34d' : themeColors.border }]} accessibilityRole="button">
            <Ionicons name="restaurant-outline" size={14} color={PURPLE} />
            <Text style={s.dayBtnText}>{mealChanges ? `Meals · ${mealChanges} change${mealChanges > 1 ? 's' : ''}` : 'Edit meals'}</Text>
          </Pressable>
        )}
      </ScrollView>

      <HotelSheet visible={sheet === 'hotel'} onClose={() => setSheet(null)} variants={variants} current={currentVariant} onPick={onPickVariant} />
      <AddSheet visible={sheet === 'add'} onClose={() => setSheet(null)} day={day} city={city} />
      <MealSheet visible={sheet === 'meals'} onClose={() => setSheet(null)} day={day} meals={meals} />
    </View>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────

export function RequestsSummary({ cardStyle }: { cardStyle: any }) {
  const { themeColors } = useTheme();
  const state = useTripRequests();
  const n = requestCount(state);
  if (!n) return null;
  return (
    <View style={[cardStyle, s.summary, { backgroundColor: themeColors.surface }]}>
      <View style={s.summaryHead}>
        <View style={s.summaryIcon}><Ionicons name="create-outline" size={16} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.summaryTitle, { color: themeColors.text }]}>Your requested changes ({n})</Text>
          <Text style={[s.actMeta, { color: themeColors.textSecondary }]}>Sent with your booking for our team to confirm</Text>
        </View>
        <Pressable onPress={state.reset} hitSlop={8} accessibilityRole="button">
          <Text style={s.reset}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: '800' },
  sheetSub: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  note: { flexDirection: 'row', gap: 6, borderRadius: 10, padding: 10, backgroundColor: '#f0f9ff', marginBottom: 12 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#0c4a6e' },
  empty: { fontSize: 13, textAlign: 'center', marginVertical: 24, lineHeight: 19 },

  option: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionSub: { fontSize: 12, marginTop: 2 },
  currentPill: { borderRadius: 999, backgroundColor: BLUE, paddingHorizontal: 10, paddingVertical: 3 },
  currentText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  diff: { fontSize: 14, fontWeight: '800' },
  per: { fontSize: 10, fontWeight: '500' },
  hotelList: { marginTop: 10, gap: 6 },
  hotelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotelImg: { width: 34, height: 34, borderRadius: 8 },
  hotelPh: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  hotelName: { flex: 1, fontSize: 12.5, fontWeight: '600' },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 8, marginBottom: 8 },
  actImg: { width: 58, height: 58, borderRadius: 10 },
  actTitle: { fontSize: 13.5, fontWeight: '700', lineHeight: 18 },
  actMeta: { fontSize: 11.5, marginTop: 3 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  addText: { fontSize: 12, fontWeight: '700', color: BLUE },

  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  mealName: { fontSize: 14, fontWeight: '700' },

  inlineBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, borderRadius: 8, backgroundColor: '#f5f3ff', paddingHorizontal: 8, paddingVertical: 4 },
  inlineText: { fontSize: 11.5, fontWeight: '700', color: PURPLE },

  dayBar: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  dayBtns: { gap: 8 },
  dayBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dayBtnDashed: { borderStyle: 'dashed', borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  dayBtnText: { fontSize: 12.5, fontWeight: '700', color: PURPLE },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 8 },
  addedText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#1e3a8a' },
  addedTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#b45309' },

  summary: { borderWidth: 1, borderColor: '#fcd34d' },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 14, fontWeight: '800' },
  reset: { fontSize: 12.5, fontWeight: '700', color: '#dc2626' },
});
