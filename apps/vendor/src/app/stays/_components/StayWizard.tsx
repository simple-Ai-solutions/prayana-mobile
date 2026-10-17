// Stay onboarding wizard: Property → Rooms & prices → Photos → Amenities &
// rules → Owner & licences → Review & submit.
//
// Edits autosave a moment after the vendor stops typing (and on every step
// change, when the app goes to the background, and on the way out), so
// nothing is lost. Fields the vendor edits live in `draft`; what only the
// server changes (photos, licences, status, readiness) lives in `stay`.
// Ported from the web StayWizard.jsx.
//
// Back (header chevron, Android back) steps back through the wizard: to the
// step you came from, or — for a draft — the step before; then it leaves,
// saving first.
//
// A draft filled from another site shows what the import did at the top
// (ImportBanner). "Try the import again" saves, stops autosave for good and
// hands the draft back to the screen, which shows the retry options and then
// the import's progress; a new wizard opens once it's finished.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { staysAPI } from './api';
import { Button } from '../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../theme/vendorColors';
import { usePalette, ScreenHeader, Banner, ProgressBar, StayStatusBadge, LinkButton } from './controls';
import {
  DraftPatch,
  STEPS,
  STEP_IDS,
  Stay,
  StayDraft,
  StepId,
  StepProps,
  apiError,
  draftFrom,
  hasOperations,
  initialStep,
  typeLabel,
} from './stayConfig';
import PropertyStep from './steps/PropertyStep';
import RoomsStep from './steps/RoomsStep';
import PhotosStep from './steps/PhotosStep';
import RulesStep from './steps/RulesStep';
import LegalStep from './steps/LegalStep';
import ReviewStep from './steps/ReviewStep';
import { ImportBanner, canImportInto } from './ImportListing';

const STEP_COMPONENTS: Record<StepId, React.ComponentType<StepProps>> = {
  property: PropertyStep,
  rooms: RoomsStep,
  photos: PhotosStep,
  rules: RulesStep,
  legal: LegalStep,
  review: ReviewStep,
};

const AUTOSAVE_DELAY = 1200;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function SaveIndicator({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  const p = usePalette();
  if (state === 'saving' || state === 'dirty') {
    return (
      <View style={styles.saveRow} accessibilityLiveRegion="polite" accessibilityLabel="Saving">
        {state === 'saving' ? <ActivityIndicator size="small" color={p.c.textTertiary} /> : null}
        <Text style={[styles.saveText, { color: p.c.textTertiary }]}>Saving…</Text>
      </View>
    );
  }
  if (state === 'error') {
    return (
      <TouchableOpacity
        style={styles.saveRow}
        onPress={() =>
          Alert.alert('Not saved', error || "Your last changes couldn't be saved.", [
            { text: 'Later', style: 'cancel' },
            { text: 'Retry', onPress: onRetry },
          ])
        }
        accessibilityRole="button"
        accessibilityLabel="Not saved. Retry"
        hitSlop={8}
      >
        <Ionicons name="cloud-offline-outline" size={16} color={p.danger} />
        <Text style={[styles.saveText, { color: p.danger }]}>Retry</Text>
      </TouchableOpacity>
    );
  }
  if (state === 'saved') {
    return (
      <View style={styles.saveRow} accessibilityLabel="Saved">
        <Ionicons name="checkmark" size={16} color={p.success} />
        <Text style={[styles.saveText, { color: p.success }]}>Saved</Text>
      </View>
    );
  }
  return null;
}

function StepNav({ step, stay, onGo }: { step: StepId; stay: Stay; onGo: (id: StepId) => void }) {
  const p = usePalette();
  const byStep = stay.completeness?.byStep || {};
  const scrollRef = useRef<ScrollView>(null);
  const index = STEP_IDS.indexOf(step);
  useEffect(() => {
    // Keep the active pill in view on narrow phones.
    scrollRef.current?.scrollTo({ x: Math.max(0, index * 96 - 60), animated: true });
  }, [index]);
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stepNav}
      accessibilityRole="tablist"
      accessibilityLabel="Steps"
    >
      {STEPS.map((s, i) => {
        const info = byStep[s.id];
        const done = !!info && info.total > 0 && info.requiredLeft === 0;
        const active = s.id === step;
        const left = info && info.requiredLeft > 0 ? info.requiredLeft : 0;
        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => onGo(s.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Step ${i + 1}: ${s.label}${done ? ', done' : left ? `, ${left} to do` : ''}`}
            style={[
              styles.stepPill,
              { borderColor: p.c.border, backgroundColor: p.c.surface },
              done && !active && { borderColor: p.soft.green.border, backgroundColor: p.soft.green.bg },
              active && { borderColor: colors.primary[500], backgroundColor: colors.primary[500] },
            ]}
          >
            {done && !active ? (
              <Ionicons name="checkmark" size={13} color={p.soft.green.fg} />
            ) : (
              <Text style={[styles.stepNum, { color: active ? '#fff' : p.c.textSecondary }]}>{i + 1}</Text>
            )}
            <Text style={[styles.stepPillText, { color: active ? '#fff' : done ? p.soft.green.fg : p.c.text }]}>{s.short}</Text>
            {left && !active ? (
              <View style={[styles.leftBubble, { backgroundColor: p.soft.amber.bg }]}>
                <Text style={[styles.leftBubbleText, { color: p.soft.amber.fg }]}>{left}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function StatusBanner({ stay }: { stay: Stay }) {
  const reason = stay.moderation?.reason;
  if (stay.status === 'changes_requested') {
    return <Banner tone="red">{`Our team asked for changes: ${reason || 'see the email we sent you'}. Fix them, then resubmit from Review.`}</Banner>;
  }
  if (stay.status === 'suspended') {
    return <Banner tone="red">{`Taken down: ${reason || 'see the email we sent you'}. Fix it, then resubmit from Review.`}</Banner>;
  }
  if (stay.status === 'pending_review') {
    return <Banner tone="amber">In review. We usually finish within 24 hours and will email you. You can keep editing meanwhile.</Banner>;
  }
  if (stay.status === 'published') {
    return <Banner tone="green">Live. Changes save automatically and go live right away.</Banner>;
  }
  return null;
}

/** "Listing 64% ready" with the next few things to do, each a tap away. */
function Readiness({ stay, onGo }: { stay: Stay; onGo: (id: StepId) => void }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const c = stay.completeness;
  if (!c) return null;
  const required = (c.missing || []).filter((m) => m.required);
  const shown = (required.length ? required : c.missing || []).slice(0, 5);
  const stepShort = (id: StepId) => STEPS.find((s) => s.id === id)?.short || '';
  return (
    <View style={[styles.readyCard, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        disabled={!shown.length}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Listing ${c.percent}% ready.${required.length ? ` ${required.length} left before you can submit.` : ''}`}
        style={styles.readyHead}
      >
        <Text style={[styles.readyTitle, { color: p.c.text }]}>Listing {c.percent}% ready</Text>
        {c.canSubmit ? (
          <View style={styles.readyOk}>
            <Ionicons name="checkmark-circle" size={15} color={p.success} />
            <Text style={[styles.readyOkText, { color: p.success }]}>Ready to submit</Text>
          </View>
        ) : required.length ? (
          <Text style={[styles.readyLeft, { color: p.warning }]}>{required.length} left</Text>
        ) : null}
        {shown.length ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={p.c.textTertiary} /> : null}
      </TouchableOpacity>
      <ProgressBar percent={c.percent} tone={c.canSubmit ? 'green' : 'blue'} height={6} />
      {open && shown.length ? (
        <View style={styles.readyList}>
          <Text style={[styles.readyListHead, { color: p.c.textTertiary }]}>
            {required.length ? `${required.length} thing${required.length === 1 ? '' : 's'} left before you can submit` : 'To get more bookings'}
          </Text>
          {shown.map((m) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => onGo(m.step)}
              style={styles.readyItem}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}. Go to ${stepShort(m.step)}`}
            >
              <Ionicons name="ellipse-outline" size={12} color={m.required ? p.warning : p.c.textTertiary} style={styles.readyDot} />
              <Text style={[styles.readyItemText, { color: p.c.text }]}>{m.label}</Text>
              <Text style={[styles.readyStep, { color: p.brand }]}>{stepShort(m.step)}</Text>
              <Ionicons name="chevron-forward" size={14} color={p.brand} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function StayWizard({
  initialStay,
  startStep,
  onRetryImport,
}: {
  initialStay: Stay;
  /** Open on this step instead of where the draft left off (e.g. Property, right after an import). */
  startStep?: StepId;
  /** "Try the import again" on a draft whose import failed; gets the draft with this wizard's edits. */
  onRetryImport?: (latest: Stay) => void;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const p = usePalette();
  const id = initialStay._id;

  const [stay, setStay] = useState<Stay>(initialStay);
  const [draft, setDraft] = useState<StayDraft>(() => draftFrom(initialStay));
  const [step, setStepState] = useState<StepId>(() => startStep || initialStep(initialStay));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const draftRef = useRef(draft);
  const stepRef = useRef(step);
  const statusRef = useRef(initialStay.status);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const saveTokenRef = useRef<object | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<StepId[]>([]);
  const allowLeaveRef = useRef(false);
  const mountedRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  // Set once the draft is handed back for another import: from then on the
  // import owns the draft, so nothing here may save over it.
  const frozenRef = useRef(false);

  useEffect(() => {
    statusRef.current = stay.status;
  }, [stay.status]);

  // What the server returns replaces server-owned fields only; the vendor's
  // in-progress edits (the draft) stay as they are.
  const applyServer = useCallback((data: Partial<Stay> | null | undefined) => {
    if (!data || !mountedRef.current) return;
    setStay((prev) => ({ ...prev, ...data }));
  }, []);

  const save = useCallback(
    async (extra: Record<string, unknown> = {}): Promise<boolean> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (frozenRef.current) return true;
      // One save at a time; a caller that waits gets a server that has its edits.
      while (inFlightRef.current) await inFlightRef.current;
      if (!dirtyRef.current && !Object.keys(extra).length) return true;
      dirtyRef.current = false;
      if (mountedRef.current) setSaveState('saving');
      const token = {};
      saveTokenRef.current = token;
      const run: Promise<boolean> = (async () => {
        try {
          const res: any = await staysAPI.update(id, { ...draftRef.current, ...extra });
          if (res && res.success === false) throw new Error(res.message || "Couldn't save");
          applyServer(res?.data);
          lastErrorRef.current = null;
          if (mountedRef.current) {
            setSaveState(dirtyRef.current ? 'dirty' : 'saved');
            setSaveError(null);
          }
          return true;
        } catch (e) {
          dirtyRef.current = true;
          const message = apiError(e, "Couldn't save. Check your connection and try again.");
          if (mountedRef.current) {
            setSaveState('error');
            setSaveError(message);
            // Say it once (e.g. a team role that can't edit gets the server's 403 message).
            if (lastErrorRef.current !== message) Toast.show({ type: 'error', text1: 'Not saved', text2: message });
          }
          lastErrorRef.current = message;
          return false;
        } finally {
          if (saveTokenRef.current === token) inFlightRef.current = null;
        }
      })();
      inFlightRef.current = run;
      return run;
    },
    [id, applyServer],
  );

  // Every edit goes through here; the save follows a moment later.
  const update = useCallback(
    (patch: DraftPatch) => {
      if (frozenRef.current) return;
      const part = typeof patch === 'function' ? patch(draftRef.current) : patch;
      const next = { ...draftRef.current, ...part };
      draftRef.current = next;
      setDraft(next);
      dirtyRef.current = true;
      setSaveState('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        save();
      }, AUTOSAVE_DELAY);
    },
    [save],
  );

  // Going to the background (a call, the camera app, switching apps) saves now.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') save();
    });
    return () => sub.remove();
  }, [save]);

  // Leaving by any route saves whatever is pending.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) save();
    };
  }, [save]);

  const showStep = useCallback(
    (next: StepId) => {
      stepRef.current = next;
      setStepState(next);
      save({ lastStep: next });
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [save],
  );

  const goTo = useCallback(
    (next: StepId) => {
      if (next === stepRef.current) return;
      historyRef.current.push(stepRef.current);
      showStep(next);
    },
    [showStep],
  );

  /** One step back; false when there's nowhere to go but out. */
  const stepBack = useCallback((): boolean => {
    let target: StepId | null = historyRef.current.pop() || null;
    if (!target && statusRef.current === 'draft') {
      const i = STEP_IDS.indexOf(stepRef.current);
      if (i > 0) target = STEP_IDS[i - 1];
    }
    if (!target) return false;
    showStep(target);
    return true;
  }, [showStep]);

  const leave = useCallback(
    (to?: string) => {
      allowLeaveRef.current = true;
      if (to) router.replace(to as never);
      else if (router.canGoBack()) router.back();
      else router.replace('/stays');
    },
    [router],
  );

  /** The footer's Back: the step before, unwinding history when it's the one we came from. */
  const footerBack = useCallback(
    (prevId: StepId) => {
      const h = historyRef.current;
      if (h[h.length - 1] === prevId) h.pop();
      showStep(prevId);
    },
    [showStep],
  );

  /** Leave after the last edits are saved (or the vendor chooses to leave anyway). */
  const exit = useCallback(async () => {
    const ok = await save();
    if (ok) return leave();
    Alert.alert("Couldn't save", "Your last changes aren't saved yet. Check your connection and try again.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave anyway', style: 'destructive', onPress: () => leave() },
    ]);
  }, [save, leave]);

  // The Android back button (and anything else that pops this screen) steps
  // back through the wizard first, then saves before letting the pop through.
  useEffect(() => {
    const unsub = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (allowLeaveRef.current) return;
      if (stepBack()) {
        e.preventDefault();
        return;
      }
      if (dirtyRef.current || inFlightRef.current) {
        e.preventDefault();
        save().then((ok) => {
          const go = () => {
            allowLeaveRef.current = true;
            (navigation as any).dispatch(e.data.action);
          };
          if (ok) go();
          else
            Alert.alert("Couldn't save", "Your last changes aren't saved yet. Check your connection and try again.", [
              { text: 'Stay', style: 'cancel' },
              { text: 'Leave anyway', style: 'destructive', onPress: go },
            ]);
        });
      }
    });
    return unsub;
  }, [navigation, stepBack, save]);

  const onHeaderBack = () => {
    if (!stepBack()) exit();
  };

  /** Save, stop autosaving, and hand the draft (with these edits) back for another import. */
  const retryImport = useCallback(async () => {
    if (!onRetryImport) return;
    const ok = await save();
    const handOff = () => {
      frozenRef.current = true;
      dirtyRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      const d = draftRef.current;
      onRetryImport({
        ...stay,
        ...d,
        legal: { ...stay.legal, ...d.legal },
        onboarding: { ...(stay.onboarding || {}), lastStep: stepRef.current },
      });
    };
    if (ok) handOff();
    else
      Alert.alert("Couldn't save", "Your last changes aren't saved. The import fills in the draft from your listing anyway.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import anyway', onPress: handOff },
      ]);
  }, [onRetryImport, save, stay]);

  /** Open a day-to-day screen (the wizard stays underneath); saves first. */
  const openOps = (path: string) => {
    save();
    router.push(path as never);
  };

  const index = STEP_IDS.indexOf(step);
  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];
  const StepComponent = STEP_COMPONENTS[step];
  const title = draft.name?.trim() || `New ${typeLabel(draft.propertyType).toLowerCase()}`;
  const ops = hasOperations(stay);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title={title}
        onBack={onHeaderBack}
        backLabel={historyRef.current.length || (stay.status === 'draft' && index > 0) ? 'Previous step' : 'Save and go back'}
        right={<SaveIndicator state={saveState} error={saveError} onRetry={() => save()} />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ImportBanner stay={stay} onRetry={onRetryImport && canImportInto(stay) ? retryImport : undefined} />
          <View style={styles.topRow}>
            <StayStatusBadge status={stay.status} />
            <Text style={[styles.typeText, { color: p.c.textSecondary }]}>{typeLabel(draft.propertyType)}</Text>
          </View>
          <View style={styles.bannerWrap}>
            <StatusBanner stay={stay} />
          </View>
          {ops ? (
            <View style={styles.opsRow}>
              <LinkButton compact icon="calendar-outline" label="Rates & availability" onPress={() => openOps(`/stays/${id}/calendar`)} />
              <LinkButton compact icon="clipboard-outline" label="Bookings" onPress={() => openOps(`/stays/bookings?stayId=${id}`)} />
              <LinkButton compact icon="star-outline" label="Reviews" onPress={() => openOps(`/stays/reviews?stayId=${id}`)} />
            </View>
          ) : null}

          <StepNav step={step} stay={stay} onGo={goTo} />
          {step !== 'review' ? <Readiness stay={stay} onGo={goTo} /> : null}

          <View style={[styles.stepCard, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
            <Text style={[styles.stepOf, { color: p.c.textTertiary }]}>
              Step {index + 1} of {STEPS.length}
            </Text>
            <Text style={[styles.stepTitle, { color: p.c.text }]} accessibilityRole="header">
              {STEPS[index].label}
            </Text>
            <StepComponent draft={draft} update={update} stay={stay} applyServer={applyServer} save={save} goTo={goTo} leave={leave} />
          </View>
        </ScrollView>

        {/* Footer: always reachable, thumb-friendly */}
        <View style={[styles.footer, { backgroundColor: p.c.surface, borderTopColor: p.c.border }]}>
          {prev ? (
            <Button
              title="Back"
              variant="outline"
              onPress={() => footerBack(prev.id)}
              icon={<Ionicons name="arrow-back" size={16} color={colors.primary[500]} />}
              style={styles.footerBtn}
            />
          ) : (
            <Button title="Save & exit" variant="outline" onPress={exit} style={styles.footerBtn} />
          )}
          {next ? (
            <Button title={`Next: ${next.short}`} onPress={() => goTo(next.id)} style={styles.footerBtnMain} />
          ) : (
            <Button title="Save & exit" variant="outline" onPress={exit} style={styles.footerBtnMain} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },

  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.xs, minHeight: 32 },
  saveText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  typeText: { fontSize: fontSize.sm },
  bannerWrap: { marginBottom: spacing.sm },
  opsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },

  stepNav: { gap: spacing.sm, paddingVertical: spacing.sm },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36 },
  stepNum: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  stepPillText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  leftBubble: { borderRadius: 999, minWidth: 18, paddingHorizontal: 5, alignItems: 'center' },
  leftBubbleText: { fontSize: 11, fontWeight: fontWeight.bold },

  readyCard: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md, marginTop: spacing.xs, marginBottom: spacing.md, gap: spacing.sm },
  readyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  readyTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  readyOk: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readyOkText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  readyLeft: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  readyList: { gap: 2 },
  readyListHead: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginBottom: 2 },
  readyItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, minHeight: 36 },
  readyDot: { marginTop: 1 },
  readyItemText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18 },
  readyStep: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  stepCard: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg },
  stepOf: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  stepTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: 2, marginBottom: spacing.xl },

  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
  footerBtn: { flex: 1 },
  footerBtnMain: { flex: 1.4 },
});
