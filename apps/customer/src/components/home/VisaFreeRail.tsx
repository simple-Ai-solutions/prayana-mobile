// "Visa-Free & Easy-Visa Countries", ported from the web home page:
//   components/collections/CountrySpecificContent (VisaRail) + PosterTile
//   variant="passport"
//
// A passport theme: each country is a passport page with a colour-coded stamp
// for its visa type and the three facts a traveller needs — the visa, how
// long they can stay, and the one thing to have ready. Filter pills above the
// rail narrow it by visa type. The list comes live from the same
// /country-content/:code/visa-free endpoint the web uses.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight, Globe, IdCard, ShieldCheck, Ticket, Wallet, BedDouble,
} from 'lucide-react-native';
import { useTheme, spacing } from '@prayana/shared-ui';
import { countryContentAPI, makeAPICall } from '@prayana/shared-services';
import { Rail, useRailPlayback, useRailClock, usePhotoStep } from './HomeRails';
import { RAIL_GAP, TWO_UP_W } from '../../lib/railLayout';

const CARD_W = TWO_UP_W;
const PHOTO_H = Math.round(((CARD_W - 20) * 4.3) / 4); // the web's 4:4.3 photo
const GAP = RAIL_GAP;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Tone = 'green' | 'amber' | 'blue';
const VISA_TYPES: Record<string, { label: string; stamp: string; tone: Tone }> = {
  'visa-free': { label: 'Visa-free', stamp: 'Visa-free', tone: 'green' },
  'visa-on-arrival': { label: 'On arrival', stamp: 'On arrival', tone: 'amber' },
  eVisa: { label: 'eVisa', stamp: 'eVisa', tone: 'blue' },
};
const TONE = {
  green: { border: '#34D399', text: '#6EE7B7', bg: 'rgba(2,44,34,0.4)', dot: '#10B981' },
  amber: { border: '#FBBF24', text: '#FDE68A', bg: 'rgba(69,26,3,0.4)', dot: '#F59E0B' },
  blue: { border: '#38BDF8', text: '#BAE6FD', bg: 'rgba(8,47,73,0.4)', dot: '#0EA5E9' },
};

type VisaCountry = {
  name: string;
  countryCode?: string;
  description?: string;
  images?: string[];
  stayDuration?: string;
  visaPolicy: string;
  requirements?: string;
};

/** "TH" -> 🇹🇭 */
const flagOf = (code = '') =>
  /^[A-Za-z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';

/** The one requirement worth calling out, read from the listed requirements. */
function keyRequirement(req = '') {
  const r = req.toLowerCase();
  if (/voter id/.test(r)) return { label: 'Voter ID ok', Icon: IdCard };
  if (/sustainable development fee|sdf/.test(r)) return { label: 'SDF fee', Icon: Wallet };
  if (/eta|evisa approval/.test(r)) return { label: 'Apply online', Icon: Globe };
  if (/voa fee|fee/.test(r)) return { label: 'VOA fee', Icon: Wallet };
  if (/hotel|accommodation/.test(r)) return { label: 'Stay proof', Icon: BedDouble };
  if (/return ticket/.test(r)) return { label: 'Return ticket', Icon: Ticket };
  return { label: 'Passport', Icon: ShieldCheck };
}

const stayLabel = (s = '') => (/unlimited/i.test(s) ? 'No limit' : s.replace(/\s*days?/i, ' days'));

/** A raw Google photo_reference URL expires, so it is not a usable image. */
const isValidImageUrl = (url?: string) =>
  !!url && typeof url === 'string' && !url.includes('maps.googleapis.com/maps/api/place/photo');

/**
 * Countries the API sent without a usable photo get one from the same
 * batched place-images lookup the web uses (8 per request).
 */
async function withImages(items: VisaCountry[]): Promise<VisaCountry[]> {
  const queryFor = (c: VisaCountry) => `${c.name} famous landmark tourism`;
  const needed = items.filter((c) => !(c.images || []).some(isValidImageUrl));
  const found: Record<string, string> = {};
  const chunks: VisaCountry[][] = [];
  for (let i = 0; i < needed.length; i += 8) chunks.push(needed.slice(i, i + 8));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const res: any = await makeAPICall('/destinations/place-images-batch', {
        method: 'POST',
        body: JSON.stringify({
          places: chunk.map((c) => ({ placeName: queryFor(c), location: c.name, count: 1 })),
        }),
        timeout: 20000,
      });
      for (const r of res?.data || []) {
        const url = r?.data?.[0]?.url;
        if (r?.ok && url && !url.includes('pexels.com')) found[r.placeName] = url;
      }
    } catch {
      // That chunk's countries just keep the photo they had.
    }
  }));
  return items.map((c) => {
    const url = found[queryFor(c)];
    return url ? { ...c, images: [url, ...(c.images || [])] } : c;
  });
}

function PassportCard({ country, playing, tick, onPress }: {
  country: VisaCountry; playing: boolean; tick: number; onPress: () => void;
}) {
  const { isDarkMode } = useTheme();
  const vt = VISA_TYPES[country.visaPolicy] || { label: country.visaPolicy, stamp: country.visaPolicy, tone: 'amber' as Tone };
  const tone = TONE[vt.tone];
  const stay = stayLabel(country.stayDuration);
  const facts = [
    { k: 'Visa', v: vt.label },
    { k: 'Stay', v: stay },
    { k: 'Needs', v: keyRequirement(country.requirements).label },
  ];
  // Collapse doubled slashes in the path, as the web does.
  const frames = useMemo(
    () => (country.images || []).filter(isValidImageUrl).map((u) => u.replace(/([^:])\/\/+/g, '$1/')),
    [country.images],
  );
  const { photo, onLoad } = usePhotoStep(frames, playing, tick, CARD_W);
  const strap = String(country.description || '').split(/,|\.|\s+and\s+/)[0];
  // The machine-readable line at the foot of a real passport page.
  const mrz = `P<IND<<${country.name.toUpperCase().replace(/[^A-Z]/g, '<')}<<${stay.toUpperCase().replace(/[^A-Z0-9]/g, '<')}`
    .padEnd(44, '<').slice(0, 44);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isDarkMode && styles.cardDark,
        pressed && { transform: [{ scale: 0.98 }, { rotate: '-0.6deg' }] },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`${country.name}, ${vt.label}, up to ${stay}`}
    >
      <LinearGradient colors={['#1E3A8A', '#312E81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cover}>
        <Text style={styles.coverText}>PASSPORT · VISA</Text>
        <Text style={styles.flag}>{flagOf(country.countryCode)}</Text>
      </LinearGradient>

      <View style={styles.photoWrap}>
        <View style={styles.photo}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={700}
              cachePolicy="memory-disk"
              onLoad={onLoad}
            />
          ) : null}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
            locations={[0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* The entry stamp, inked at an angle with a double ring. */}
          <View style={[styles.stampHalo, { transform: [{ rotate: '-14deg' }] }]}>
            <View style={[styles.stamp, { borderColor: tone.border, backgroundColor: tone.bg }]}>
              <View style={[styles.stampInner, { borderColor: tone.border }]}>
                <Text style={[styles.stampText, { color: tone.text }]}>{vt.stamp.toUpperCase()}</Text>
                <Text style={[styles.stampSub, { color: tone.text }]}>ENTRY ✓</Text>
              </View>
            </View>
          </View>
          <View style={styles.photoBody}>
            <Text style={styles.name} numberOfLines={1}>{country.name.toUpperCase()}</Text>
            {!!strap && <Text style={styles.strap} numberOfLines={1}>{strap}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.page}>
        {/* Visa and stay side by side, what to have ready on its own line:
            three across do not fit on a half-width card. */}
        <View style={styles.facts}>
          {facts.map(({ k, v }, i) => (
            <View key={k} style={i === 2 ? styles.factWide : styles.fact}>
              <Text style={styles.factKey}>{k.toUpperCase()}</Text>
              <Text style={[styles.factVal, isDarkMode && { color: '#F3F4F6' }]} numberOfLines={1}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.mrz} numberOfLines={1}>{mrz}</Text>
        <View style={styles.ctaRow}>
          <View style={[styles.cta, isDarkMode && { backgroundColor: '#fff' }]}>
            <Text style={[styles.ctaText, isDarkMode && { color: '#111827' }]}>Explore</Text>
            <ArrowRight size={14} color={isDarkMode ? '#111827' : '#fff'} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function VisaFreeRail({ countryCode = 'IN', countryName = 'India', onCountryPress }: {
  countryCode?: string;
  countryName?: string;
  onCountryPress: (country: VisaCountry) => void;
}) {
  const { isDarkMode, themeColors } = useTheme();
  const [items, setItems] = useState<VisaCountry[] | null>(null);
  const [filter, setFilter] = useState('all');
  const railRef = useRef<ScrollView | null>(null);
  const { canPlay, scrollProps, inView } = useRailPlayback(CARD_W, GAP);
  const tick = useRailClock(inView);

  useEffect(() => {
    let alive = true;
    countryContentAPI
      .getVisaFreeCountries(countryCode, countryName)
      .then((data: any) => withImages(data?.visaFreeCountries || []))
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [countryCode, countryName]);

  if (!items || items.length === 0) return null;

  const counts = items.reduce<Record<string, number>>(
    (m, c) => ({ ...m, [c.visaPolicy]: (m[c.visaPolicy] || 0) + 1 }), {},
  );
  const filters = [
    { key: 'all', label: 'All', n: items.length, tone: undefined as Tone | undefined },
    ...Object.entries(VISA_TYPES)
      .filter(([k]) => counts[k])
      .map(([k, v]) => ({ key: k, label: v.label, n: counts[k], tone: v.tone })),
  ];
  const shown = filter === 'all' ? items : items.filter((c) => c.visaPolicy === filter);

  // The playback hook owns the rail's ref; keep our own handle to it too so a
  // filter change can scroll back to the first card.
  const setRailRef = (node: ScrollView | null) => {
    railRef.current = node;
    (scrollProps.ref as React.MutableRefObject<ScrollView | null>).current = node;
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <View style={[styles.filterGroup, isDarkMode && styles.filterGroupDark]}>
          {filters.map((f) => {
            const active = filter === f.key;
            const body = (
              <View style={styles.filterInner}>
                {f.tone && (
                  <View style={[styles.dot, { backgroundColor: TONE[f.tone].dot }, active && styles.dotActive]} />
                )}
                <Text style={[styles.filterText, { color: active ? '#fff' : themeColors.textSecondary }]}>{f.label}</Text>
                <Text style={[styles.filterText, { color: active ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }]}>{f.n}</Text>
              </View>
            );
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  if (active) return;
                  setFilter(f.key);
                  railRef.current?.scrollTo({ x: 0, animated: false });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {active ? (
                  <LinearGradient colors={['#F97316', '#E61417']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterBtn}>
                    {body}
                  </LinearGradient>
                ) : (
                  <View style={styles.filterBtn}>{body}</View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Rail scrollProps={scrollProps} contentContainerStyle={styles.rail} refCallback={setRailRef}>
        {shown.map((c, i) => (
          <PassportCard
            key={c.countryCode || c.name}
            country={c}
            playing={canPlay(i)}
            tick={tick}
            onPress={() => onCountryPress(c)}
          />
        ))}
      </Rail>

      <Text style={styles.note}>
        Visa rules change — always confirm with the embassy or official portal before you book.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  filterGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  filterGroupDark: { backgroundColor: '#111827', borderColor: '#1F2937' },
  filterBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  filterInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { fontSize: 12, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },

  rail: { gap: GAP, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 12 },
  card: {
    width: CARD_W, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#FBF7EF', borderWidth: 1, borderColor: '#E9DFC9',
    shadowColor: '#1E1B4B', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardDark: { backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' },
  cover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 7 },
  coverText: { color: '#F5D77A', fontSize: 8.5, fontWeight: '700', letterSpacing: 1.6 },
  flag: { fontSize: 15, lineHeight: 18 },

  photoWrap: { padding: 8, paddingBottom: 0 },
  photo: {
    height: PHOTO_H, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111827',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
  stampHalo: { position: 'absolute', top: 12, right: 8, borderRadius: 999, padding: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  stamp: { borderRadius: 999, borderWidth: 1.5, padding: 2 },
  stampInner: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  stampText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, lineHeight: 12 },
  stampSub: { fontSize: 7.5, fontWeight: '700', letterSpacing: 1.5, opacity: 0.8 },
  photoBody: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  name: {
    color: '#fff', fontFamily: MONO, fontSize: 16, fontWeight: '700', letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  strap: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },

  page: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 6 },
  fact: { flexGrow: 1, flexBasis: '40%', minWidth: 0 },
  factWide: { width: '100%' },
  factKey: { fontFamily: MONO, fontSize: 7, letterSpacing: 0.8, color: '#8A7A55' },
  factVal: { fontFamily: MONO, fontSize: 10.5, fontWeight: '700', color: '#1E1B4B' },
  mrz: { marginTop: 6, fontFamily: MONO, fontSize: 8, letterSpacing: 0.6, color: '#B3A47E' },
  ctaRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#111827',
  },
  ctaText: { color: '#fff', fontSize: 11.5, fontWeight: '600' },

  note: { marginTop: 4, textAlign: 'center', fontSize: 11.5, color: '#9CA3AF', paddingHorizontal: spacing.lg },
});
