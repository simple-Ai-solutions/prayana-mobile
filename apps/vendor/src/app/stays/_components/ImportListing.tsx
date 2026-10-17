// Import a property from another site. The owner pastes the link to their
// listing on Airbnb, Booking.com, MakeMyTrip, Agoda or Goibibo (or uploads
// screenshots of it, when the site won't let us read the page) and the server
// fills a draft in the background (server: services/stayListingImport): type,
// name, description, address and map pin, amenities, room types and prices,
// rules, check-in times and photos. The owner then checks it all in the
// wizard, adds a licence and submits. Ported from the web's
// components/business/stays/import/.
//
//   ImportListingCard  the link / screenshots form on "List your property"
//   ImportProgress     full screen while the import runs; polls the draft
//   ImportFailed       full screen when it didn't work: retry, or fill it in yourself
//   ImportBanner       top of the wizard afterwards: what was filled, what to check
//
// While an import runs the wizard isn't on screen at all, so its autosave
// can't write the placeholder draft over what the import is filling in.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { staysAPI } from './api';
import { Button } from '../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../theme/vendorColors';
import { usePalette, ScreenHeader, FieldLabel, LinkButton, Banner } from './controls';
import { ImportJob, Stay, UploadFile, apiError, plural, toUploadFile } from './stayConfig';

type IconName = keyof typeof Ionicons.glyphMap;

export const MAX_SCREENSHOTS = 8; // same as the server
const MAX_SCREENSHOT_BYTES = 12 * 1024 * 1024; // the server's per-file limit

// ─── This app session ─────────────────────────────────────────────────────────
// Kept on the phone (the server doesn't store a link that failed), so a retry
// can offer the same link, an import that failed while the owner was away
// from the progress screen still opens on the retry options, and a banner
// that was closed stays closed.

const sessionLinks = new Map<string, string>();
const openImports = new Set<string>();
const closedBanners = new Set<string>();
const bannerKey = (s: Stay) => `${s._id}:${s.importJob?.finishedAt || ''}`;

export const importSession = {
  /** This phone started an import on draft `id` (from `url`, when there was a link). */
  started(id: string, url: string | null) {
    openImports.add(id);
    if (url) sessionLinks.set(id, url);
  },
  /** Started here, and the owner hasn't seen how it ended yet. */
  isOpen: (id: string) => openImports.has(id),
  settle(id: string) {
    openImports.delete(id);
  },
  link: (id: string) => sessionLinks.get(id) || null,
  /** Hide the wizard's banner for this import's outcome ("Fill it in myself", or closed). */
  closeBanner(s: Stay) {
    closedBanners.add(bannerKey(s));
  },
};

/** Only a new draft (never approved) can be filled from another listing. */
export const canImportInto = (s: Stay) => s.status === 'draft' && !s.moderation?.approvedAt;

/** Start (or, with stayId, retry) an import; resolves with the draft it's filling. */
async function startImport(opts: { url?: string | null; stayId?: string; screenshots?: UploadFile[] }): Promise<Stay> {
  const url = opts.url?.trim() || undefined;
  const res = await staysAPI.importListing({
    url,
    confirmOwnership: true,
    importPhotos: true,
    stayId: opts.stayId,
    screenshots: opts.screenshots?.length ? opts.screenshots : undefined,
  });
  const data = res?.data;
  if (!data?._id) throw new Error(res?.message || "Couldn't start the import");
  const stay: Stay = { ...data, _id: String(data._id) };
  importSession.started(stay._id, url || null);
  return stay;
}

// ─── Links ────────────────────────────────────────────────────────────────────

// Same list as detectPlatform on the server.
const SITES: [RegExp, string][] = [
  [/(^|\.)airbnb\./, 'Airbnb'],
  [/(^|\.)booking\.com$/, 'Booking.com'],
  [/(^|\.)makemytrip\.com$/, 'MakeMyTrip'],
  [/(^|\.)goibibo\.com$/, 'Goibibo'],
  [/(^|\.)agoda\./, 'Agoda'],
  [/(^|\.)expedia\./, 'Expedia'],
  [/(^|\.)tripadvisor\./, 'Tripadvisor'],
  [/(^|\.)hostelworld\./, 'Hostelworld'],
  [/(^|\.)vrbo\./, 'Vrbo'],
  [/(^|\.)zostel\./, 'Zostel'],
  [/(^|\.)google\./, 'Google'],
];
const siteOf = (url: string) => {
  const host = (String(url).match(/^https?:\/\/([^/?#:]+)/i)?.[1] || '').toLowerCase();
  return host ? SITES.find(([re]) => re.test(host))?.[1] || null : null;
};

/**
 * The link in what was pasted: share sheets wrap it in text ("Check out this
 * place on Airbnb! https://…"), and a bare "booking.com/hotel/…" gets https://.
 */
export function cleanLink(text: string): string {
  const t = String(text || '').trim();
  const found = t.match(/https?:\/\/[^\s<>"']+/i);
  if (found) return found[0].replace(/[).,;!?]+$/, '');
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]\S*)?$/i.test(t)) return `https://${t}`;
  return t;
}
const looksLikeLink = (u: string) => /^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i.test(u);

// ─── Bits ─────────────────────────────────────────────────────────────────────

function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

const announce = (text: string) => AccessibilityInfo.announceForAccessibility(text);

function LinkField({
  value,
  onChange,
  error,
  disabled,
  label = 'Your listing link',
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
  label?: string;
}) {
  const p = usePalette();
  const site = value.trim() ? siteOf(cleanLink(value)) : null;
  const paste = async () => {
    try {
      const text = cleanLink(await Clipboard.getStringAsync());
      if (text) onChange(text);
      else Toast.show({ type: 'info', text1: 'Nothing to paste', text2: 'Copy the link to your listing first (Share, then Copy link).' });
    } catch {
      // Clipboard not available: the field still takes a long-press paste.
    }
  };
  return (
    <View>
      <View style={styles.labelRow}>
        <FieldLabel label={label} />
        <TouchableOpacity
          onPress={paste}
          disabled={disabled}
          style={styles.pasteBtn}
          accessibilityRole="button"
          accessibilityLabel="Paste the link"
          hitSlop={8}
        >
          <Ionicons name="clipboard-outline" size={15} color={p.brand} />
          <Text style={[styles.linkText, { color: p.brand }]}>Paste</Text>
        </TouchableOpacity>
      </View>
      <RNTextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        placeholder="https://www.booking.com/hotel/in/…"
        placeholderTextColor={p.c.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
        returnKeyType="done"
        accessibilityLabel={label}
        style={[styles.input, { color: p.c.text, borderColor: error ? p.danger : p.c.fieldBorder, backgroundColor: p.c.field }]}
      />
      {error ? (
        <Text style={[styles.small, styles.fieldNote, { color: p.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : site ? (
        <View style={[styles.siteRow, styles.fieldNote]}>
          <Ionicons name="checkmark-circle" size={14} color={p.success} />
          <Text style={[styles.small, { color: p.c.textSecondary }]}>{site} listing</Text>
        </View>
      ) : (
        <Text style={[styles.small, styles.fieldNote, { color: p.c.textTertiary }]}>
          In their app, open your listing, tap Share and then Copy link.
        </Text>
      )}
    </View>
  );
}

interface Shot {
  key: string;
  file: UploadFile;
}

/** Up to 8 screenshots from the photo library, in the order they were picked. */
function useScreenshots() {
  const [shots, setShots] = useState<Shot[]>([]);
  const countRef = useRef(0);
  countRef.current = shots.length;

  const pick = useCallback(async () => {
    const room = MAX_SCREENSHOTS - countRef.current;
    if (room <= 0) {
      Toast.show({ type: 'info', text1: `Up to ${MAX_SCREENSHOTS} screenshots`, text2: 'Remove one to add another.' });
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access in Settings to add screenshots.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        orderedSelection: true,
        quality: 0.8,
      });
      if (r.canceled || !r.assets?.length) return;
      let tooBig = 0;
      const picked: Shot[] = [];
      r.assets.forEach((a, i) => {
        if (a.fileSize && a.fileSize > MAX_SCREENSHOT_BYTES) {
          tooBig++;
          return;
        }
        picked.push({ key: a.assetId || a.uri, file: toUploadFile(a, `screenshot-${i + 1}.jpg`) });
      });
      setShots((prev) => {
        const have = new Set(prev.map((s) => s.key));
        return [...prev, ...picked.filter((s) => !have.has(s.key))].slice(0, MAX_SCREENSHOTS);
      });
      if (r.assets.length > room) Toast.show({ type: 'info', text1: `Added the first ${room}`, text2: `Up to ${MAX_SCREENSHOTS} screenshots.` });
      if (tooBig) Toast.show({ type: 'error', text1: `${plural(tooBig, 'screenshot')} too large`, text2: 'Use images under 12 MB.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't open your photos", text2: apiError(e, 'Try again.') });
    }
  }, []);

  const remove = useCallback((key: string) => setShots((prev) => prev.filter((s) => s.key !== key)), []);
  return { shots, pick, remove };
}

function ScreenshotStrip({ shots, onAdd, onRemove, disabled }: { shots: Shot[]; onAdd: () => void; onRemove: (key: string) => void; disabled?: boolean }) {
  const p = usePalette();
  return (
    <View style={styles.shots}>
      {shots.map((s, i) => (
        <View key={s.key} style={[styles.shot, { borderColor: p.c.border, backgroundColor: p.soft.gray.bg }]}>
          <Image source={{ uri: s.file.uri }} style={styles.shotImg} contentFit="cover" accessibilityLabel={`Screenshot ${i + 1}`} />
          <TouchableOpacity
            onPress={() => onRemove(s.key)}
            disabled={disabled}
            style={[styles.shotRemove, { backgroundColor: p.dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)' }]}
            accessibilityRole="button"
            accessibilityLabel={`Remove screenshot ${i + 1}`}
            hitSlop={8}
          >
            <Ionicons name="close" size={14} color={p.c.text} />
          </TouchableOpacity>
        </View>
      ))}
      {shots.length < MAX_SCREENSHOTS ? (
        <TouchableOpacity
          onPress={onAdd}
          disabled={disabled}
          style={[styles.shot, styles.shotAdd, { borderColor: p.c.border }, disabled && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={shots.length ? 'Add more screenshots' : 'Add screenshots'}
        >
          <Ionicons name="images-outline" size={20} color={p.brand} />
          <Text style={[styles.shotAddText, { color: p.brand }]}>{shots.length ? 'Add' : 'Choose'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function OwnershipCheck({ value, onChange, error, disabled }: { value: boolean; onChange: (v: boolean) => void; error?: string | null; disabled?: boolean }) {
  const p = usePalette();
  const label = 'I own or manage this property, and its photos are mine to use';
  return (
    <View>
      <TouchableOpacity
        onPress={() => onChange(!value)}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        accessibilityLabel={label}
        style={[
          styles.ownerRow,
          { borderColor: p.c.border, backgroundColor: p.c.surface },
          value && { borderColor: p.soft.blue.border, backgroundColor: p.soft.blue.bg },
          !!error && { borderColor: p.danger },
        ]}
      >
        <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={value ? p.brand : error ? p.danger : p.c.textTertiary} />
        <Text style={[styles.ownerText, { color: p.c.text }]}>{label}</Text>
      </TouchableOpacity>
      {error ? (
        <Text style={[styles.small, styles.fieldNote, { color: p.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── The form on "List your property" ─────────────────────────────────────────

type FormError = { on: 'link' | 'owner' | 'server'; text: string } | null;

export function ImportListingCard({ onStarted }: { onStarted: (stay: Stay) => void }) {
  const p = usePalette();
  const mounted = useMounted();
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState(false);
  const [showShots, setShowShots] = useState(false);
  const { shots, pick, remove } = useScreenshots();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError>(null);

  // Screenshots answer "paste the link, or add screenshots".
  useEffect(() => {
    if (shots.length) setError((e) => (e?.on === 'link' && !url.trim() ? null : e));
  }, [shots.length, url]);

  const fail = (e: NonNullable<FormError>) => {
    setError(e);
    announce(e.text);
  };

  const start = async () => {
    const link = url.trim() ? cleanLink(url) : '';
    if (link !== url) setUrl(link);
    if (!link && !shots.length) return fail({ on: 'link', text: 'Paste the link to your listing, or add screenshots of it.' });
    if (link && !looksLikeLink(link)) return fail({ on: 'link', text: 'Paste the full link. It starts with https://' });
    if (!owner) return fail({ on: 'owner', text: 'Tick the box to confirm this is your property.' });
    setError(null);
    setBusy(true);
    try {
      const stay = await startImport({ url: link || null, screenshots: shots.map((s) => s.file) });
      // Left meanwhile: the import runs anyway, and the draft is in the list.
      if (mounted.current) onStarted(stay); // the screen moves on to the draft
    } catch (e) {
      if (!mounted.current) return;
      setBusy(false);
      fail({ on: 'server', text: apiError(e, "Couldn't start the import. Try again.") });
    }
  };

  const openShots = () => {
    setShowShots(true);
    pick();
  };

  return (
    <View style={[styles.card, { backgroundColor: p.c.card, borderColor: p.soft.blue.border }]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: colors.primary[500] }]}>
          <Ionicons name="sparkles" size={20} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: p.c.text }]} accessibilityRole="header">
            Already listed on Airbnb, Booking.com, MakeMyTrip or Agoda?
          </Text>
          <Text style={[styles.cardLead, { color: p.c.textSecondary }]}>
            Paste the link and we fill in your details, rooms, prices, rules and photos. You check everything before you submit.
          </Text>
        </View>
      </View>

      <LinkField
        value={url}
        onChange={(v) => {
          setUrl(v);
          if (error?.on === 'link' || error?.on === 'server') setError(null);
        }}
        error={error?.on === 'link' ? error.text : null}
        disabled={busy}
      />

      {showShots || shots.length ? (
        <View style={styles.shotsBlock}>
          <FieldLabel label="Screenshots of your listing" optional />
          <Text style={[styles.small, { color: p.c.textSecondary }]}>
            {`Up to ${MAX_SCREENSHOTS}: the photos and description, the rooms and prices, and the house rules. Use them when a site won't let us read the link.`}
          </Text>
          <ScreenshotStrip shots={shots} onAdd={pick} onRemove={remove} disabled={busy} />
        </View>
      ) : (
        <TouchableOpacity onPress={openShots} disabled={busy} style={styles.textBtn} accessibilityRole="button" hitSlop={6}>
          <Ionicons name="images-outline" size={16} color={p.brand} />
          <Text style={[styles.linkText, { color: p.brand }]}>Upload screenshots instead</Text>
        </TouchableOpacity>
      )}

      <OwnershipCheck
        value={owner}
        onChange={(v) => {
          setOwner(v);
          if (error?.on === 'owner') setError(null);
        }}
        error={error?.on === 'owner' ? error.text : null}
        disabled={busy}
      />

      {error?.on === 'server' ? (
        <Banner tone="red">
          <Text style={[styles.bannerText, { color: p.soft.red.fg }]} accessibilityLiveRegion="polite">
            {error.text}
          </Text>
        </Banner>
      ) : null}

      <Button
        title="Import my listing"
        onPress={start}
        loading={busy}
        fullWidth
        icon={<Ionicons name="cloud-download-outline" size={18} color="#fff" />}
      />
    </View>
  );
}

// ─── While it runs ────────────────────────────────────────────────────────────

const PROGRESS_STEPS: { label: string; icon: IconName }[] = [
  { label: 'Reading your listing', icon: 'link-outline' },
  { label: 'Filling in details', icon: 'sparkles-outline' },
  { label: 'Copying photos', icon: 'images-outline' },
];
const stepIndex = (job: ImportJob) => (job.step === 'photos' ? 2 : job.step === 'understanding' ? 1 : 0);

const POLL_MS = 2000;
const SLOW_MS = 60 * 1000;
const GIVE_UP_MS = 4 * 60 * 1000;

/** A soft ring pulsing out of the icon while work goes on (still when Reduce Motion is on). */
function Pulse({ on, children }: { on: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      v.setValue(0);
      return undefined;
    }
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled || reduce) return;
        loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
        loop.start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [on, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary[500], opacity, transform: [{ scale }] }]} />
      <View style={[styles.pulseCore, { backgroundColor: colors.primary[500] }]}>{children}</View>
    </View>
  );
}

type StepState = 'done' | 'active' | 'stalled' | 'todo';

function ProgressStep({ label, icon, state }: { label: string; icon: IconName; state: StepState }) {
  const p = usePalette();
  const lit = useRef(new Animated.Value(state === 'todo' ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(lit, { toValue: state === 'todo' ? 0 : 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [state, lit]);
  const opacity = lit.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const scale = lit.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const dotBg = state === 'done' ? p.success : state === 'active' ? colors.primary[500] : state === 'stalled' ? p.soft.amber.bg : p.soft.gray.bg;
  const said = state === 'done' ? 'done' : state === 'active' ? 'in progress' : state === 'stalled' ? 'taking a while' : 'next';
  return (
    <Animated.View style={[styles.stepRow, { opacity }]} accessible accessibilityLabel={`${label}: ${said}`}>
      <Animated.View style={[styles.stepDot, { backgroundColor: dotBg, transform: [{ scale }] }]}>
        {state === 'done' ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : state === 'active' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : state === 'stalled' ? (
          <Ionicons name="time-outline" size={16} color={p.soft.amber.fg} />
        ) : (
          <Ionicons name={icon} size={15} color={p.c.textTertiary} />
        )}
      </Animated.View>
      <Text style={[styles.stepLabel, { color: state === 'todo' ? p.c.textSecondary : p.c.text }, state === 'active' && styles.bold]}>{label}</Text>
    </Animated.View>
  );
}

/**
 * Full screen while the import fills the draft: polls it every 2 s while this
 * screen is in front (stops on blur and unmount) and hands the draft back once
 * the import is done or failed. Gives up waiting after 4 minutes, with a way
 * to check again (the server itself fails an import stuck for 6).
 */
export function ImportProgress({ stay, onFinished, onBack }: { stay: Stay; onFinished: (stay: Stay) => void; onBack: () => void }) {
  const p = usePalette();
  const id = stay._id;
  const [job, setJob] = useState<ImportJob>(stay.importJob || {});
  const [slow, setSlow] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [lost, setLost] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  useFocusEffect(
    useCallback(() => {
      if (gaveUp || lost) return undefined;
      let stop = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const tick = async () => {
        try {
          const res = await staysAPI.getMine(id);
          if (stop) return;
          const data = res?.data;
          if (data?._id) {
            const next: ImportJob = data.importJob || {};
            setJob(next);
            if (next.status !== 'running') {
              stop = true;
              finished.current({ ...data, _id: String(data._id) });
              return;
            }
          }
        } catch (e: any) {
          if (stop) return;
          const status = Number(e?.status) || 0;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            setLost(status === 404 ? "This property doesn't exist or isn't yours." : apiError(e, "Couldn't check on the import."));
            return;
          }
          // No signal or a slow server: keep checking.
        }
        const waited = Date.now() - startedAt.current;
        if (waited > GIVE_UP_MS) {
          setGaveUp(true);
          return;
        }
        if (waited > SLOW_MS) setSlow(true);
        timer = setTimeout(tick, POLL_MS);
      };
      timer = setTimeout(tick, POLL_MS);
      return () => {
        stop = true;
        if (timer) clearTimeout(timer);
      };
    }, [id, gaveUp, lost]),
  );

  const checkAgain = () => {
    startedAt.current = Date.now();
    setSlow(false);
    setLost(null);
    setGaveUp(false);
  };

  const at = stepIndex(job);
  const waiting = !gaveUp && !lost;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.c.backgroundSecondary }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Importing your listing" onBack={onBack} backLabel="Back to my properties" />
      <ScrollView contentContainerStyle={styles.progressBody}>
        <Pulse on={waiting}>
          <Ionicons name="sparkles" size={30} color="#fff" />
        </Pulse>
        <Text style={[styles.progressTitle, { color: p.c.text }]} accessibilityRole="header">
          Importing your listing
        </Text>
        <Text style={[styles.progressMsg, { color: p.c.textSecondary }]} accessibilityLiveRegion="polite">
          {job.message || 'Starting…'}
        </Text>

        <View style={[styles.stepsCard, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
          {PROGRESS_STEPS.map((s, i) => (
            <ProgressStep key={s.label} label={s.label} icon={s.icon} state={i < at ? 'done' : i === at ? (waiting ? 'active' : 'stalled') : 'todo'} />
          ))}
        </View>

        {lost ? (
          <View style={styles.progressActions}>
            <Banner tone="red">{lost}</Banner>
            <Button title="Try again" onPress={checkAgain} fullWidth />
            <Button title="Back to my properties" variant="outline" onPress={onBack} fullWidth />
          </View>
        ) : gaveUp ? (
          <View style={styles.progressActions}>
            <Banner tone="amber">
              This is taking longer than usual. It may still finish: check again in a minute, or come back to it later from your properties.
            </Banner>
            <Button title="Check again" onPress={checkAgain} fullWidth icon={<Ionicons name="refresh" size={18} color="#fff" />} />
            <Button title="Back to my properties" variant="outline" onPress={onBack} fullWidth />
          </View>
        ) : (
          <Text style={[styles.progressFoot, { color: p.c.textTertiary }]}>
            {slow
              ? 'Still working. Big listings with lots of photos take a little longer.'
              : 'This usually takes under a minute. You can leave this screen; the import keeps going.'}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── When it didn't work ──────────────────────────────────────────────────────

/**
 * Full screen after a failed import: the server's reason, then a retry on the
 * same draft with screenshots or with the link, or "Fill it in myself" (the
 * wizard, on the draft as it is).
 */
export function ImportFailed({
  stay,
  onStarted,
  onFillMyself,
  onBack,
}: {
  stay: Stay;
  onStarted: (stay: Stay) => void;
  onFillMyself: () => void;
  onBack: () => void;
}) {
  const p = usePalette();
  const mounted = useMounted();
  const job = stay.importJob || {};
  const blocked = job.code === 'BLOCKED';
  const [url, setUrl] = useState(() => importSession.link(stay._id) || stay.source?.url || '');
  const { shots, pick, remove } = useScreenshots();
  const [busy, setBusy] = useState<'link' | 'shots' | null>(null);
  const [error, setError] = useState<{ on: 'link' | 'shots'; text: string } | null>(null);

  const fail = (on: 'link' | 'shots', text: string) => {
    setError({ on, text });
    announce(text);
  };

  const retry = async (via: 'link' | 'shots') => {
    let link = '';
    if (via === 'link') {
      link = cleanLink(url);
      if (link !== url) setUrl(link);
      if (!link) return fail('link', 'Paste the link to your listing.');
      if (!looksLikeLink(link)) return fail('link', 'Paste the full link. It starts with https://');
    } else if (!shots.length) {
      return pick();
    }
    setError(null);
    setBusy(via);
    try {
      // Same draft, same property: the owner confirmed it's theirs when this
      // draft's first import started (the server starts none without that).
      const next = await startImport({
        stayId: stay._id,
        url: via === 'link' ? link : null,
        screenshots: via === 'shots' ? shots.map((s) => s.file) : undefined,
      });
      if (mounted.current) onStarted(next);
    } catch (e: any) {
      if (e?.status === 409) {
        // One is already running on this draft (started from another device?): show it.
        try {
          const res = await staysAPI.getMine(stay._id);
          if (mounted.current && res?.data?._id && res.data.importJob?.status === 'running') return onStarted({ ...res.data, _id: String(res.data._id) });
        } catch {
          // Fall through to the message.
        }
      }
      if (!mounted.current) return;
      setBusy(null);
      fail(via, apiError(e, "Couldn't start the import. Try again."));
    }
  };

  const shotsCard = (
    <View key="shots" style={[styles.card, { backgroundColor: p.c.card, borderColor: blocked ? p.soft.blue.border : p.c.border }]}>
      <View style={styles.optionHead}>
        <Ionicons name="images-outline" size={18} color={p.brand} />
        <Text style={[styles.optionTitle, { color: p.c.text }]} accessibilityRole="header">
          Upload screenshots
        </Text>
      </View>
      <Text style={[styles.small, { color: p.c.textSecondary }]}>
        3–6 screenshots of your listing work best: the photos and description, the rooms and prices, and the house rules.
      </Text>
      {shots.length ? <ScreenshotStrip shots={shots} onAdd={pick} onRemove={remove} disabled={!!busy} /> : null}
      {error?.on === 'shots' ? (
        <Text style={[styles.small, { color: p.danger }]} accessibilityLiveRegion="polite">
          {error.text}
        </Text>
      ) : null}
      <Button
        title={shots.length ? `Import from ${plural(shots.length, 'screenshot')}` : 'Upload screenshots'}
        onPress={() => retry('shots')}
        loading={busy === 'shots'}
        disabled={busy === 'link'}
        variant={blocked || shots.length ? 'primary' : 'outline'}
        fullWidth
        icon={<Ionicons name={shots.length ? 'cloud-upload-outline' : 'images-outline'} size={18} color={blocked || shots.length ? '#fff' : colors.primary[500]} />}
      />
    </View>
  );

  const linkCard = (
    <View key="link" style={[styles.card, { backgroundColor: p.c.card, borderColor: blocked ? p.c.border : p.soft.blue.border }]}>
      <View style={styles.optionHead}>
        <Ionicons name="link-outline" size={18} color={p.brand} />
        <Text style={[styles.optionTitle, { color: p.c.text }]} accessibilityRole="header">
          Try the link again
        </Text>
      </View>
      <LinkField
        value={url}
        onChange={(v) => {
          setUrl(v);
          if (error?.on === 'link') setError(null);
        }}
        error={error?.on === 'link' ? error.text : null}
        disabled={!!busy}
      />
      <Button
        title="Try the link again"
        onPress={() => retry('link')}
        loading={busy === 'link'}
        disabled={busy === 'shots'}
        variant={blocked ? 'outline' : 'primary'}
        fullWidth
        icon={<Ionicons name="refresh" size={18} color={blocked ? colors.primary[500] : '#fff'} />}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.c.backgroundSecondary }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Import didn't work" onBack={onBack} backLabel="Back to my properties" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.failBody} keyboardShouldPersistTaps="handled">
          <View style={styles.failHead}>
            <View style={[styles.failIcon, { backgroundColor: p.soft.amber.bg }]}>
              <Ionicons name="alert-circle-outline" size={30} color={p.soft.amber.fg} />
            </View>
            <Text style={[styles.progressTitle, { color: p.c.text }]} accessibilityRole="header">
              We couldn't import your listing
            </Text>
            <Text style={[styles.progressMsg, { color: p.c.textSecondary }]}>
              {job.message || 'Something went wrong reading that listing. Try again, or upload screenshots instead.'}
            </Text>
          </View>

          {blocked ? [shotsCard, linkCard] : [linkCard, shotsCard]}

          <View style={styles.fillMyself}>
            <Button title="Fill it in myself" variant="ghost" onPress={onFillMyself} disabled={!!busy} fullWidth />
            <Text style={[styles.small, styles.center, { color: p.c.textTertiary }]}>Go through the steps and enter the details yourself.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── In the wizard afterwards ─────────────────────────────────────────────────

const listJoin = (parts: (string | null)[]) => {
  const xs = parts.filter((x): x is string => !!x);
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
};

/**
 * At the top of a draft's wizard: after a done import, where it came from,
 * what it filled in and what to check (closable); after a failed one, why,
 * with "Try again" when `onRetry` is given.
 */
export function ImportBanner({ stay, onRetry }: { stay: Stay; onRetry?: () => void }) {
  const p = usePalette();
  const key = bannerKey(stay);
  const [closed, setClosed] = useState(() => closedBanners.has(key));
  const job = stay.importJob;
  if (!job?.status || job.status === 'running' || !canImportInto(stay) || closed) return null;

  const close = () => {
    closedBanners.add(key);
    setClosed(true);
  };

  if (job.status === 'failed') {
    if (!onRetry) return null;
    const t = p.soft.amber;
    return (
      <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]}>
        <View style={styles.bannerHead}>
          <Ionicons name="alert-circle" size={18} color={t.fg} />
          <Text style={[styles.bannerTitle, { color: t.fg }]}>The import didn't work</Text>
          <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={t.fg} />
          </TouchableOpacity>
        </View>
        {job.message ? <Text style={[styles.bannerText, { color: t.fg }]}>{job.message}</Text> : null}
        <View style={styles.bannerActions}>
          <LinkButton compact icon="refresh" label="Try the import again" onPress={onRetry} />
        </View>
      </View>
    );
  }

  const t = p.soft.green;
  const f = job.filled || {};
  const counts = listJoin([
    f.rooms ? plural(f.rooms, 'room type') : null,
    f.photos ? plural(f.photos, 'photo') : null,
    f.amenities ? plural(f.amenities, 'amenity', 'amenities') : null,
  ]);
  const platform = stay.source?.platform;
  const title =
    platform === 'Screenshots'
      ? 'Imported from your screenshots'
      : platform
        ? `Imported from ${platform}`
        : (job.message || 'Imported').replace(/\.$/, '');
  const warnings = job.warnings || [];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={styles.bannerHead}>
        <Ionicons name="checkmark-circle" size={18} color={t.fg} />
        <Text style={[styles.bannerTitle, { color: t.fg }]} accessibilityRole="header">
          {title}
        </Text>
        <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={t.fg} />
        </TouchableOpacity>
      </View>
      {counts ? <Text style={[styles.bannerText, { color: t.fg }]}>{`We filled in ${counts}.`}</Text> : null}
      {warnings.length ? (
        <View style={styles.warnList}>
          <Text style={[styles.warnHead, { color: t.fg }]}>Worth checking</Text>
          {warnings.map((w, i) => (
            <View key={`${i}:${w}`} style={styles.warnRow}>
              <Ionicons name="alert-circle-outline" size={15} color={p.warning} style={styles.warnIcon} />
              <Text style={[styles.bannerText, styles.flex, { color: t.fg }]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.bannerText, styles.bold, { color: t.fg }]}>Check each step, add your licence and submit for review.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: fontWeight.semibold },
  center: { textAlign: 'center' },
  disabled: { opacity: 0.45 },
  small: { fontSize: fontSize.xs, lineHeight: 16 },

  card: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 21 },
  cardLead: { fontSize: fontSize.sm, lineHeight: 19, marginTop: 2 },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pasteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, marginBottom: spacing.xs },
  linkText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  input: { borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, minHeight: 48, fontSize: fontSize.sm },
  fieldNote: { marginTop: spacing.xs },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, alignSelf: 'flex-start' },

  shotsBlock: { gap: spacing.sm },
  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shot: { width: 64, height: 112, borderRadius: borderRadius.md, borderWidth: 1, overflow: 'hidden' },
  shotImg: { width: '100%', height: '100%' },
  shotRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  shotAdd: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 4 },
  shotAddText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  ownerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  ownerText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },

  pulseWrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  pulseRing: { position: 'absolute', width: 64, height: 64, borderRadius: 32 },
  pulseCore: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  progressBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] },
  progressTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  progressMsg: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  stepsCard: { alignSelf: 'stretch', borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.md, marginTop: spacing['2xl'] },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { flex: 1, fontSize: fontSize.md },
  progressFoot: { fontSize: fontSize.xs, lineHeight: 17, textAlign: 'center', marginTop: spacing.xl, maxWidth: 320 },
  progressActions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.xl },

  failBody: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  failHead: { alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.lg, marginBottom: spacing.xl },
  failIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  fillMyself: { gap: spacing.xs, marginTop: spacing.xs },

  banner: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bannerTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  bannerText: { fontSize: fontSize.sm, lineHeight: 19 },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warnList: { gap: 4 },
  warnHead: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  warnIcon: { marginTop: 2 },
});

// Expo Router treats every file under app/ as a route; a default export keeps
// this module from warning about a missing one.
export default ImportListingCard;
