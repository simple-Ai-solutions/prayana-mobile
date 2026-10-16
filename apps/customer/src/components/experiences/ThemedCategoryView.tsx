// Themed Things-to-Do pages for every category that has no layout of its own
// (Nightlife, Food, Photo Tours, Markets and Tours do). Each family of
// categories gets its own world — palette, type, hero copy, quick filters and
// a card built for it:
//   heritage  — museum ivory & oxblood, arch-topped photos, an entry stub
//   spiritual — saffron & sandalwood, the same arch, calmer
//   wildlife  — field-guide olive & khaki, journal cards with a tag strip
//   parks     — candy pop, "admit one" ticket cards
//   action    — dark with neon lime, big uppercase posters
//   water     — ocean navy & turquoise, wave-edged cards
//   wellness  — sage & sand, soft airy cards
//   transit   — a departure board: navy & yellow rows
//   fresh     — the five group pages, clean modern cards with sub-chips
// Every figure on a card is the partner's own: rating, reviews, city, duration
// and price. Quick filters match words in the listing's own title.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FULL_W, RAIL_GAP, RAIL_PAD, usePairSnap } from '../../lib/railLayout';
import { fallbackPhoto } from '../../lib/fallbackPhoto';

type Icon = keyof typeof Ionicons.glyphMap;
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/* ─── data helpers (shared with the other category views) ─── */

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿',
  AUD: 'A$', JPY: '¥', MYR: 'RM ', IDR: 'Rp ', CHF: 'CHF ', CAD: 'C$', HUF: 'HUF ',
};
const cleanTitle = (t = '') => t.replace(/^[^\p{L}\p{N}]+/u, '').trim();
const titleOf = (a: any) => cleanTitle(a.name || a.title || '');
const imgOf = (a: any): string | null => a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
const cityOf = (a: any): string => {
  const c = a.location?.city || a.externalData?.city?.name || '';
  return /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(c) ? '' : c;
};
const ratingOf = (a: any) => Number(a.rating?.average ?? a.rating ?? 0) || 0;
const reviewsOf = (a: any) => Number(a.rating?.count ?? a.reviewCount ?? 0) || 0;
const durationOf = (a: any): string | null => {
  const d = a.duration?.label || a.duration?.display || (a.duration?.value ? `${a.duration.value} ${a.duration.unit || 'hours'}` : null);
  return d ? String(d).replace(/^1 (hour|day|minute)s\b/i, '1 $1') : null;
};
const instantOf = (a: any) => (typeof a.instantBooking === 'boolean' ? a.instantBooking : !!a.instantBooking?.enabled);
const priceOf = (a: any): string | null => {
  const p = a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? null;
  if (p == null || !(Number(p) > 0)) return null;
  const code = String(a.pricing?.currency || a.currency || 'INR').toUpperCase();
  return `${SYMBOLS[code] ?? `${code} `}${Math.round(Number(p)).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US')}`;
};
const kOf = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);
const open = (a: any) => a?._id && router.push(`/activity/${a._id}` as any);
/** Ranked by rating, weighted by how many people rated it. */
const score = (a: any) => ratingOf(a) * Math.log10(reviewsOf(a) + 10);

/* ─── themes ─── */

export type ThemeKey = 'heritage' | 'spiritual' | 'wildlife' | 'parks' | 'action' | 'water' | 'wellness' | 'transit' | 'fresh';
type Card = 'arch' | 'journal' | 'ticket' | 'poster' | 'wave' | 'soft' | 'board' | 'fresh';

type Theme = {
  card: Card;
  bg: string; surface: string; ink: string; muted: string; accent: string; accent2: string; line: string;
  heroGrad: [string, string, string];
  eyebrow: string; icon: Icon;
  headline: [string, string];          // "Walk through", "centuries"
  spotlight: string; listTitle: string;
  serif?: boolean; upper?: boolean; dark?: boolean;
  filters: { label: string; icon: Icon; match: RegExp }[];
};

export const THEMES: Record<ThemeKey, Theme> = {
  heritage: {
    card: 'arch', bg: '#F8F3EA', surface: '#FFFDF8', ink: '#2B1A12', muted: '#8A7360', accent: '#7A2E1D', accent2: '#C89B3C', line: 'rgba(122,46,29,0.14)',
    heroGrad: ['rgba(43,26,18,0.35)', 'rgba(43,26,18,0.2)', 'rgba(43,26,18,0.9)'],
    eyebrow: 'HERITAGE & HISTORY', icon: 'business', headline: ['Walk through', 'centuries'], serif: true,
    spotlight: 'Landmarks not to miss', listTitle: 'All entries & walks',
    filters: [
      { label: 'Forts & palaces', icon: 'business', match: /fort|palace|castle|quinta|citadel/i },
      { label: 'Museums', icon: 'easel', match: /museum|gallery|louvre|vatican/i },
      { label: 'Old towns', icon: 'map', match: /old town|old city|walk|quarter|heritage/i },
      { label: 'Towers & views', icon: 'eye', match: /tower|observatory|view|top/i },
      { label: 'Culture & shows', icon: 'musical-notes', match: /dance|show|culture|festival|pottery|craft/i },
    ],
  },
  spiritual: {
    card: 'arch', bg: '#FFF7EC', surface: '#FFFFFF', ink: '#3A1C05', muted: '#93765A', accent: '#C2410C', accent2: '#E9A23B', line: 'rgba(194,65,12,0.14)',
    heroGrad: ['rgba(58,28,5,0.3)', 'rgba(58,28,5,0.15)', 'rgba(58,28,5,0.88)'],
    eyebrow: 'TEMPLES & RETREATS', icon: 'flower', headline: ['Find a little', 'stillness'], serif: true,
    spotlight: 'Sacred places loved by travellers', listTitle: 'All visits & retreats',
    filters: [
      { label: 'Temples', icon: 'flower', match: /temple|mandir|shrine|pagoda/i },
      { label: 'Monasteries', icon: 'home', match: /monastery|abbey|church|cathedral|basilica|mosque/i },
      { label: 'Retreats', icon: 'leaf', match: /retreat|ashram|meditation|yoga/i },
      { label: 'City passes', icon: 'card', match: /card|pass/i },
    ],
  },
  wildlife: {
    card: 'journal', bg: '#F1EEE2', surface: '#FBF9F1', ink: '#1F2614', muted: '#76765E', accent: '#3F5A1E', accent2: '#E0A100', line: 'rgba(63,90,30,0.15)',
    heroGrad: ['rgba(20,28,10,0.35)', 'rgba(20,28,10,0.15)', 'rgba(20,28,10,0.9)'],
    eyebrow: 'WILDLIFE & SAFARI', icon: 'paw', headline: ['Into the', 'wild'],
    spotlight: 'Top sightings', listTitle: 'All safaris & nature trips',
    filters: [
      { label: 'Safaris', icon: 'car-sport', match: /safari|jeep|game drive|national park|reserve/i },
      { label: 'Forests & treks', icon: 'leaf', match: /trek|forest|hill|peak|ghat|waterfall/i },
      { label: 'Birds', icon: 'logo-twitter', match: /bird/i },
      { label: 'Marine life', icon: 'fish', match: /dolphin|whale|marine|snorkel|reef|aquarium/i },
      { label: 'Zoos & parks', icon: 'paw', match: /zoo|park|sanctuary/i },
    ],
  },
  parks: {
    card: 'ticket', bg: '#FFF4FA', surface: '#FFFFFF', ink: '#2A0A3A', muted: '#8B6E99', accent: '#E8287B', accent2: '#7C3AED', line: 'rgba(124,58,237,0.14)',
    heroGrad: ['rgba(124,58,237,0.35)', 'rgba(232,40,123,0.15)', 'rgba(42,10,58,0.88)'],
    eyebrow: 'THEME PARKS', icon: 'happy', headline: ['Screams, rides &', 'pure fun'],
    spotlight: 'Fan favourites', listTitle: 'All park tickets',
    filters: [
      { label: 'Disney & Universal', icon: 'sparkles', match: /disney|universal|warner|legoland/i },
      { label: 'Water parks', icon: 'water', match: /water ?park|aquaventure|wild wadi|splash/i },
      { label: 'Indoor & VR', icon: 'game-controller', match: /indoor|img|vr|virtual|museum of/i },
      { label: 'Combo tickets', icon: 'pricetags', match: /combo|\+|pass/i },
    ],
  },
  action: {
    card: 'poster', bg: '#0E1116', surface: '#171B22', ink: '#F4F6F8', muted: '#8A93A3', accent: '#C6FF3A', accent2: '#FF6B2C', line: 'rgba(255,255,255,0.08)',
    heroGrad: ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', '#0E1116'],
    eyebrow: 'ADVENTURE', icon: 'flash', headline: ['Go big.', 'Go wild.'], upper: true, dark: true,
    spotlight: 'Biggest thrills', listTitle: 'All adventures',
    filters: [
      { label: 'Treks', icon: 'trail-sign', match: /trek|hike|peak|summit|climb/i },
      { label: 'Rafting', icon: 'boat', match: /raft/i },
      { label: 'Paragliding', icon: 'airplane', match: /paraglid|skydiv|zipline|bungee|flying fox/i },
      { label: 'Camping', icon: 'bonfire', match: /camp|tent|night/i },
      { label: 'Waterfalls', icon: 'water', match: /waterfall|falls/i },
    ],
  },
  water: {
    card: 'wave', bg: '#F0F9FC', surface: '#FFFFFF', ink: '#082F49', muted: '#5C7C8F', accent: '#0891B2', accent2: '#0E3A5F', line: 'rgba(8,145,178,0.15)',
    heroGrad: ['rgba(8,47,73,0.35)', 'rgba(8,47,73,0.15)', 'rgba(8,47,73,0.9)'],
    eyebrow: 'WATER & CRUISES', icon: 'water', headline: ['Dive in,', 'set sail'],
    spotlight: 'Making waves', listTitle: 'All water experiences',
    filters: [
      { label: 'Scuba & snorkel', icon: 'fish', match: /scuba|snorkel|dive|diving/i },
      { label: 'Cruises', icon: 'boat', match: /cruise|yacht|dhow|boat|sail/i },
      { label: 'Rafting & kayak', icon: 'water', match: /raft|kayak|canoe|paddle/i },
      { label: 'Beaches', icon: 'sunny', match: /beach|island|coast|goa|andaman/i },
    ],
  },
  wellness: {
    card: 'soft', bg: '#F2F5EF', surface: '#FFFFFF', ink: '#1E2F25', muted: '#7A8A7E', accent: '#2F6B4F', accent2: '#C9A97A', line: 'rgba(47,107,79,0.12)',
    heroGrad: ['rgba(30,47,37,0.25)', 'rgba(30,47,37,0.1)', 'rgba(30,47,37,0.85)'],
    eyebrow: 'WELLNESS & SPA', icon: 'leaf', headline: ['Slow down,', 'feel better'], serif: true,
    spotlight: 'Most relaxing picks', listTitle: 'All wellness experiences',
    filters: [
      { label: 'Spa & baths', icon: 'water', match: /spa|bath|thermal|hammam|onsen|massage/i },
      { label: 'Yoga', icon: 'body', match: /yoga/i },
      { label: 'Ayurveda', icon: 'leaf', match: /ayurved/i },
      { label: 'Meditation', icon: 'flower', match: /meditat|retreat|mindful/i },
    ],
  },
  transit: {
    card: 'board', bg: '#F4F6FA', surface: '#FFFFFF', ink: '#0B2545', muted: '#6B7A90', accent: '#0B2545', accent2: '#FFC72C', line: 'rgba(11,37,69,0.1)',
    heroGrad: ['rgba(11,37,69,0.45)', 'rgba(11,37,69,0.25)', 'rgba(11,37,69,0.92)'],
    eyebrow: 'TRANSPORT & TRANSFERS', icon: 'car', headline: ['Get there', 'without the hassle'],
    spotlight: 'Most booked rides', listTitle: 'All transfers & passes',
    filters: [
      { label: 'Airport', icon: 'airplane', match: /airport|terminal/i },
      { label: 'Private', icon: 'car', match: /private/i },
      { label: 'Shared', icon: 'people', match: /shared|shuttle|bus/i },
      { label: 'Rail', icon: 'train', match: /rail|train|metro|tram/i },
    ],
  },
  fresh: {
    card: 'fresh', bg: '#FAFAFB', surface: '#FFFFFF', ink: '#111827', muted: '#6B7280', accent: '#FF5A3C', accent2: '#111827', line: 'rgba(17,24,39,0.08)',
    heroGrad: ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)'],
    eyebrow: 'THINGS TO DO', icon: 'compass', headline: ['', ''],
    spotlight: 'Top picks', listTitle: 'All experiences',
    filters: [],
  },
};

/** Which theme a category or group page uses. */
export function themeFor(categoryFilter: string, kind: 'group' | 'category'): ThemeKey {
  if (kind === 'group') return 'fresh';
  switch (categoryFilter) {
    case 'Cultural': case 'Historical': return 'heritage';
    case 'Spiritual': return 'spiritual';
    case 'Wildlife': return 'wildlife';
    case 'Theme Parks': return 'parks';
    case 'Adventure': case 'Trekking': case 'Sports & Recreation': return 'action';
    case 'Water Sports': return 'water';
    case 'Wellness': return 'wellness';
    case 'Transport': return 'transit';
    default: return 'fresh';
  }
}

/* ─── small pieces ─── */

function Rating({ a, t, onPhoto }: { a: any; t: Theme; onPhoto?: boolean }) {
  const r = ratingOf(a);
  if (!r) return null;
  const n = reviewsOf(a);
  return (
    <View style={[s.rating, onPhoto ? s.ratingPhoto : { backgroundColor: t.dark ? 'rgba(255,255,255,0.06)' : `${t.accent2}22` }]}>
      <Ionicons name="star" size={11} color={t.dark ? t.accent : '#F59E0B'} />
      <Text style={[s.ratingText, { color: onPhoto ? '#fff' : t.ink }]}>{r.toFixed(1)}</Text>
      {n ? <Text style={[s.ratingCount, { color: onPhoto ? 'rgba(255,255,255,0.8)' : t.muted }]}>({kOf(n)})</Text> : null}
    </View>
  );
}

function Meta({ a, t, light }: { a: any; t: Theme; light?: boolean }) {
  const city = cityOf(a);
  const dur = durationOf(a);
  const c = light ? 'rgba(255,255,255,0.9)' : t.muted;
  const ic = light ? '#fff' : t.accent;
  return (
    <View style={s.metaRow}>
      {city ? <View style={s.meta}><Ionicons name="location" size={12} color={ic} /><Text style={[s.metaText, { color: c }]} numberOfLines={1}>{city}</Text></View> : null}
      {dur ? <View style={s.meta}><Ionicons name="time-outline" size={12} color={ic} /><Text style={[s.metaText, { color: c }]}>{dur}</Text></View> : null}
    </View>
  );
}

function Price({ a, t, big }: { a: any; t: Theme; big?: boolean }) {
  const p = priceOf(a);
  if (!p) return null;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[s.from, { color: t.muted }]}>From</Text>
      <Text style={[s.price, big && { fontSize: 21 }, { color: t.ink }]}>{p}</Text>
    </View>
  );
}

function Photo({ a, style, children }: { a: any; style: any; children?: React.ReactNode }) {
  const own = imgOf(a);
  const [failed, setFailed] = useState<string | null>(null);
  const src = own && own !== failed ? own : fallbackPhoto(a);
  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: '#d6d3d1' }]}>
      {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" onError={() => own && setFailed(own)} /> : null}
      {children}
    </View>
  );
}

/* ─── cards ─── */

function ArchCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.archCard, { backgroundColor: t.surface, borderColor: t.line }, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={s.archImg}>
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} style={StyleSheet.absoluteFill} />
        {/* Low on the photo: the arch's curve would clip a top corner badge. */}
        {instantOf(a) ? <View style={[s.pill, s.pillLow, { backgroundColor: t.accent }]}><Ionicons name="flash" size={10} color="#fff" /><Text style={s.pillText}>Instant entry</Text></View> : null}
      </Photo>
      <View style={s.archBody}>
        <Meta a={a} t={t} />
        <Text style={[s.archTitle, { color: t.ink, fontFamily: t.serif ? SERIF : undefined }]} numberOfLines={2}>{titleOf(a)}</Text>
        {/* The entry stub: a dashed tear above rating and price. */}
        <View style={[s.stubLine, { borderColor: t.line }]} />
        <View style={s.footRow}>
          <Rating a={a} t={t} />
          <View style={{ flex: 1 }} />
          <Price a={a} t={t} />
        </View>
      </View>
    </Pressable>
  );
}

function JournalCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.journal, { backgroundColor: t.surface, borderColor: t.line }, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={s.journalImg}>
        <View style={[s.tape, { backgroundColor: `${t.accent2}cc` }]} />
      </Photo>
      <View style={s.journalBody}>
        <View style={[s.fieldTag, { borderColor: t.accent }]}>
          <Ionicons name="compass-outline" size={11} color={t.accent} />
          <Text style={[s.fieldTagText, { color: t.accent }]} numberOfLines={1}>{(cityOf(a) || 'Field trip').toUpperCase()}</Text>
        </View>
        <Text style={[s.journalTitle, { color: t.ink }]} numberOfLines={3}>{titleOf(a)}</Text>
        <View style={{ flex: 1 }} />
        {durationOf(a) ? <Text style={[s.metaText, { color: t.muted }]}>⏱ {durationOf(a)}</Text> : null}
        <View style={s.footRow}><Rating a={a} t={t} /><View style={{ flex: 1 }} /><Price a={a} t={t} /></View>
      </View>
    </Pressable>
  );
}

function TicketCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.ticket, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={s.ticketImg}>
        <LinearGradient colors={['rgba(124,58,237,0)', 'rgba(42,10,58,0.85)']} style={StyleSheet.absoluteFill} />
        <View style={[s.admit, { backgroundColor: t.accent2 }]}><Text style={s.admitText}>ADMIT ONE</Text></View>
        <View style={s.ticketCaption}>
          <Text style={s.ticketTitle} numberOfLines={2}>{titleOf(a)}</Text>
          <Meta a={a} t={t} light />
        </View>
      </Photo>
      <View style={[s.ticketStub, { backgroundColor: t.surface }]}>
        <View style={[s.notch, s.notchL, { backgroundColor: t.bg }]} />
        <View style={[s.notch, s.notchR, { backgroundColor: t.bg }]} />
        <Rating a={a} t={t} />
        <View style={{ flex: 1 }} />
        {priceOf(a) ? (
          <LinearGradient colors={[t.accent, t.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ticketPrice}>
            <Text style={s.ticketPriceText}>{priceOf(a)}</Text>
          </LinearGradient>
        ) : null}
      </View>
    </Pressable>
  );
}

function PosterCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.poster, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(14,17,22,0.95)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.posterTop}>
        {durationOf(a) ? <View style={[s.neon, { borderColor: t.accent }]}><Text style={[s.neonText, { color: t.accent }]}>{durationOf(a)!.toUpperCase()}</Text></View> : null}
        <View style={{ flex: 1 }} />
        <Rating a={a} t={t} onPhoto />
      </View>
      <View style={s.posterFoot}>
        {cityOf(a) ? <Text style={[s.posterCity, { color: t.accent }]}>{cityOf(a).toUpperCase()}</Text> : null}
        <Text style={s.posterTitle} numberOfLines={2}>{titleOf(a).toUpperCase()}</Text>
        <View style={s.posterRow}>
          {priceOf(a) ? <Text style={s.posterPrice}><Text style={s.posterFrom}>FROM </Text>{priceOf(a)}</Text> : <View />}
          <View style={[s.go, { backgroundColor: t.accent }]}><Text style={s.goText}>BOOK</Text><Ionicons name="arrow-forward" size={14} color="#0E1116" /></View>
        </View>
      </View>
    </Pressable>
  );
}

function WaveCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.wave, { backgroundColor: t.surface, borderColor: t.line }, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={s.waveImg}>
        {instantOf(a) ? <View style={[s.pill, { backgroundColor: t.accent }]}><Ionicons name="flash" size={10} color="#fff" /><Text style={s.pillText}>Instant</Text></View> : null}
        {/* A wave edge where the photo meets the card. */}
        <Svg width="100%" height={22} viewBox="0 0 400 22" preserveAspectRatio="none" style={s.waveSvg}>
          <Path d="M0 12 C 50 0, 100 24, 150 12 S 250 0, 300 12 S 380 22, 400 10 L400 22 L0 22 Z" fill={t.surface} />
        </Svg>
      </Photo>
      <View style={s.waveBody}>
        <Meta a={a} t={t} />
        <Text style={[s.waveTitle, { color: t.ink }]} numberOfLines={2}>{titleOf(a)}</Text>
        <View style={s.footRow}><Rating a={a} t={t} /><View style={{ flex: 1 }} /><Price a={a} t={t} big /></View>
      </View>
    </Pressable>
  );
}

function SoftCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.soft, { backgroundColor: t.surface }, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={s.softImg} />
      <View style={s.softBody}>
        <Text style={[s.softTitle, { color: t.ink, fontFamily: SERIF }]} numberOfLines={2}>{titleOf(a)}</Text>
        <Meta a={a} t={t} />
        <View style={s.footRow}>
          <Rating a={a} t={t} />
          <View style={{ flex: 1 }} />
          {priceOf(a) ? <View style={[s.softPrice, { backgroundColor: `${t.accent}12` }]}><Text style={[s.softPriceText, { color: t.accent }]}>from {priceOf(a)}</Text></View> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** "Beauvais Airport to/from Paris" → ["Beauvais Airport", "Paris"]. */
function routeOf(title: string): [string, string] | null {
  // Only a real "A to B" / "A to/from B" whose two ends are place-sized; a long
  // product name ("Paris Private Departure Transfer: Hotel to CDG…") stays a title.
  const head = title.split(/\s*[:(|]\s*/)[0];
  const m = head.match(/^(.+?)\s+(?:to\/from|to)\s+(.+)$/i);
  if (!m) return null;
  const [from, to] = [m[1].trim(), m[2].trim()];
  const placeSized = (x: string) => x.length >= 3 && x.length <= 26 && !/\b(private|transfer|pass|tour|ticket|day)\b/i.test(x);
  return placeSized(from) && placeSized(to) ? [from, to] : null;
}

function BoardRow({ a, t }: { a: any; t: Theme }) {
  const title = titleOf(a);
  const route = routeOf(title);
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.board, { backgroundColor: t.surface, borderColor: t.line }, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={title}>
      <Photo a={a} style={s.boardImg} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {route ? (
          <View style={s.routeRow}>
            <Text style={[s.routeTxt, { color: t.ink }]} numberOfLines={1}>{route[0]}</Text>
            <Ionicons name="arrow-forward" size={13} color={t.accent2} />
            <Text style={[s.routeTxt, { color: t.ink }]} numberOfLines={1}>{route[1]}</Text>
          </View>
        ) : (
          <Text style={[s.boardTitle, { color: t.ink }]} numberOfLines={2}>{title}</Text>
        )}
        {route ? <Text style={[s.boardSub, { color: t.muted }]} numberOfLines={1}>{title}</Text> : null}
        <View style={s.boardMeta}>
          {cityOf(a) ? <View style={[s.gate, { backgroundColor: t.accent }]}><Text style={s.gateText}>{cityOf(a).toUpperCase()}</Text></View> : null}
          {durationOf(a) ? <Text style={[s.boardDur, { color: t.muted }]}>{durationOf(a)}</Text> : null}
          <View style={{ flex: 1 }} />
          {priceOf(a) ? <Text style={[s.boardPrice, { color: t.ink }]}>{priceOf(a)}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function FreshCard({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.fresh, { backgroundColor: t.surface, borderColor: t.line }, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={s.freshImg}>
        <View style={s.freshTop}>
          {instantOf(a) ? <View style={[s.pill, { backgroundColor: '#16a34a' }]}><Ionicons name="flash" size={10} color="#fff" /><Text style={s.pillText}>Instant</Text></View> : <View />}
          <Rating a={a} t={t} onPhoto />
        </View>
      </Photo>
      <View style={s.freshBody}>
        <Meta a={a} t={t} />
        <Text style={[s.freshTitle, { color: t.ink }]} numberOfLines={2}>{titleOf(a)}</Text>
        <View style={s.footRow}><View style={{ flex: 1 }} /><Price a={a} t={t} big /></View>
      </View>
    </Pressable>
  );
}

const CARDS: Record<Card, React.FC<{ a: any; t: Theme }>> = {
  arch: ArchCard, journal: JournalCard, ticket: TicketCard, poster: PosterCard,
  wave: WaveCard, soft: SoftCard, board: BoardRow, fresh: FreshCard,
};
/** Cards that sit two across; the rest take the full width. */
const TWO_UP: Card[] = ['journal'];

/** A wide spotlight poster, styled by the theme. */
function Spotlight({ a, t }: { a: any; t: Theme }) {
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.spot, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={titleOf(a)}>
      <Photo a={a} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.spotTop}>
        <View style={[s.pill, { backgroundColor: t.dark ? t.accent : t.accent }]}>
          <Ionicons name="trophy" size={10} color={t.dark ? '#0E1116' : '#fff'} />
          <Text style={[s.pillText, t.dark && { color: '#0E1116' }]}>TOP PICK</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Rating a={a} t={t} onPhoto />
      </View>
      <View style={s.spotFoot}>
        <Meta a={a} t={t} light />
        <Text style={[s.spotTitle, { fontFamily: t.serif ? SERIF : undefined }]} numberOfLines={2}>{t.upper ? titleOf(a).toUpperCase() : titleOf(a)}</Text>
        {priceOf(a) ? <Text style={s.spotPrice}><Text style={s.spotFrom}>from </Text>{priceOf(a)}</Text> : null}
      </View>
    </Pressable>
  );
}

/* ─── the page ─── */

export function ThemedCategoryView({
  theme, items, total, loading, hasMore, loadingMore, onLoadMore, image, title, subtitle, refreshControl, onBack, query,
  subChips,
}: {
  theme: ThemeKey; items: any[]; total: number; loading: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; image: string; title: string; subtitle: string; refreshControl?: any; onBack: () => void;
  query?: string;
  /** Group pages: the sub-category chips that narrow on the server. */
  subChips?: { label: string; value: string; active: boolean; onPress: () => void }[];
}) {
  const t = THEMES[theme];
  const [filter, setFilter] = useState<number | null>(null);
  const snap = usePairSnap(FULL_W + RAIL_GAP);
  const Card = CARDS[t.card];

  // Only offer filters that match something on the page.
  const filters = useMemo(() => t.filters.filter((f) => items.some((a) => f.match.test(titleOf(a)))), [t, items]);
  const shown = useMemo(() => (filter == null || !filters[filter] ? items : items.filter((a) => filters[filter].match.test(titleOf(a)))), [items, filters, filter]);
  const spot = useMemo(() => (query ? [] : [...shown].filter((a) => ratingOf(a) >= 4 && imgOf(a)).sort((x, y) => score(y) - score(x)).slice(0, 5)), [shown, query]);
  const spotIds = new Set(spot.map((a) => a._id));
  const rest = shown.filter((a) => !spotIds.has(a._id));
  const twoUp = TWO_UP.includes(t.card);
  const [h1, h2] = t.headline[0] ? t.headline : [title, ''];
  // On the photo the eyebrow needs a light colour; fresh's own accent2 is near-black.
  const eyeColor = t.dark ? t.accent : t.card === 'fresh' ? '#FDBA74' : t.accent2;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} showsVerticalScrollIndicator={false} refreshControl={refreshControl} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero */}
      <View style={s.hero}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        <LinearGradient colors={t.heroGrad} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <Pressable onPress={onBack} hitSlop={12} style={s.back} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.heroBody}>
          <View style={[s.eyebrow, { borderColor: `${eyeColor}88` }]}>
            <Ionicons name={t.icon} size={11} color={eyeColor} />
            <Text style={[s.eyebrowText, { color: eyeColor }]}>{t.eyebrow}</Text>
          </View>
          <Text style={[s.heroH, { fontFamily: t.serif ? SERIF : undefined }, t.upper && s.heroUpper]}>
            {t.upper ? h1.toUpperCase() : h1}
            {h2 ? <Text style={{ color: t.dark ? t.accent : t.accent2 }}>{'\n'}{t.upper ? h2.toUpperCase() : h2}</Text> : null}
          </Text>
          <Text style={s.heroSub}>{t.headline[0] ? `${title} · ${subtitle}` : subtitle}</Text>
          {total > 0 ? (
            <View style={s.glass}><Ionicons name="sparkles" size={12} color="#fff" /><Text style={s.glassText}>{total.toLocaleString('en-IN')} {query ? 'matches' : 'experiences'}</Text></View>
          ) : null}
        </View>
      </View>

      {/* Sub-categories (groups) or quick filters (single categories) */}
      {subChips?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {subChips.map((c) => (
            <Pressable key={c.label} onPress={c.onPress} style={[s.chip, c.active ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.surface, borderColor: t.line }]}>
              <Text style={[s.chipText, { color: c.active ? '#fff' : t.ink }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : filters.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[{ label: 'All', icon: 'apps' as Icon }, ...filters].map((f, i) => {
            const idx = i - 1;
            const on = (filter ?? -1) === idx;
            const fg = on ? (t.dark ? '#0E1116' : '#fff') : t.ink;
            return (
              <Pressable key={f.label} onPress={() => setFilter(idx < 0 || on ? null : idx)} style={[s.chip, on ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.surface, borderColor: t.line }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Ionicons name={f.icon} size={13} color={on ? fg : t.accent} />
                <Text style={[s.chipText, { color: fg }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : <View style={{ height: 8 }} />}

      {loading ? (
        <View style={s.state}><ActivityIndicator size="large" color={t.accent} /></View>
      ) : (
        <>
          {spot.length ? (
            <View>
              <Text style={[s.secTitle, { color: t.ink, fontFamily: t.serif ? SERIF : undefined }]}>{t.spotlight}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: RAIL_PAD, gap: RAIL_GAP, paddingBottom: 6 }} ref={snap.setRef} {...snap.props}>
                {spot.map((a) => <Spotlight key={`s-${a._id}`} a={a} t={t} />)}
              </ScrollView>
            </View>
          ) : null}

          <Text style={[s.secTitle, { color: t.ink, fontFamily: t.serif ? SERIF : undefined }]}>
            {query ? `Results for "${query}"` : filter != null && filters[filter] ? filters[filter].label : t.listTitle}
          </Text>
          {rest.length === 0 && !spot.length ? (
            <Text style={[s.empty, { color: t.muted }]}>{query ? `Nothing matches "${query}" yet.` : `No ${title.toLowerCase()} found yet.`}</Text>
          ) : (
            <View style={[s.list, twoUp && s.listTwo]}>
              {rest.map((a, i) => (
                <View key={a._id || i} style={twoUp ? s.cell : undefined}><Card a={a} t={t} /></View>
              ))}
            </View>
          )}

          {hasMore && filter == null ? (
            <Pressable onPress={onLoadMore} disabled={loadingMore} style={[s.more, { borderColor: t.accent }]} accessibilityRole="button">
              {loadingMore ? <ActivityIndicator color={t.accent} /> : <Text style={[s.moreText, { color: t.accent }]}>Show more</Text>}
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const CELL_W = Math.floor((FULL_W - 12) / 2);

const s = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }] },
  hero: { height: 320, justifyContent: 'flex-end', backgroundColor: '#1f2937' },
  back: { position: 'absolute', top: 12, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroBody: { padding: 18 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  eyebrowText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  heroH: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 40, marginTop: 10 },
  heroUpper: { fontSize: 40, letterSpacing: -0.5, lineHeight: 42 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13.5, marginTop: 8, lineHeight: 19 },
  glass: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  glassText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  secTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.4, paddingHorizontal: 16, marginTop: 14, marginBottom: 12 },
  empty: { textAlign: 'center', paddingVertical: 30, fontSize: 14 },
  list: { paddingHorizontal: 16, gap: 16 },
  listTwo: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, gap: 0 },
  cell: { width: CELL_W },
  more: { marginHorizontal: 16, marginTop: 18, borderWidth: 1.5, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  moreText: { fontSize: 14, fontWeight: '800' },
  state: { paddingVertical: 60, alignItems: 'center' },

  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  ratingPhoto: { backgroundColor: 'rgba(0,0,0,0.55)' },
  ratingText: { fontSize: 12, fontWeight: '800' },
  ratingCount: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '70%' },
  metaText: { fontSize: 12.5, fontWeight: '600' },
  from: { fontSize: 10.5, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  footRow: { flexDirection: 'row', alignItems: 'flex-end' },
  pill: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  pillLow: { top: undefined, bottom: 12 },

  spot: { width: FULL_W, height: 280, borderRadius: 26, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: '#111' },
  spotTop: { flexDirection: 'row', padding: 14, alignItems: 'center' },
  spotFoot: { padding: 16, gap: 6 },
  spotTitle: { color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: -0.4, lineHeight: 27, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 },
  spotPrice: { color: '#fff', fontSize: 20, fontWeight: '900' },
  spotFrom: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // arch (heritage / spiritual)
  archCard: { borderRadius: 26, borderWidth: 1, overflow: 'hidden', padding: 10 },
  archImg: { height: 210, borderTopLeftRadius: 120, borderTopRightRadius: 120, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  archBody: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 4, gap: 8 },
  archTitle: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  stubLine: { borderTopWidth: 1, borderStyle: 'dashed', marginTop: 2 },

  // journal (wildlife)
  journal: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', padding: 8, height: 330 },
  journalImg: { height: 140, borderRadius: 12 },
  tape: { position: 'absolute', top: -4, left: '35%', width: 46, height: 16, transform: [{ rotate: '-4deg' }] },
  journalBody: { flex: 1, paddingTop: 10, paddingHorizontal: 4, gap: 6 },
  fieldTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, maxWidth: '100%' },
  fieldTagText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  journalTitle: { fontSize: 14.5, fontWeight: '800', lineHeight: 19 },

  // ticket (theme parks)
  ticket: { borderRadius: 24, overflow: 'hidden', shadowColor: '#7C3AED', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  ticketImg: { height: 220, justifyContent: 'flex-end' },
  admit: { position: 'absolute', top: 14, right: -30, transform: [{ rotate: '35deg' }], paddingHorizontal: 34, paddingVertical: 4 },
  admitText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  ticketCaption: { padding: 16, gap: 6 },
  ticketTitle: { color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: -0.4, lineHeight: 25 },
  ticketStub: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  notch: { position: 'absolute', top: -10, width: 20, height: 20, borderRadius: 10 },
  notchL: { left: -10 },
  notchR: { right: -10 },
  ticketPrice: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  ticketPriceText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // poster (adventure)
  poster: { height: 360, borderRadius: 24, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: '#171B22' },
  posterTop: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  neon: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.4)' },
  neonText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  posterFoot: { padding: 16, gap: 6 },
  posterCity: { fontSize: 11.5, fontWeight: '900', letterSpacing: 2 },
  posterTitle: { color: '#fff', fontSize: 25, fontWeight: '900', lineHeight: 28, letterSpacing: -0.3 },
  posterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  posterPrice: { color: '#fff', fontSize: 20, fontWeight: '900' },
  posterFrom: { fontSize: 11, fontWeight: '800', color: '#8A93A3', letterSpacing: 1 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  goText: { color: '#0E1116', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  // wave (water)
  wave: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  waveImg: { height: 200 },
  waveSvg: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  waveBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, gap: 8 },
  waveTitle: { fontSize: 18, fontWeight: '800', lineHeight: 23 },

  // soft (wellness)
  soft: { borderRadius: 30, overflow: 'hidden', padding: 10, shadowColor: '#2F6B4F', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  softImg: { height: 200, borderRadius: 22 },
  softBody: { padding: 10, paddingTop: 14, gap: 8 },
  softTitle: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  softPrice: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  softPriceText: { fontSize: 14, fontWeight: '800' },

  // board (transport)
  board: { flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, padding: 10, alignItems: 'center' },
  boardImg: { width: 86, height: 86, borderRadius: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeTxt: { flexShrink: 1, fontSize: 15.5, fontWeight: '900' },
  boardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 19 },
  boardSub: { fontSize: 11.5 },
  boardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  gate: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  gateText: { color: '#FFC72C', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  boardDur: { fontSize: 11.5, fontWeight: '700' },
  boardPrice: { fontSize: 16, fontWeight: '900' },

  // fresh (groups)
  fresh: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  freshImg: { aspectRatio: 16 / 9 },
  freshTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  freshBody: { padding: 14, gap: 8 },
  freshTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
});
