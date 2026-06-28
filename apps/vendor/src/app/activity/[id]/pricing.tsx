import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';

// ============================================================
// Types — mirror server ActivityListing.pricing.* sub-schemas
// ============================================================
type BulkDiscount = {
  minParticipants: number;
  maxParticipants: number;
  discountType: 'percent' | 'fixed';
  discountPercent: number;
  fixedDiscountAmount: number;
};

type SeasonalRule = {
  name: string;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null;
  daysOfWeek: number[]; // 0=Sun … 6=Sat
  priceModifier: number; // 1.2 = +20%
  isActive: boolean;
};

type DateOverride = {
  date: string; // ISO yyyy-mm-dd
  price: number;
  reason: string;
};

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Strict-ish ISO date check (yyyy-mm-dd). Kept simple — full validation is server-side.
const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

const fmtPct = (modifier: number) => {
  const pct = Math.round((modifier - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
};

export default function PricingRulesScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [bulk, setBulk] = useState<BulkDiscount[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalRule[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);

  // Which editor modal is open
  const [editor, setEditor] = useState<null | { kind: 'bulk' | 'seasonal' | 'override'; index: number | null }>(null);

  // ── Load existing pricing ───────────────────────────────
  const fetchPricing = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await activityMarketplaceAPI.getActivityById(id);
      const activity = res?.data || res?.activity || res;
      const pricing = activity?.pricing || {};
      setBulk(
        (pricing.bulkDiscounts || []).map((b: any) => ({
          minParticipants: b.minParticipants ?? 1,
          maxParticipants: b.maxParticipants ?? 1,
          discountType: b.discountType === 'fixed' ? 'fixed' : 'percent',
          discountPercent: b.discountPercent ?? 0,
          fixedDiscountAmount: b.fixedDiscountAmount ?? 0,
        }))
      );
      setSeasonal(
        (pricing.seasonalPricing || []).map((s: any) => ({
          name: s.name ?? '',
          startDate: s.startDate ? String(s.startDate).slice(0, 10) : null,
          endDate: s.endDate ? String(s.endDate).slice(0, 10) : null,
          daysOfWeek: Array.isArray(s.daysOfWeek) ? s.daysOfWeek : [],
          priceModifier: s.priceModifier ?? 1,
          isActive: s.isActive !== false,
        }))
      );
      setOverrides(
        (pricing.dateOverrides || []).map((d: any) => ({
          date: d.date ? String(d.date).slice(0, 10) : '',
          price: d.price ?? 0,
          reason: d.reason ?? '',
        }))
      );
      setDirty(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to load pricing', text2: err?.message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  // ── Persist ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      await activityMarketplaceAPI.updateListing(id, {
        pricing: {
          bulkDiscounts: bulk,
          seasonalPricing: seasonal.map((s) => ({
            ...s,
            startDate: s.startDate || null,
            endDate: s.endDate || null,
          })),
          dateOverrides: overrides,
        },
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Pricing rules saved' });
      setDirty(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err?.message });
    } finally {
      setSaving(false);
    }
  }, [id, bulk, seasonal, overrides]);

  const markDirty = () => setDirty(true);

  // ── Section render helpers ──────────────────────────────
  const sectionTitle = (label: string) => (
    <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>{label}</Text>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Header themeColors={themeColors} onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Header themeColors={themeColors} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Bulk discounts ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            {sectionTitle('Bulk discounts')}
            <TouchableOpacity onPress={() => setEditor({ kind: 'bulk', index: null })} hitSlop={8}>
              <Ionicons name="add-circle" size={26} color={colors.primary[500]} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
            Reward larger groups with an automatic discount per participant band.
          </Text>
          {bulk.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="people-outline" size={40} color={themeColors.textTertiary} />}
              title="No bulk discounts"
              description="Add a tier like 5–10 people get 10% off."
            />
          ) : (
            bulk.map((b, i) => (
              <Card key={i} bordered elevated={false} style={styles.ruleCard}>
                <View style={styles.ruleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ruleTitle, { color: themeColors.text }]}>
                      {b.minParticipants}–{b.maxParticipants} people
                    </Text>
                    <Text style={[styles.ruleSub, { color: themeColors.textSecondary }]}>
                      {b.discountType === 'percent'
                        ? `${b.discountPercent}% off`
                        : `₹${b.fixedDiscountAmount} off per booking`}
                    </Text>
                  </View>
                  <RuleActions
                    onEdit={() => setEditor({ kind: 'bulk', index: i })}
                    onDelete={() => {
                      setBulk((prev) => prev.filter((_, x) => x !== i));
                      markDirty();
                    }}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        {/* ── Seasonal pricing ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            {sectionTitle('Seasonal & weekend pricing')}
            <TouchableOpacity onPress={() => setEditor({ kind: 'seasonal', index: null })} hitSlop={8}>
              <Ionicons name="add-circle" size={26} color={colors.primary[500]} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
            Raise or lower the price during peak windows or on specific weekdays.
          </Text>
          {seasonal.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={40} color={themeColors.textTertiary} />}
              title="No seasonal rules"
              description="Add a rule like Weekends +20%."
            />
          ) : (
            seasonal.map((s, i) => (
              <Card key={i} bordered elevated={false} style={styles.ruleCard}>
                <View style={styles.ruleRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.ruleTitleRow}>
                      <Text style={[styles.ruleTitle, { color: themeColors.text }]}>{s.name || 'Untitled'}</Text>
                      <Badge label={fmtPct(s.priceModifier)} variant={s.priceModifier >= 1 ? 'warning' : 'success'} />
                      {!s.isActive && <Badge label="Off" variant="default" />}
                    </View>
                    <Text style={[styles.ruleSub, { color: themeColors.textSecondary }]}>
                      {s.daysOfWeek.length > 0
                        ? s.daysOfWeek.map((d) => DOW_LABELS[d]).join(', ')
                        : s.startDate && s.endDate
                        ? `${s.startDate} → ${s.endDate}`
                        : 'Always (no window set)'}
                    </Text>
                  </View>
                  <RuleActions
                    onEdit={() => setEditor({ kind: 'seasonal', index: i })}
                    onDelete={() => {
                      setSeasonal((prev) => prev.filter((_, x) => x !== i));
                      markDirty();
                    }}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        {/* ── Date overrides ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            {sectionTitle('Date overrides')}
            <TouchableOpacity onPress={() => setEditor({ kind: 'override', index: null })} hitSlop={8}>
              <Ionicons name="add-circle" size={26} color={colors.primary[500]} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
            Set an exact price for a single date — overrides everything else that day.
          </Text>
          {overrides.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="pricetag-outline" size={40} color={themeColors.textTertiary} />}
              title="No date overrides"
              description="e.g. New Year's Eve at a fixed special price."
            />
          ) : (
            overrides.map((d, i) => (
              <Card key={i} bordered elevated={false} style={styles.ruleCard}>
                <View style={styles.ruleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ruleTitle, { color: themeColors.text }]}>{d.date || 'No date'}</Text>
                    <Text style={[styles.ruleSub, { color: themeColors.textSecondary }]}>
                      ₹{d.price}
                      {d.reason ? ` · ${d.reason}` : ''}
                    </Text>
                  </View>
                  <RuleActions
                    onEdit={() => setEditor({ kind: 'override', index: i })}
                    onDelete={() => {
                      setOverrides((prev) => prev.filter((_, x) => x !== i));
                      markDirty();
                    }}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Button
          title={saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          onPress={handleSave}
          loading={saving}
          disabled={saving || !dirty}
          fullWidth
        />
      </View>

      {/* Editors */}
      {editor?.kind === 'bulk' && (
        <BulkEditor
          themeColors={themeColors}
          initial={editor.index != null ? bulk[editor.index] : undefined}
          onClose={() => setEditor(null)}
          onSave={(rule) => {
            setBulk((prev) => {
              const next = [...prev];
              if (editor.index != null) next[editor.index] = rule;
              else next.push(rule);
              return next;
            });
            markDirty();
            setEditor(null);
          }}
        />
      )}
      {editor?.kind === 'seasonal' && (
        <SeasonalEditor
          themeColors={themeColors}
          initial={editor.index != null ? seasonal[editor.index] : undefined}
          onClose={() => setEditor(null)}
          onSave={(rule) => {
            setSeasonal((prev) => {
              const next = [...prev];
              if (editor.index != null) next[editor.index] = rule;
              else next.push(rule);
              return next;
            });
            markDirty();
            setEditor(null);
          }}
        />
      )}
      {editor?.kind === 'override' && (
        <OverrideEditor
          themeColors={themeColors}
          initial={editor.index != null ? overrides[editor.index] : undefined}
          onClose={() => setEditor(null)}
          onSave={(rule) => {
            setOverrides((prev) => {
              const next = [...prev];
              if (editor.index != null) next[editor.index] = rule;
              else next.push(rule);
              return next;
            });
            markDirty();
            setEditor(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// Header
// ============================================================
function Header({ themeColors, onBack }: { themeColors: any; onBack: () => void }) {
  return (
    <View style={[styles.header, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: themeColors.text }]}>Pricing rules</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

// ============================================================
// Shared row actions
// ============================================================
function RuleActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.ruleActions}>
      <TouchableOpacity onPress={onEdit} hitSlop={6} style={styles.iconBtn}>
        <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={6} style={styles.iconBtn}>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Themed field used inside modals
// ============================================================
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  themeColors,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  themeColors: any;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textTertiary}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'sentences'}
        style={[
          styles.field,
          { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text },
        ]}
      />
    </View>
  );
}

function ModalShell({
  themeColors,
  title,
  children,
  onClose,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
}: {
  themeColors: any;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
}) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalSheet, { backgroundColor: themeColors.surface }]}
        >
          <View style={[styles.modalHandle, { backgroundColor: themeColors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          <Button title={saveLabel} onPress={onSave} disabled={saveDisabled} fullWidth />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ============================================================
// Bulk discount editor
// ============================================================
function BulkEditor({
  themeColors,
  initial,
  onClose,
  onSave,
}: {
  themeColors: any;
  initial?: BulkDiscount;
  onClose: () => void;
  onSave: (r: BulkDiscount) => void;
}) {
  const [minP, setMinP] = useState(String(initial?.minParticipants ?? '2'));
  const [maxP, setMaxP] = useState(String(initial?.maxParticipants ?? '10'));
  const [type, setType] = useState<'percent' | 'fixed'>(initial?.discountType ?? 'percent');
  const [pct, setPct] = useState(String(initial?.discountPercent ?? '10'));
  const [fixed, setFixed] = useState(String(initial?.fixedDiscountAmount ?? '0'));

  const min = parseInt(minP, 10);
  const max = parseInt(maxP, 10);
  const valid =
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= 1 &&
    max >= min &&
    (type === 'percent' ? Number(pct) > 0 && Number(pct) <= 100 : Number(fixed) > 0);

  return (
    <ModalShell
      themeColors={themeColors}
      title={initial ? 'Edit bulk discount' : 'Add bulk discount'}
      onClose={onClose}
      saveDisabled={!valid}
      onSave={() =>
        onSave({
          minParticipants: min,
          maxParticipants: max,
          discountType: type,
          discountPercent: type === 'percent' ? Math.round(Number(pct)) : 0,
          fixedDiscountAmount: type === 'fixed' ? Math.round(Number(fixed)) : 0,
        })
      }
    >
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Field label="Min people" value={minP} onChangeText={setMinP} keyboardType="numeric" themeColors={themeColors} />
        </View>
        <View style={{ width: spacing.md }} />
        <View style={{ flex: 1 }}>
          <Field label="Max people" value={maxP} onChangeText={setMaxP} keyboardType="numeric" themeColors={themeColors} />
        </View>
      </View>

      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Discount type</Text>
      <View style={styles.segment}>
        {(['percent', 'fixed'] as const).map((t) => {
          const active = type === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={[
                styles.segmentBtn,
                { borderColor: themeColors.border },
                active && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
              ]}
            >
              <Text style={[styles.segmentText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                {t === 'percent' ? '% off' : '₹ off'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: spacing.lg }} />
      {type === 'percent' ? (
        <Field label="Discount %" value={pct} onChangeText={setPct} keyboardType="numeric" themeColors={themeColors} />
      ) : (
        <Field label="Fixed amount (₹)" value={fixed} onChangeText={setFixed} keyboardType="numeric" themeColors={themeColors} />
      )}
    </ModalShell>
  );
}

// ============================================================
// Seasonal editor
// ============================================================
function SeasonalEditor({
  themeColors,
  initial,
  onClose,
  onSave,
}: {
  themeColors: any;
  initial?: SeasonalRule;
  onClose: () => void;
  onSave: (r: SeasonalRule) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [pctStr, setPctStr] = useState(
    initial ? String(Math.round((initial.priceModifier - 1) * 100)) : '20'
  );
  const [days, setDays] = useState<number[]>(initial?.daysOfWeek ?? []);
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive !== false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const pctNum = Number(pctStr);
  // priceModifier must stay within server bounds [0.1, 10]; clamp the derived value.
  const modifier = Math.min(10, Math.max(0.1, 1 + pctNum / 100));
  const datesOk = (!startDate || isISODate(startDate)) && (!endDate || isISODate(endDate));
  const valid = name.trim().length > 0 && Number.isFinite(pctNum) && datesOk;

  return (
    <ModalShell
      themeColors={themeColors}
      title={initial ? 'Edit seasonal rule' : 'Add seasonal rule'}
      onClose={onClose}
      saveDisabled={!valid}
      onSave={() =>
        onSave({
          name: name.trim(),
          startDate: startDate || null,
          endDate: endDate || null,
          daysOfWeek: days,
          priceModifier: modifier,
          isActive,
        })
      }
    >
      <Field label="Name" value={name} onChangeText={setName} placeholder="Peak Season / Weekends" themeColors={themeColors} />
      <Field
        label="Price change % (negative for discount)"
        value={pctStr}
        onChangeText={setPctStr}
        keyboardType="numeric"
        themeColors={themeColors}
      />

      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Apply on days (optional)</Text>
      <View style={styles.dowRow}>
        {DOW_LABELS.map((lbl, d) => {
          const active = days.includes(d);
          return (
            <TouchableOpacity
              key={d}
              onPress={() => toggleDay(d)}
              style={[
                styles.dowChip,
                { borderColor: themeColors.border },
                active && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
              ]}
            >
              <Text style={[styles.dowText, { color: active ? '#fff' : themeColors.textSecondary }]}>{lbl}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: spacing.lg }} />
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="2026-12-20" keyboardType="default" autoCapitalize="none" themeColors={themeColors} />
        </View>
        <View style={{ width: spacing.md }} />
        <View style={{ flex: 1 }}>
          <Field label="End date" value={endDate} onChangeText={setEndDate} placeholder="2027-01-05" keyboardType="default" autoCapitalize="none" themeColors={themeColors} />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.fieldLabel, { color: themeColors.text, marginBottom: 0 }]}>Active</Text>
        <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary[400] }} />
      </View>
    </ModalShell>
  );
}

// ============================================================
// Date override editor
// ============================================================
function OverrideEditor({
  themeColors,
  initial,
  onClose,
  onSave,
}: {
  themeColors: any;
  initial?: DateOverride;
  onClose: () => void;
  onSave: (r: DateOverride) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [reason, setReason] = useState(initial?.reason ?? '');

  const valid = isISODate(date) && Number(price) > 0;

  return (
    <ModalShell
      themeColors={themeColors}
      title={initial ? 'Edit date override' : 'Add date override'}
      onClose={onClose}
      saveDisabled={!valid}
      onSave={() => onSave({ date: date.trim(), price: Math.round(Number(price)), reason: reason.trim() })}
    >
      <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-12-31" keyboardType="default" autoCapitalize="none" themeColors={themeColors} />
      <Field label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="numeric" themeColors={themeColors} />
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="New Year special" themeColors={themeColors} />
    </ModalShell>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },

  scroll: { padding: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: { fontSize: fontSize.xs, marginTop: 2, marginBottom: spacing.md },

  ruleCard: { marginBottom: spacing.sm },
  ruleRow: { flexDirection: 'row', alignItems: 'center' },
  ruleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  ruleTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },
  ruleSub: { fontSize: fontSize.sm, marginTop: 2 },
  ruleActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { padding: spacing.xs },

  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium as any, marginBottom: spacing.xs },
  field: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    minHeight: 48,
  },
  row2: { flexDirection: 'row' },

  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any },

  dowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dowChip: {
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dowText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold as any },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
});
