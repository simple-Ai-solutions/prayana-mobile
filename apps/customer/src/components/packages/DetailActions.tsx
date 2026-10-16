// Package-detail actions and live facts, ported from the web and sized for a
// phone:
//   WeatherCard      — WeatherWidget: the weather at the destination now
//   RouteTotals      — PackageRouteMap header: total road km and drive time
//   PriceAlertButton — PriceAlertButton: "tell me when it drops below …"
//   QuoteSheet       — EnquiryModal: "Get a quote" for on-request options
//   DownloadButton   — DownloadPDF / DownloadSchedule, shared as a PDF
//   LanguageButton   — LanguageSelector: read the package in 10 languages
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@prayana/shared-hooks';
import { holidayPackagesAPI, makeAPICall } from '@prayana/shared-services';
import { useTheme } from '@prayana/shared-ui';
import { sharePackagePdf, shareSchedulePdf } from '../../utils/packagePdf';
import { cleanPhone } from '../../lib/phoneInput';

const BLUE = '#2563eb';

// ─── Weather ─────────────────────────────────────────────────────────────

type Weather = { temp: number; feels: number; humidity: number; wind: number; code: number };

/** WMO weather code -> label, icon and a one-line tip, as on the web. */
function weatherInfo(code: number): { label: string; icon: keyof typeof Ionicons.glyphMap; tip: string } {
  if (code === 0) return { label: 'Clear sky', icon: 'sunny', tip: 'Perfect for outdoor sightseeing!' };
  if (code <= 3) return { label: 'Partly cloudy', icon: 'partly-sunny', tip: 'Good weather, carry a light jacket.' };
  if (code <= 48) return { label: 'Foggy', icon: 'cloudy', tip: 'Reduced visibility, drive carefully.' };
  if (code <= 57) return { label: 'Drizzle', icon: 'rainy', tip: 'Carry an umbrella!' };
  if (code <= 67) return { label: 'Rain', icon: 'rainy', tip: 'Visit indoor attractions today.' };
  if (code <= 77) return { label: 'Snow', icon: 'snow', tip: 'Dress warm, roads may be slippery.' };
  if (code <= 82) return { label: 'Rain showers', icon: 'rainy', tip: 'Carry waterproof gear.' };
  return { label: 'Thunderstorm', icon: 'thunderstorm', tip: 'Stay indoors. Avoid open areas.' };
}

/** Today's weather at the trip's main stop, from Open-Meteo (no key needed). */
export function WeatherCard({ name, lat, lng }: { name?: string; lat?: number; lng?: number }) {
  const [w, setW] = useState<Weather | null>(null);
  useEffect(() => {
    if (lat == null || lng == null) return undefined;
    let alive = true;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature&timezone=auto&forecast_days=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const c = d?.current;
        if (alive && c) {
          setW({
            temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m), code: c.weather_code,
          });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [lat, lng]);
  if (!w) return null;
  const info = weatherInfo(w.code);
  return (
    <LinearGradient colors={['#1c2e4a', '#243b5e', '#2a4365']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.weather}>
      <View style={s.weatherIcon}>
        <Ionicons name={info.icon} size={22} color="#fde047" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.weatherKicker} numberOfLines={1}>WEATHER NOW{name ? ` · ${name.toUpperCase()}` : ''}</Text>
        <Text style={s.weatherMain}>
          {w.temp}°C <Text style={s.weatherLabel}>{info.label}</Text>
        </Text>
        <Text style={s.weatherTip} numberOfLines={1}>{info.tip}</Text>
      </View>
      <View style={s.weatherStats}>
        <Text style={s.weatherStat}><Ionicons name="water-outline" size={11} color="#67e8f9" /> {w.humidity}%</Text>
        <Text style={s.weatherStat}><Ionicons name="speedometer-outline" size={11} color="#67e8f9" /> {w.wind} km/h</Text>
        <Text style={s.weatherStat}>Feels {w.feels}°</Text>
      </View>
    </LinearGradient>
  );
}

// ─── Route totals ────────────────────────────────────────────────────────

const formatDrive = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};

export type RouteLegs = { legs: { distanceKm?: number; durationMinutes?: number }[]; totalKm: number; totalMinutes: number; complete: boolean };

export function useRouteLegs(packageId?: string, stops = 0) {
  const [route, setRoute] = useState<RouteLegs | null>(null);
  useEffect(() => {
    if (!packageId || stops < 2) return undefined;
    let alive = true;
    makeAPICall(`/packages/${packageId}/route-legs`)
      .then((r: any) => alive && r?.success && setRoute(r.data))
      .catch(() => {});
    return () => { alive = false; };
  }, [packageId, stops]);
  return route;
}

/** "147 km · 2h 54m driving" pills under the route heading. */
export function RouteTotals({ route }: { route: RouteLegs | null }) {
  const { themeColors } = useTheme();
  if (!route || !(route.totalKm > 0)) return null;
  return (
    <View style={s.routeTotals}>
      <View style={[s.routePill, { backgroundColor: themeColors.border }]}>
        <Ionicons name="flag-outline" size={12} color={themeColors.text} />
        <Text style={[s.routePillText, { color: themeColors.text }]}>
          {route.complete ? '' : '~'}{route.totalKm.toLocaleString('en-IN')} km
        </Text>
      </View>
      {route.totalMinutes > 0 && (
        <View style={[s.routePill, { backgroundColor: themeColors.border }]}>
          <Ionicons name="time-outline" size={12} color={themeColors.text} />
          <Text style={[s.routePillText, { color: themeColors.text }]}>{formatDrive(route.totalMinutes)} driving</Text>
        </View>
      )}
    </View>
  );
}

/** The drive between two stops, shown between their pills: "147 km · 2h 54m". */
export function legLabel(route: RouteLegs | null, i: number) {
  const leg = route?.legs?.[i];
  if (!leg?.distanceKm) return null;
  return `${leg.distanceKm} km${leg.durationMinutes ? ` · ${formatDrive(leg.durationMinutes)}` : ''}`;
}

// ─── Shared bottom sheet ─────────────────────────────────────────────────

function Sheet({ visible, onClose, icon, iconBg, title, sub, children }: {
  visible: boolean; onClose: () => void; icon: keyof typeof Ionicons.glyphMap; iconBg: string;
  title: string; sub: string; children: React.ReactNode;
}) {
  const { themeColors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: themeColors.surface }]}>
          <View style={s.handle} />
          <Pressable onPress={onClose} style={s.close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={themeColors.textSecondary} />
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
            <View style={[s.sheetIcon, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={18} color="#fff" />
            </View>
            <Text style={[s.sheetTitle, { color: themeColors.text }]}>{title}</Text>
            <Text style={[s.sheetSub, { color: themeColors.textSecondary }]}>{sub}</Text>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, required, error, ...input }: {
  label: string; required?: boolean; error?: string | null;
} & React.ComponentProps<typeof TextInput>) {
  const { themeColors } = useTheme();
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[s.label, { color: themeColors.textSecondary }]}>
        {label.toUpperCase()}{required ? <Text style={{ color: '#ef4444' }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={themeColors.textTertiary}
        style={[s.input, { color: themeColors.text, borderColor: error ? '#fca5a5' : themeColors.border }]}
        {...input}
      />
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

// ─── Price drop alert ────────────────────────────────────────────────────

export function PriceAlertButton({ packageId, packageTitle, currentPrice }: {
  packageId: string; packageTitle: string; currentPrice: number;
}) {
  const { user } = useAuth() as any;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const show = () => {
    setEmail((e) => e || user?.email || '');
    setTarget((t) => t || (currentPrice ? String(Math.round(currentPrice * 0.85)) : ''));
    setOpen(true);
  };
  const submit = async () => {
    const price = Number(target);
    if (!validEmail(email) || !(price > 0)) {
      Toast.show({ type: 'error', text1: 'Enter your email and a target price' });
      return;
    }
    setBusy(true);
    try {
      const res: any = await holidayPackagesAPI.createPriceAlert({ packageId, targetPrice: price, email: email.trim(), name: user?.name });
      if (res?.success) {
        setActive(price);
        setOpen(false);
        Toast.show({ type: 'success', text1: "Price alert set", text2: "We'll email you when the price drops." });
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Could not set the alert' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not set the alert' });
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    return (
      <View style={[s.alertBtn, s.alertOn]}>
        <Ionicons name="checkmark-circle" size={14} color="#15803d" />
        <Text style={[s.alertText, { color: '#15803d' }]}>Alert set for ₹{active.toLocaleString('en-IN')}</Text>
      </View>
    );
  }
  return (
    <>
      <Pressable onPress={show} style={({ pressed }) => [s.alertBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Ionicons name="notifications-outline" size={14} color="#b45309" />
        <Text style={s.alertText}>Price drop alert</Text>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        icon="notifications"
        iconBg="#f59e0b"
        title="Set a price alert"
        sub={`We'll email you when ${packageTitle} drops below your target price.`}
      >
        {currentPrice > 0 && (
          <Text style={s.current}>Current price ₹{currentPrice.toLocaleString('en-IN')} / person</Text>
        )}
        <Field label="Your target price (₹)" required value={target} onChangeText={(t) => setTarget(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 12000" />
        <Field label="Email for the alert" required value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [s.submit, { backgroundColor: BLUE }, (pressed || busy) && { opacity: 0.85 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Set alert</Text>}
        </Pressable>
      </Sheet>
    </>
  );
}

// ─── Get a quote ─────────────────────────────────────────────────────────

/**
 * A quote request is a handoff to a person, not a booking: it only needs
 * enough for someone to call back (name, phone, email), and carries the
 * package and chosen option so the team knows what was being looked at.
 */
export function QuoteSheet({ visible, onClose, destination, context }: {
  visible: boolean; onClose: () => void; destination?: string;
  context: { packageId: string; packageTitle: string; variantName?: string; quotedPrice?: number };
}) {
  const { user } = useAuth() as any;
  const [form, setForm] = useState({ name: '', phone: '', email: '', cityOfDeparture: '', destination: '' });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({
      name: user?.name || '', phone: user?.phone || '', email: user?.email || '',
      cityOfDeparture: '', destination: destination || '',
    });
    setErrors({});
  }, [visible, destination, user?.name, user?.phone, user?.email]);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.phone.replace(/\D/g, '').length < 8) e.phone = 'Enter a valid phone number';
    if (!validEmail(form.email)) e.email = 'Enter a valid email';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res: any = await makeAPICall('/enquiries', {
        method: 'POST',
        body: JSON.stringify({ ...form, pageUrl: `app://packages/${context.packageId}`, ...context }),
      });
      if (res?.success) {
        Toast.show({ type: 'success', text1: 'Enquiry sent!', text2: 'Our team will reach out within 24 hours.' });
        onClose();
      } else {
        Toast.show({ type: 'error', text1: res?.error || 'Could not send the enquiry' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not send the enquiry' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon="headset"
      iconBg="#f87171"
      title="Get a quote"
      sub="Share your details and our holiday expert will get in touch with you."
    >
      {!!context.packageTitle && (
        <View style={s.quoteFor}>
          <Ionicons name="pricetag-outline" size={13} color="#b91c1c" />
          <Text style={s.quoteForText} numberOfLines={2}>
            {context.packageTitle}{context.variantName ? ` · ${context.variantName}` : ''}
          </Text>
        </View>
      )}
      <Field label="Name" required value={form.name} onChangeText={set('name')} placeholder="Your name" error={errors.name} />
      <Field label="Phone" required value={form.phone} onChangeText={(t) => set('phone')(cleanPhone(t, { allowPlus: true }))} keyboardType="phone-pad" placeholder="Mobile number" error={errors.phone} />
      <Field label="Email" required value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} />
      <Field label="Departure city" value={form.cityOfDeparture} onChangeText={set('cityOfDeparture')} placeholder="Travelling from" />
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [s.submit, { backgroundColor: '#ef4444' }, (pressed || busy) && { opacity: 0.85 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Request a quote</Text>}
      </Pressable>
    </Sheet>
  );
}

// ─── Downloads ───────────────────────────────────────────────────────────

/** Builds the PDF on the phone and opens the share sheet (save, WhatsApp…). */
export function DownloadButton({ kind, pkg, variant, price, compact }: {
  kind: 'itinerary' | 'schedule'; pkg: any; variant?: any; price?: number; compact?: boolean;
}) {
  const { themeColors } = useTheme();
  const [busy, setBusy] = useState(false);
  if (kind === 'schedule' && !(pkg?.itinerary || []).length) return null;
  const go = async () => {
    setBusy(true);
    try {
      if (kind === 'itinerary') await sharePackagePdf(pkg, variant, price || 0);
      else await shareSchedulePdf(pkg.itinerary, pkg.title);
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't create the PDF" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      onPress={go}
      disabled={busy}
      style={({ pressed }) => [compact ? s.dlSmall : s.toolBtn, { borderColor: themeColors.border, backgroundColor: themeColors.surface }, (pressed || busy) && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={kind === 'itinerary' ? 'Download itinerary PDF' : 'Download trip schedule'}
    >
      {busy ? <ActivityIndicator size="small" color={BLUE} /> : <Ionicons name="download-outline" size={compact ? 13 : 15} color={themeColors.text} />}
      <Text style={[compact ? s.dlSmallText : s.toolText, { color: themeColors.text }]}>
        {busy ? 'Preparing…' : kind === 'itinerary' ? 'Download PDF' : 'Download'}
      </Text>
    </Pressable>
  );
}

// ─── Languages ───────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

/**
 * Reads the package in another language. `onTranslated(null)` means back to
 * the original; otherwise it receives the translated package fields.
 */
export function LanguageButton({ packageId, onTranslated }: {
  packageId: string; onTranslated: (data: any | null) => void;
}) {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [busy, setBusy] = useState<string | null>(null);
  const pick = async (code: string) => {
    if (code === lang) { setOpen(false); return; }
    if (code === 'en') {
      setLang('en'); onTranslated(null); setOpen(false); return;
    }
    setBusy(code);
    try {
      const res: any = await makeAPICall(`/packages/${packageId}/translate/${code}`, { timeout: 60000 });
      if (res?.success && res.data) {
        setLang(code);
        onTranslated(res.data);
        setOpen(false);
      } else {
        Toast.show({ type: 'error', text1: 'Translation is not available right now' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Translation is not available right now' });
    } finally {
      setBusy(null);
    }
  };
  const current = LANGUAGES.find((l) => l.code === lang)!;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.toolBtn, { borderColor: themeColors.border, backgroundColor: themeColors.surface }, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={`Language: ${current.label}`}
      >
        <Ionicons name="globe-outline" size={15} color={themeColors.text} />
        <Text style={[s.toolText, { color: themeColors.text }]}>{current.native}</Text>
        <Ionicons name="chevron-down" size={13} color={themeColors.textTertiary} />
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        icon="globe"
        iconBg={BLUE}
        title="Read in your language"
        sub="The itinerary, inclusions and notes are translated for you."
      >
        <View style={s.langGrid}>
          {LANGUAGES.map((l) => {
            const on = l.code === lang;
            return (
              <Pressable
                key={l.code}
                onPress={() => pick(l.code)}
                disabled={!!busy}
                style={[s.langItem, { borderColor: on ? BLUE : themeColors.border }, on && { backgroundColor: '#eff6ff' }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.langNative, { color: themeColors.text }]}>{l.native}</Text>
                  <Text style={[s.langLabel, { color: themeColors.textSecondary }]}>{l.label}</Text>
                </View>
                {busy === l.code
                  ? <ActivityIndicator size="small" color={BLUE} />
                  : on ? <Ionicons name="checkmark-circle" size={18} color={BLUE} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const s = StyleSheet.create({
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  toolText: { fontSize: 12.5, fontWeight: '600' },
  dlSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  dlSmallText: { fontSize: 11.5, fontWeight: '600' },
  langGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langItem: { width: '48%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  langNative: { fontSize: 15, fontWeight: '700' },
  langLabel: { fontSize: 11, marginTop: 1 },

  weather: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  weatherIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  weatherKicker: { color: 'rgba(255,255,255,0.65)', fontSize: 9.5, fontWeight: '700', letterSpacing: 1 },
  weatherMain: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 1 },
  weatherLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  weatherTip: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  weatherStats: { alignItems: 'flex-end', gap: 3 },
  weatherStat: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, fontWeight: '600' },

  routeTotals: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  routePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  routePillText: { fontSize: 12, fontWeight: '600' },

  alertBtn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8,
  },
  alertOn: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  alertText: { fontSize: 12.5, fontWeight: '600', color: '#b45309' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', marginBottom: 12 },
  close: { position: 'absolute', right: 14, top: 14, zIndex: 2 },
  sheetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  sheetSub: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  current: { marginTop: 12, fontSize: 12.5, color: '#6b7280' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  error: { marginTop: 4, fontSize: 12, color: '#ef4444' },
  submit: { marginTop: 20, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  quoteFor: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 10, padding: 10 },
  quoteForText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#991b1b' },
});

