// Step 2 — rooms and prices, asked the way owners think about them: AC or
// non-AC, the bed, attached or shared bathroom, how many rooms like this, the
// price for two and the extra-bed charge. The room name writes itself (and
// can be changed). Each price shows what the guest pays and what the vendor
// receives, and odd numbers get a gentle warning instead of a hard error.
// "Have a price list?" reads a photographed tariff card into room types.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { staysAPI } from '../api';
import { Button, TextInput } from '../../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../../theme/vendorColors';
import {
  usePalette,
  Section,
  Banner,
  Chip,
  ChipRow,
  Segmented,
  NumberStepper,
  RupeeInput,
  SwitchRow,
  FieldLabel,
  Sheet,
  ChoiceSheet,
} from '../controls';
import {
  BED_TYPES,
  DORM_TYPES,
  LegalDraft,
  MAX_LICENCE_BYTES,
  MEAL_PLANS,
  PROPERTY_TYPES,
  ROOM_FEATURES,
  RoomType,
  Stay,
  StepProps,
  UploadFile,
  apiError,
  mealLabel,
  newObjectId,
  newRoomType,
  plural,
  roomFromImport,
  roomTypeName,
  roomWarnings,
  rupees,
  sqftToSqm,
  toUploadFile,
} from '../stayConfig';

const MAX_ROOM_TYPES = 30; // same cap as the server

interface Estimate {
  pricePerNight: number;
  gstPercent: number;
  guestPays: number;
  youReceive: number;
  crossesHighSlab?: boolean;
  gstThreshold?: number;
  gstPaidToYou?: number;
  commissionPercent?: number;
  commission?: number;
  gstOnCommission?: number;
  tdsPercent?: number;
  tds?: number;
  tcsPercent?: number;
  tcs?: number;
}

// "Guest pays / you receive" for every room's price, refreshed a moment after
// prices or the GST answer change. A nicety: the form works without it.
function useEarnings(prices: number[], legal: LegalDraft): (Estimate | null)[] {
  const [rows, setRows] = useState<(Estimate | null)[]>([]);
  const anyPrice = prices.some((n) => n > 0);
  const key = JSON.stringify([prices, legal?.gstRegistered === true, legal?.gstin || '']);
  const last = useRef('');
  useEffect(() => {
    if (!anyPrice) return undefined;
    const t = setTimeout(async () => {
      last.current = key;
      try {
        const res: any = await staysAPI.priceEstimate({ prices, gstRegistered: legal?.gstRegistered === true, gstin: legal?.gstin || null });
        if (last.current === key && res?.success !== false) setRows(Array.isArray(res?.data) ? res.data : []);
      } catch {
        // Leave the last estimate up.
      }
    }, 700);
    return () => clearTimeout(t);
    // `key` captures prices and the GST answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return anyPrice ? rows : [];
}

function EarningsLine({ estimate, perBed }: { estimate?: Estimate | null; perBed: boolean }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  if (!estimate) return null;
  const row = (label: string, value: string, strong = false) => (
    <View style={styles.breakRow} key={label}>
      <Text style={[styles.breakLabel, { color: strong ? p.c.text : p.c.textSecondary }, strong && styles.bold]}>{label}</Text>
      <Text style={[styles.breakValue, { color: strong ? p.c.text : p.c.textSecondary }, strong && styles.bold]}>{value}</Text>
    </View>
  );
  return (
    <View style={[styles.earnings, { backgroundColor: p.soft.gray.bg }]}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Guest pays ${rupees(estimate.guestPays)} including GST. You receive about ${rupees(estimate.youReceive)}${perBed ? ' per bed' : ''}. Tap for the breakdown.`}
        style={styles.earnHead}
      >
        <Text style={[styles.earnText, { color: p.c.textSecondary }]}>
          Guest pays <Text style={[styles.bold, { color: p.c.text }]}>{rupees(estimate.guestPays)}</Text> incl. {estimate.gstPercent}% GST
          {' · '}You receive <Text style={[styles.bold, { color: p.success }]}>≈ {rupees(estimate.youReceive)}</Text>
          {perBed ? ' per bed' : ''}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={p.c.textTertiary} />
      </TouchableOpacity>
      {estimate.crossesHighSlab ? (
        <Text style={[styles.earnNote, { color: p.warning }]}>Above {rupees(estimate.gstThreshold)} a night, GST on a room is 18% instead of 5%.</Text>
      ) : null}
      {open ? (
        <View style={[styles.breakdown, { borderTopColor: p.c.border }]}>
          {row('Your price', rupees(estimate.pricePerNight))}
          {Number(estimate.gstPaidToYou) > 0 ? row('GST you collect and file', `+ ${rupees(estimate.gstPaidToYou)}`) : null}
          {row(`Prayana commission (${estimate.commissionPercent}%)`, `− ${rupees(estimate.commission)}`)}
          {row('GST on commission (18%)', `− ${rupees(estimate.gstOnCommission)}`)}
          {row(`TDS (${estimate.tdsPercent}%, claim it back in your ITR)`, `− ${rupees(estimate.tds)}`)}
          {Number(estimate.tcs) > 0 ? row(`GST TCS (${estimate.tcsPercent}%, claim it in your GST return)`, `− ${rupees(estimate.tcs)}`) : null}
          {row('You receive', rupees(estimate.youReceive), true)}
          <Text style={[styles.earnNote, { color: p.c.textTertiary }]}>Estimate for one night. Your payout statement shows the exact figures.</Text>
        </View>
      ) : null}
    </View>
  );
}

function RoomTypeEditor({
  rt,
  total,
  estimate,
  isEntire,
  allowDorm,
  onChange,
  onRemove,
  onDuplicate,
}: {
  rt: RoomType;
  total: number;
  estimate?: Estimate | null;
  isEntire: boolean;
  allowDorm: boolean;
  onChange: (fn: (r: RoomType) => RoomType) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(() => total === 1 || !(Number(rt.price?.perNight) > 0));
  const [editingName, setEditingName] = useState(false);
  const [weekend, setWeekend] = useState(() => !!rt.price?.weekendPerNight);

  const set = (patch: Partial<RoomType>) =>
    onChange((r) => {
      const next = { ...r, ...patch };
      if (!next.nameIsCustom) next.name = roomTypeName(next);
      return next;
    });
  const setPrice = (patch: Partial<RoomType['price']>) => onChange((r) => ({ ...r, price: { ...r.price, ...patch } }));

  const warnings = roomWarnings(rt);
  const isDorm = rt.kind === 'dorm';
  const showExtra = !isDorm && Number(rt.maxOccupancy) > Number(rt.baseOccupancy);
  const summary = isEntire
    ? `Up to ${rt.maxOccupancy} guests`
    : `${plural(rt.count, isDorm ? 'dorm' : 'room')}${isDorm ? ` · ${rt.beds} beds each` : ` · up to ${rt.maxOccupancy} guests`}`;
  const priceText = rt.price?.perNight ? `${rupees(rt.price.perNight)}${isDorm ? ' per bed' : ''}` : 'no price yet';

  return (
    <View style={[styles.roomCard, { borderColor: p.c.border, backgroundColor: p.c.surface }]}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={styles.roomHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${rt.name || 'Room'}. ${summary}. ${priceText}`}
      >
        <View style={styles.flex}>
          <Text style={[styles.roomName, { color: p.c.text }]} numberOfLines={2}>
            {rt.name || 'Room'}
          </Text>
          <Text style={[styles.roomMeta, { color: rt.price?.perNight ? p.c.textSecondary : p.warning }]}>
            {summary} · {priceText}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={p.c.textTertiary} />
      </TouchableOpacity>

      {!open && warnings.length ? (
        <View style={[styles.closedWarn, { borderTopColor: p.c.border }]}>
          <Ionicons name="warning-outline" size={14} color={p.warning} />
          <Text style={[styles.warnText, { color: p.warning }]} numberOfLines={2}>
            {warnings[0]}
          </Text>
        </View>
      ) : null}

      {open ? (
        <View style={[styles.roomBody, { borderTopColor: p.c.border }]}>
          {!isEntire && allowDorm ? (
            <Segmented
              label="Room or dorm"
              value={rt.kind}
              onChange={(kind) =>
                kind &&
                set(
                  kind === 'dorm'
                    ? { kind: 'dorm', bedType: 'bunk', beds: 6, bathroom: 'shared', baseOccupancy: 1, maxOccupancy: 1 }
                    : { kind: 'private', bedType: 'double', beds: 1, baseOccupancy: 2, maxOccupancy: 3 },
                )
              }
              options={[
                { id: 'private', label: 'Private room' },
                { id: 'dorm', label: 'Dorm (sold per bed)' },
              ]}
            />
          ) : null}

          <View style={styles.pairRow}>
            <View>
              <FieldLabel label="Cooling" />
              <Segmented
                label="Cooling"
                value={rt.ac === false ? 'nonac' : 'ac'}
                onChange={(v) => set({ ac: v !== 'nonac' })}
                options={[
                  { id: 'ac', label: 'AC' },
                  { id: 'nonac', label: 'Non-AC' },
                ]}
              />
            </View>
            <View>
              <FieldLabel label="Bathroom" />
              <Segmented
                label="Bathroom"
                value={rt.bathroom === 'shared' ? 'shared' : 'attached'}
                onChange={(v) => v && set({ bathroom: v })}
                options={[
                  { id: 'attached', label: isEntire ? 'Private' : 'Attached' },
                  { id: 'shared', label: 'Shared' },
                ]}
              />
            </View>
          </View>

          <View>
            <FieldLabel label={isEntire ? 'Main bed type' : isDorm ? 'Beds in the dorm' : 'Bed'} />
            <ChipRow>
              {BED_TYPES.filter((b) => (isDorm ? ['bunk', 'single', 'mattress'].includes(b.id) : true)).map((b) => (
                <Chip key={b.id} label={b.label} selected={rt.bedType === b.id} onPress={() => set({ bedType: b.id })} />
              ))}
            </ChipRow>
          </View>

          <View style={[styles.steppers, { backgroundColor: p.soft.gray.bg }]}>
            {isEntire ? (
              <>
                <NumberStepper label="Bedrooms" min={0} max={30} value={rt.bedrooms} onChange={(v) => set({ bedrooms: v })} />
                <NumberStepper label="Beds" min={1} max={40} value={rt.beds} onChange={(v) => set({ beds: v })} />
                <NumberStepper label="Bathrooms" min={0} max={30} value={rt.bathrooms} onChange={(v) => set({ bathrooms: v })} />
                <NumberStepper
                  label="Most guests"
                  min={1}
                  max={40}
                  value={rt.maxOccupancy}
                  onChange={(v) => set({ maxOccupancy: v, baseOccupancy: Math.min(rt.baseOccupancy, v) })}
                />
                <NumberStepper
                  label="Guests in the price"
                  hint="More than this pay the extra-guest charge"
                  min={1}
                  max={rt.maxOccupancy || 40}
                  value={rt.baseOccupancy}
                  onChange={(v) => set({ baseOccupancy: v })}
                />
              </>
            ) : isDorm ? (
              <>
                <NumberStepper label="Beds per dorm" min={2} max={40} value={rt.beds} onChange={(v) => set({ beds: v })} />
                <NumberStepper label="Dorms like this" min={1} max={200} value={rt.count} onChange={(v) => set({ count: v })} />
              </>
            ) : (
              <>
                <NumberStepper label="Rooms like this" hint="How many identical rooms" min={1} max={500} value={rt.count} onChange={(v) => set({ count: v })} />
                <NumberStepper label="Beds in the room" min={1} max={10} value={rt.beds} onChange={(v) => set({ beds: v })} />
                <NumberStepper label="Guests in the price" min={1} max={rt.maxOccupancy || 10} value={rt.baseOccupancy} onChange={(v) => set({ baseOccupancy: v })} />
                <NumberStepper
                  label="Most guests"
                  hint="Including extra beds"
                  min={1}
                  max={12}
                  value={rt.maxOccupancy}
                  onChange={(v) => set({ maxOccupancy: v, baseOccupancy: Math.min(rt.baseOccupancy, v) })}
                />
              </>
            )}
          </View>

          <RupeeInput
            label={
              isDorm
                ? 'Price per bed, per night'
                : isEntire
                  ? 'Price per night'
                  : `Price per night for ${rt.baseOccupancy} guest${rt.baseOccupancy > 1 ? 's' : ''}`
            }
            hint="Before GST. Guests see GST added at checkout."
            value={rt.price?.perNight}
            onChange={(v) => setPrice({ perNight: v })}
            unit={isDorm ? '/ bed / night' : '/ night'}
          />
          {showExtra ? (
            <RupeeInput
              label="Each extra guest"
              hint="Extra bed or mattress, per guest per night. 0 if free."
              value={rt.price?.extraPerson}
              onChange={(v) => setPrice({ extraPerson: v })}
              unit="/ guest / night"
            />
          ) : null}
          <EarningsLine estimate={estimate} perBed={isDorm} />

          <SwitchRow
            label="Friday and Saturday nights cost more"
            value={weekend}
            onChange={(v) => {
              setWeekend(v);
              if (!v) setPrice({ weekendPerNight: null });
            }}
          />
          {weekend ? (
            <RupeeInput label="Weekend price" value={rt.price?.weekendPerNight} onChange={(v) => setPrice({ weekendPerNight: v })} unit={isDorm ? '/ bed / night' : '/ night'} />
          ) : null}

          <View>
            <FieldLabel label="Meals in the price" />
            <Segmented
              label="Meals in the price"
              value={rt.mealPlan || 'room_only'}
              onChange={(v) => v && set({ mealPlan: v })}
              options={MEAL_PLANS.map((m) => ({ id: m.id, label: m.label }))}
            />
          </View>

          <View>
            <FieldLabel label="What's special about it?" optional />
            <ChipRow>
              {ROOM_FEATURES.map((f) => {
                const on = (rt.features || []).includes(f.id);
                return (
                  <Chip
                    key={f.id}
                    label={f.label}
                    selected={on}
                    onPress={() => set({ features: on ? rt.features.filter((x) => x !== f.id) : [...(rt.features || []), f.id] })}
                  />
                );
              })}
            </ChipRow>
          </View>

          <TextInput
            label={isEntire ? 'Size of the place (optional)' : 'Room size (optional)'}
            value={rt.sizeSqft == null ? '' : String(rt.sizeSqft)}
            onChangeText={(t) => {
              const d = t.replace(/[^\d]/g, '').slice(0, 5);
              set({ sizeSqft: d === '' ? null : Number(d) });
            }}
            keyboardType="number-pad"
            placeholder="sq ft"
            hint={rt.sizeSqft ? `${rt.sizeSqft} sq ft ≈ ${sqftToSqm(rt.sizeSqft)} m²` : 'In square feet'}
            containerStyle={styles.noGap}
          />

          {editingName ? (
            <View>
              <TextInput
                label="Room name"
                value={rt.name || ''}
                onChangeText={(t) => onChange((r) => ({ ...r, name: t, nameIsCustom: true }))}
                maxLength={80}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => setEditingName(false)}
                containerStyle={styles.noGap}
              />
              <View style={styles.nameActions}>
                {rt.nameIsCustom ? (
                  <TouchableOpacity
                    onPress={() => {
                      onChange((r) => ({ ...r, nameIsCustom: false, name: roomTypeName(r) }));
                      setEditingName(false);
                    }}
                    accessibilityRole="button"
                    hitSlop={6}
                  >
                    <Text style={[styles.link, { color: p.brand }]}>Use the suggested name</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
                <TouchableOpacity onPress={() => setEditingName(false)} accessibilityRole="button" hitSlop={6}>
                  <Text style={[styles.link, { color: p.brand }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <FieldLabel label="Room name" />
              <TouchableOpacity
                onPress={() => setEditingName(true)}
                style={[styles.nameField, { borderColor: p.c.fieldBorder, backgroundColor: p.c.field }]}
                accessibilityRole="button"
                accessibilityLabel={`Room name: ${rt.name}. Edit name`}
              >
                <Text style={[styles.nameText, { color: p.c.text }]} numberOfLines={1}>
                  {rt.name}
                </Text>
                <Ionicons name="pencil" size={16} color={p.c.textTertiary} />
              </TouchableOpacity>
              <Text style={[styles.hint, { color: p.c.textTertiary }]}>
                {rt.nameIsCustom ? 'Your own name' : 'Written from what you picked. Tap to change.'}
              </Text>
            </View>
          )}

          {warnings.length ? (
            <View style={[styles.warnBox, { backgroundColor: p.soft.amber.bg, borderColor: p.soft.amber.border }]}>
              {warnings.map((w) => (
                <View key={w} style={styles.warnRow}>
                  <Ionicons name="warning-outline" size={14} color={p.soft.amber.fg} style={styles.warnIcon} />
                  <Text style={[styles.warnText, { color: p.soft.amber.fg }]}>{w}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {!isEntire ? (
            <View style={[styles.roomActions, { borderTopColor: p.c.border }]}>
              <TouchableOpacity onPress={onDuplicate} style={styles.roomAction} accessibilityRole="button" accessibilityLabel={`Duplicate ${rt.name}`}>
                <Ionicons name="copy-outline" size={16} color={p.brand} />
                <Text style={[styles.roomActionText, { color: p.brand }]}>Duplicate</Text>
              </TouchableOpacity>
              {total > 1 ? (
                <TouchableOpacity onPress={onRemove} style={styles.roomAction} accessibilityRole="button" accessibilityLabel={`Remove ${rt.name}`}>
                  <Ionicons name="trash-outline" size={16} color={p.danger} />
                  <Text style={[styles.roomActionText, { color: p.danger }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Tariff-card import ───────────────────────────────────────────────────────

interface TariffResult {
  rooms: Record<string, any>[];
  propertyName?: string | null;
  season?: string | null;
  notes?: string[];
}

function tariffDetails(r: Record<string, any>) {
  const isDorm = r.kind === 'dorm';
  const base = Number(r.baseOccupancy) || 0;
  const max = Number(r.maxOccupancy) || base;
  const guests = isDorm ? null : max > base ? `For ${base}, up to ${max} guests` : base ? `For ${plural(base, 'guest')}` : null;
  const bed = BED_TYPES.find((b) => b.id === r.bedType)?.label;
  return [
    isDorm ? 'Dorm (sold per bed)' : null,
    r.ac === false ? 'Non-AC' : 'AC',
    bed ? `${bed} bed` : null,
    guests,
    r.mealPlan ? mealLabel(r.mealPlan) : null,
    Number(r.count) > 1 ? `${r.count} ${isDorm ? 'dorms' : 'rooms'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function tariffPrice(r: Record<string, any>) {
  const unit = r.kind === 'dorm' ? ' per bed / night' : ' / night';
  return [
    r.price?.perNight ? `${rupees(r.price.perNight)}${unit}` : null,
    r.price?.weekendPerNight ? `Fri & Sat ${rupees(r.price.weekendPerNight)}` : null,
    r.price?.extraPerson ? `Extra guest ${rupees(r.price.extraPerson)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function TariffImport({ stay, rooms, onImport }: { stay: Stay; rooms: RoomType[]; onImport: (rooms: RoomType[], mode: 'add' | 'replace') => void }) {
  const p = usePalette();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TariffResult | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // Live (or once-approved) room types carry bookings and calendar settings,
  // so for those we only ever add rooms, never replace them.
  const canReplace = stay.status !== 'published' && !stay.moderation?.approvedAt;
  const placeholder = rooms.every((r) => !(Number(r.price?.perNight) > 0));

  const read = async (file: UploadFile, size?: number | null) => {
    if (size && size > MAX_LICENCE_BYTES) {
      setError('That file is over 10 MB. Try a smaller photo or PDF.');
      return;
    }
    setError(null);
    setReading(true);
    try {
      const res: any = await staysAPI.importTariff(stay._id, file);
      if (res?.success === false) throw new Error(res.message);
      const found: TariffResult | undefined = res?.data;
      if (!found?.rooms?.length) throw new Error("We couldn't find any rooms on that price list.");
      setResult(found);
      setPicked(new Set(found.rooms.map((_, i) => i)));
    } catch (e: any) {
      setError(e?.name === 'AbortError' ? 'That took too long. Try a clearer photo or a smaller file.' : apiError(e, "Couldn't read that price list. Try a clearer photo."));
    } finally {
      setReading(false);
    }
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph your price list.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!r.canceled && r.assets?.[0]) read(toUploadFile(r.assets[0], 'price-list.jpg'), r.assets[0].fileSize);
  };
  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photo access needed', 'Allow photo library access in Settings to pick your price list.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!r.canceled && r.assets?.[0]) read(toUploadFile(r.assets[0], 'price-list.jpg'), r.assets[0].fileSize);
  };
  const fromFiles = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets?.[0]) read(toUploadFile(r.assets[0], 'price-list.pdf'), r.assets[0].size);
  };

  const chosen = (result?.rooms || []).filter((_, i) => picked.has(i));
  const tooMany = rooms.length + chosen.length > MAX_ROOM_TYPES;
  const missingPrice = chosen.filter((r) => r.needsPrice || !(Number(r.price?.perNight) > 0)).length;
  const replaceFirst = canReplace && placeholder;

  const apply = (mode: 'add' | 'replace') => {
    const next = chosen.map(roomFromImport);
    onImport(next, mode);
    setResult(null);
    Toast.show({
      type: 'success',
      text1: `${mode === 'replace' ? 'Replaced your rooms with' : 'Added'} ${plural(next.length, 'room type')}`,
      text2: 'Check each one before you carry on.',
    });
  };
  const replace = () => {
    if (placeholder) return apply('replace');
    Alert.alert('Replace your rooms?', `The ${plural(rooms.length, 'room type')} you've set up will be removed. Their photos move to the property photos.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: () => apply('replace') },
    ]);
  };
  const toggle = (i: number) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <View style={[styles.tariffCard, { borderColor: p.soft.blue.border, backgroundColor: p.soft.blue.bg }]}>
      <View style={styles.tariffHead}>
        <View style={[styles.tariffIcon, { backgroundColor: p.c.surface }]}>
          <Ionicons name="camera-outline" size={20} color={p.brand} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.tariffTitle, { color: p.c.text }]}>Have a price list? Photograph it</Text>
          <Text style={[styles.tariffText, { color: p.c.textSecondary }]}>
            We'll fill in your rooms from your tariff card. You check everything before it's added.
          </Text>
        </View>
      </View>
      {reading ? (
        <View style={styles.readingRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={p.brand} />
          <Text style={[styles.tariffText, { color: p.soft.blue.fg }]}>Reading your price list… (up to a minute)</Text>
        </View>
      ) : (
        <Button
          title={error ? 'Try another photo or file' : 'Add from price list'}
          variant="outline"
          size="sm"
          onPress={() => setSourceOpen(true)}
          icon={<Ionicons name="document-text-outline" size={16} color={colors.primary[500]} />}
        />
      )}
      {error && !reading ? (
        <View style={styles.warnRow} accessibilityRole="alert">
          <Ionicons name="warning-outline" size={14} color={p.danger} style={styles.warnIcon} />
          <Text style={[styles.warnText, { color: p.danger }]}>{error}</Text>
        </View>
      ) : null}

      <ChoiceSheet
        visible={sourceOpen}
        title="Your price list"
        message="A clear, straight photo in good light reads best."
        onClose={() => setSourceOpen(false)}
        options={[
          { label: 'Take a photo', icon: 'camera-outline', onPress: fromCamera },
          { label: 'Choose a photo', icon: 'images-outline', onPress: fromLibrary },
          { label: 'Choose a PDF or file', icon: 'document-outline', onPress: fromFiles },
        ]}
      />

      <Sheet
        visible={!!result}
        title={`We read ${plural(result?.rooms?.length || 0, 'room type')}`}
        subtitle={`${result?.propertyName ? `From the price list of ${result.propertyName}. ` : ''}Untick any you don't want. You can change everything afterwards.`}
        onClose={() => setResult(null)}
        footer={
          <>
            {missingPrice > 0 ? (
              <Text style={[styles.hint, { color: p.warning }]}>{plural(missingPrice, 'room type')} will need a price before you can submit.</Text>
            ) : null}
            {tooMany ? (
              <Text style={[styles.hint, { color: p.danger }]}>
                A property can have up to {MAX_ROOM_TYPES} room types. Untick some{canReplace ? ', or replace your rooms' : ''}.
              </Text>
            ) : null}
            {replaceFirst ? (
              <>
                <Button title={`Use these ${plural(chosen.length, 'room type')}`} onPress={() => apply('replace')} disabled={!chosen.length || chosen.length > MAX_ROOM_TYPES} fullWidth />
                <Button title="Add to my rooms instead" variant="outline" onPress={() => apply('add')} disabled={!chosen.length || tooMany} fullWidth />
              </>
            ) : (
              <>
                <Button title={`Add ${plural(chosen.length, 'room type')}`} onPress={() => apply('add')} disabled={!chosen.length || tooMany} fullWidth />
                {canReplace ? (
                  <Button title="Replace my rooms with these" variant="outline" onPress={replace} disabled={!chosen.length || chosen.length > MAX_ROOM_TYPES} fullWidth />
                ) : null}
              </>
            )}
          </>
        }
      >
        {result?.season ? (
          <Banner tone="blue" style={styles.sheetGap}>{`These prices are for: ${result.season}. Set other seasons on the calendar once you're live.`}</Banner>
        ) : null}
        {(result?.rooms || []).map((r, i) => {
          const on = picked.has(i);
          const price = tariffPrice(r);
          const needsPrice = r.needsPrice || !(Number(r.price?.perNight) > 0);
          return (
            <TouchableOpacity
              key={`${r.name}-${i}`}
              onPress={() => toggle(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${r.name || 'Room'}. ${tariffDetails(r)}. ${needsPrice ? 'Needs a price' : price}`}
              style={[styles.tariffRow, { borderColor: on ? p.soft.blue.border : p.c.border, backgroundColor: on ? p.soft.blue.bg : p.c.surface }]}
            >
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? p.brand : p.c.textTertiary} />
              <View style={styles.flex}>
                <Text style={[styles.tariffRoomName, { color: p.c.text }]}>{r.name || 'Room'}</Text>
                {r.sourceName && r.sourceName !== r.name ? (
                  <Text style={[styles.hint, { color: p.c.textTertiary }]}>On your card: {r.sourceName}</Text>
                ) : null}
                <Text style={[styles.hint, { color: p.c.textSecondary }]}>{tariffDetails(r)}</Text>
                {needsPrice ? (
                  <Text style={[styles.hint, styles.bold, { color: p.warning }]}>No price found. Add it after.</Text>
                ) : (
                  <Text style={[styles.hint, styles.bold, { color: p.c.text }]}>{price}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        {result?.notes?.length ? (
          <View style={[styles.notes, { backgroundColor: p.soft.gray.bg }]}>
            <Text style={[styles.hint, styles.bold, { color: p.c.text }]}>Also on your price list</Text>
            {result.notes.map((n) => (
              <Text key={n} style={[styles.hint, { color: p.c.textSecondary }]}>
                • {n}
              </Text>
            ))}
          </View>
        ) : null}
        <Text style={[styles.hint, styles.sheetGap, { color: p.c.textTertiary }]}>
          Prices should be before GST; guests see GST added at checkout. Check each room's price, beds and guests after adding.
        </Text>
      </Sheet>
    </View>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export default function RoomsStep({ draft, update, stay }: StepProps) {
  const rooms = draft.roomTypes || [];
  const isEntire = draft.rentalMode === 'entire_place';
  const allowDorm = DORM_TYPES.has(draft.propertyType) || PROPERTY_TYPES[draft.propertyType]?.category === 'unique';
  const prices = useMemo(() => rooms.map((r) => Number(r.price?.perNight) || 0), [rooms]);
  const estimates = useEarnings(prices, draft.legal);
  const photoCount = (roomId: string) => (stay.photos || []).filter((ph) => String(ph.roomTypeId) === String(roomId)).length;
  const full = rooms.length >= MAX_ROOM_TYPES;

  const changeRoom = (id: string) => (fn: (r: RoomType) => RoomType) =>
    update((d) => ({ roomTypes: d.roomTypes.map((r) => (r._id === id ? fn(r) : r)) }));
  const addRoom = (kind: 'private' | 'dorm') => update((d) => ({ roomTypes: [...d.roomTypes, newRoomType(kind)] }));
  const removeRoom = (rt: RoomType) => {
    const n = photoCount(rt._id);
    Alert.alert(
      'Remove this room type?',
      n ? `Its ${plural(n, 'photo')} will move to the property photos.` : rt.name,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => update((d) => ({ roomTypes: d.roomTypes.filter((r) => r._id !== rt._id) })) },
      ],
    );
  };
  const duplicateRoom = (rt: RoomType) =>
    update((d) => {
      const i = d.roomTypes.findIndex((r) => r._id === rt._id);
      const copy: RoomType = { ...JSON.parse(JSON.stringify(d.roomTypes[i])), _id: newObjectId() };
      if (copy.nameIsCustom) copy.name = `${copy.name} (copy)`.slice(0, 80);
      return { roomTypes: [...d.roomTypes.slice(0, i + 1), copy, ...d.roomTypes.slice(i + 1)] };
    });
  const importRooms = (imported: RoomType[], mode: 'add' | 'replace') =>
    update((d) => ({ roomTypes: mode === 'replace' ? imported : [...(d.roomTypes || []), ...imported] }));

  return (
    <View>
      <Banner tone="blue" style={styles.lead}>
        {isEntire
          ? 'Tell us about the place and its nightly price. You can change prices any time.'
          : 'Add one room type for each kind of room you have, e.g. "AC Double" (6 rooms) and "Non-AC Twin" (4 rooms). Start with one; you can add more later.'}
      </Banner>

      {!isEntire ? <TariffImport stay={stay} rooms={rooms} onImport={importRooms} /> : null}

      <Section>
        {rooms.map((rt) => (
          <RoomTypeEditor
            key={rt._id}
            rt={rt}
            total={rooms.length}
            estimate={estimates[rooms.indexOf(rt)]}
            isEntire={isEntire}
            allowDorm={allowDorm}
            onChange={changeRoom(rt._id)}
            onRemove={() => removeRoom(rt)}
            onDuplicate={() => duplicateRoom(rt)}
          />
        ))}
        {!rooms.length ? (
          <Button title={isEntire ? 'Add the place' : 'Add a room type'} onPress={() => (isEntire ? update({ roomTypes: [newRoomType('entire_place')] }) : addRoom('private'))} fullWidth />
        ) : null}
        {!isEntire && rooms.length ? (
          <View style={styles.addRow}>
            <Button
              title="Add another room type"
              variant="outline"
              onPress={() => addRoom('private')}
              disabled={full}
              icon={<Ionicons name="add" size={18} color={colors.primary[500]} />}
              fullWidth
            />
            {allowDorm ? (
              <Button title="Add a dorm" variant="ghost" onPress={() => addRoom('dorm')} disabled={full} icon={<Ionicons name="add" size={18} color={colors.primary[500]} />} fullWidth />
            ) : null}
          </View>
        ) : null}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: fontWeight.semibold },
  noGap: { marginBottom: 0 },
  lead: { marginBottom: spacing.lg },
  hint: { fontSize: fontSize.xs, lineHeight: 16, marginTop: 2 },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  roomCard: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 56 },
  roomName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  roomMeta: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  closedWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  roomBody: { borderTopWidth: 1, padding: spacing.lg, gap: spacing.lg },
  pairRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  steppers: { borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  nameField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, minHeight: 48 },
  nameText: { flex: 1, fontSize: fontSize.md },
  nameActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  warnBox: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.xs },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  warnIcon: { marginTop: 1 },
  warnText: { flex: 1, fontSize: fontSize.xs, lineHeight: 16 },
  roomActions: { flexDirection: 'row', gap: spacing.xl, borderTopWidth: 1, paddingTop: spacing.md },
  roomAction: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  roomActionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  addRow: { gap: spacing.sm },

  earnings: { borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  earnHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  earnText: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
  earnNote: { fontSize: fontSize.xs, marginTop: spacing.xs, lineHeight: 16 },
  breakdown: { borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm, gap: 4 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  breakLabel: { flex: 1, fontSize: fontSize.xs, lineHeight: 16 },
  breakValue: { fontSize: fontSize.xs },

  tariffCard: { borderWidth: 1, borderStyle: 'dashed', borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg },
  tariffHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tariffIcon: { width: 36, height: 36, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  tariffTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tariffText: { fontSize: fontSize.xs, lineHeight: 16, marginTop: 2 },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  tariffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm },
  tariffRoomName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  notes: { borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.xs },
  sheetGap: { marginBottom: spacing.md, marginTop: spacing.xs },
});
