// The three package rows of the Divya Darshana landing, ported from the web's
// components/divya-darshana:
//   HelicopterRail — HelicopterPackagesRail (gopuram-shaped photo, ॐ finial)
//   GroupDepartureRail — GroupDepartureRail (boarding pass, dates as chips)
//   LandRail — LandPackagesGrid + OvalCard (the temple-arch poster)
// Each row hides itself when the catalogue has nothing for it, as on the web.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { ClipPath, Defs, Image as SvgImage, Path, Rect } from 'react-native-svg';
import {
  ArrowRight, BedDouble, CalendarDays, Camera, Car, ChevronRight, Plane, Tent, UserRound,
  Users, UtensilsCrossed,
} from 'lucide-react-native';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { ArchPoster, ARCH_CARD_W } from '../home/ArchPoster';
import { useRailPlayback, useRailClock } from '../home/HomeRails';
import { FULL_W, RAIL_GAP, RAIL_PAD, TWO_UP_SNAP, TWO_UP_W, usePairSnap } from '../../lib/railLayout';
import {
  MONTH, archPosterNames, assignExclusiveFrames, groupPosterNames, groupStrapOf, inclusionsOf, inr,
  mrpOf, photosOf, priceOf, seatNote, upcomingDepartures, type PackagePerk,
} from '../../lib/darshana';

export const DD = {
  cream: '#FFF8E7', gold: '#D4AF37', saffron: '#FF6F00', deep: '#B8410E', maroon: '#7A1F0A',
};
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const PERK_ICONS: Record<PackagePerk, React.ComponentType<any>> = {
  Camping: Tent, Stay: BedDouble, Meals: UtensilsCrossed, Transfers: Car, Guide: UserRound, Sightseeing: Camera,
};

const readList = (r: any): any[] =>
  Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.packages) ? r.data.packages : [];

// ─── Shared section furniture ────────────────────────────────────────────

/** The gold dot · line · dot under every Darshana heading. */
export function GoldRule() {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleDot} />
      <View style={styles.ruleLine} />
      <View style={styles.ruleDot} />
    </View>
  );
}

/** Centred eyebrow, serif heading, gold rule and an optional line of copy. */
export function DarshanaHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.title}>{title}</Text>
      <GoldRule />
      {!!copy && <Text style={styles.copy}>{copy}</Text>}
    </View>
  );
}

function ViewAll({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.viewAll, pressed && { backgroundColor: DD.maroon }]}>
      {({ pressed }) => (
        <>
          <Text style={[styles.viewAllText, pressed && { color: '#fff' }]}>{label}</Text>
          <ChevronRight size={18} color={pressed ? '#fff' : DD.maroon} />
        </>
      )}
    </Pressable>
  );
}

// ─── Helicopter yatras ───────────────────────────────────────────────────

const SHRINE_W = TWO_UP_W;
// The web's gopuram silhouette (a shouldered pointed arch) in a 0–1 box,
// scaled to the photo's size since react-native-svg has no bounding-box units.
const GOPURAM = 'M0,1 L0,0.28 L0.08,0.28 L0.1,0.22 L0.15,0.22 L0.18,0.16 C0.28,0.03 0.72,0.03 0.82,0.16 L0.85,0.22 L0.9,0.22 L0.92,0.28 L1,0.28 L1,1 Z';
const scalePath = (d: string, w: number, h: number) =>
  d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${(+x * w).toFixed(1)},${(+y * h).toFixed(1)}`);

function GopuramPhoto({ uri, width, height, id }: { uri?: string; width: number; height: number; id: string }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={id}>
          <Path d={scalePath(GOPURAM, width, height)} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={DD.cream} clipPath={`url(#${id})`} />
      {!!uri && (
        <SvgImage
          href={{ uri }}
          x={0}
          y={0}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
        />
      )}
    </Svg>
  );
}

function ShrineCard({ pkg, onPress }: { pkg: any; onPress: () => void }) {
  const photo = photosOf(pkg)[0];
  const tagline = pkg.shortDescription
    || (pkg.primaryDestination
      ? `Curated helicopter yatra to ${pkg.primaryDestination}.`
      : (pkg.destinations || []).map((d: any) => d.name).filter(Boolean).join(', ') || 'Helicopter pilgrimage, thoughtfully planned.');
  const imgW = SHRINE_W - 16;
  const imgH = Math.round((imgW * 5) / 4);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shrine, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="link" accessibilityLabel={pkg.title}>
      <View style={styles.shrineTop}>
        {/* The brown hood behind the arch, out to the card's rounded edges. */}
        <LinearGradient colors={['#8B5A32', '#63391D', '#3E2211']} style={styles.shrineHood} />
        <GopuramPhoto uri={photo} width={imgW} height={imgH} id={`gopuram-${pkg._id}`} />
        <Text style={styles.omFinial}>ॐ</Text>
        <LinearGradient colors={[DD.maroon, '#B13A14', '#E07A2C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heliBadge}>
          <Plane size={11} color="#fff" strokeWidth={2.5} style={{ transform: [{ rotate: '-35deg' }] }} />
          <Text style={styles.heliBadgeText}>BY HELICOPTER</Text>
        </LinearGradient>
      </View>
      <View style={styles.shrineBody}>
        <Text style={styles.shrineTitle} numberOfLines={2}>{String(pkg.title || '').toUpperCase()}</Text>
        <GoldRule />
        <Text style={styles.shrineTag} numberOfLines={3}>{tagline}</Text>
        <LinearGradient colors={[DD.maroon, DD.deep, DD.saffron]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookBtn}>
          <Text style={styles.bookText}>BOOK</Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export function HelicopterRail({ onOpen, onViewAll }: { onOpen: (pkg: any) => void; onViewAll: () => void }) {
  const [pkgs, setPkgs] = useState<any[] | null>(null);
  const snap = usePairSnap(TWO_UP_SNAP);
  useEffect(() => {
    let alive = true;
    holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'helicopter', limit: 8 })
      .then((r: any) => alive && setPkgs(readList(r)))
      .catch(() => alive && setPkgs([]));
    return () => { alive = false; };
  }, []);
  if (!pkgs || pkgs.length === 0) return null;

  return (
    <View style={[styles.section, { backgroundColor: 'rgba(255,248,231,0.3)' }]}>
      <DarshanaHeading eyebrow="By Helicopter" title="Handpicked Helicopter Yatras" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rail, { paddingTop: 20 }]} ref={snap.ref} {...snap.props}>
        {pkgs.map((p) => <ShrineCard key={p._id} pkg={p} onPress={() => onOpen(p)} />)}
      </ScrollView>
      <ViewAll label="View all" onPress={onViewAll} />
    </View>
  );
}

// ─── Group departures ────────────────────────────────────────────────────

const NOTCH = 11;

function DateChip({ date, urgent }: { date: Date; urgent: boolean }) {
  return (
    <View style={[styles.chip, urgent && styles.chipUrgent]}>
      <Text style={styles.chipDay}>{date.getDate()}</Text>
      <Text style={styles.chipMonth}>{MONTH[date.getMonth()].toUpperCase()}</Text>
    </View>
  );
}

function DepartureCard({ pkg, index, width, pageBg, onPress }: {
  pkg: any; index: number; width: number; pageBg: string; onPress: () => void;
}) {
  const dates = upcomingDepartures(pkg);
  const photos = photosOf(pkg);
  // Rotated so neighbouring trips to the same city open on different photos.
  const photo = photos.length ? photos[index % photos.length] : undefined;
  const perks = inclusionsOf(pkg).slice(0, 4);
  const { name, rest } = groupPosterNames(pkg.title);
  // The lead price is the cheapest date, anchored to its own list price.
  const prices = dates.map((d) => priceOf(d, pkg)).filter((n): n is number => typeof n === 'number');
  const from = prices.length ? Math.min(...prices) : null;
  const cheapest = from == null ? undefined : dates.find((d) => priceOf(d, pkg) === from);
  const m = mrpOf(cheapest);
  const fromMRP = typeof m === 'number' && from != null && m > from ? m : null;
  const note = seatNote(dates[0]);
  const shown = dates.slice(0, 4);
  const more = dates.length - shown.length;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pass, { width }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="link" accessibilityLabel={pkg.title}>
      {/* ── The poster ── */}
      <View style={styles.passTop}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={250} cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={[DD.cream, '#FEF3C7']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(62,20,8,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(62,20,8,0.78)']}
          locations={[0, 0.28, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.depPill}>
          <LinearGradient colors={[DD.saffron, DD.maroon]} style={styles.depPillIcon}>
            <Users size={10} color="#fff" strokeWidth={2.6} />
          </LinearGradient>
          <Text style={styles.depPillText}>{dates.length} DEPARTURE{dates.length === 1 ? '' : 'S'}</Text>
        </View>
        {note?.tone === 'urgent' && (
          <View style={styles.urgent}><Text style={styles.urgentText}>{note.text}</Text></View>
        )}
        <View style={styles.posterText}>
          {!!rest && <Text style={styles.posterRest} numberOfLines={1}>{rest.toUpperCase()}</Text>}
          <Text style={styles.posterName} numberOfLines={1}>{name}</Text>
          <View style={styles.posterStrapRow}>
            <LinearGradient colors={['#FDE68A', DD.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.posterStrapBar} />
            <Text style={styles.posterStrap} numberOfLines={1}>{groupStrapOf(pkg.title)}</Text>
          </View>
        </View>
      </View>

      {/* The tear line, with a notch cut into each side of the pass. */}
      <View style={styles.tear}>
        <View style={[styles.notch, { left: -NOTCH, backgroundColor: pageBg }]} />
        <View style={styles.tearLine} />
        <View style={[styles.notch, { right: -NOTCH, backgroundColor: pageBg }]} />
      </View>

      {/* ── The stub ── */}
      <View style={styles.stub}>
        {/* The poster above already carries the place and the "Group tour · 2N/3D"
            strap, so the stub names the trip once rather than repeating it. */}
        <Text style={styles.passTitle} numberOfLines={1}>{String(pkg.title || '').split(/\s+[—–]\s+/)[0]}</Text>
        {perks.length > 0 && (
          <View style={styles.inclRow}>
            <Text style={styles.passLabel}>INCL.</Text>
            {perks.map((label) => {
              const Icon = PERK_ICONS[label];
              return (
                <View key={label} style={styles.incl}>
                  <Icon size={14} color={DD.saffron} strokeWidth={2} />
                  <Text style={styles.inclText}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.pickRow}>
          <CalendarDays size={12} color={DD.deep} strokeWidth={2.5} />
          <Text style={styles.pickText}>PICK A DATE</Text>
        </View>
        <View style={styles.chips}>
          {shown.map((d) => (
            <DateChip key={d._id || d.startDate} date={new Date(d.startDate)} urgent={seatNote(d)?.tone === 'urgent'} />
          ))}
          {more > 0 && (
            <View style={[styles.chip, styles.chipMore]}>
              <Text style={styles.chipMoreN}>+{more}</Text>
              <Text style={styles.chipMoreLabel}>MORE</Text>
            </View>
          )}
        </View>
        <View style={styles.fareRow}>
          {from != null ? (
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.passLabel}>FARE FROM</Text>
              <Text style={styles.fare} numberOfLines={1}>
                {inr(from)}
                {!!fromMRP && <Text style={styles.fareMrp}>  {inr(fromMRP)}</Text>}
                <Text style={styles.farePer}> / person</Text>
              </Text>
            </View>
          ) : <View />}
          <View style={styles.datesBtn}>
            <Text style={styles.datesBtnText}>View dates</Text>
            <ArrowRight size={14} color="#FFFBEB" strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function GroupDepartureRail({ onOpen, onViewAll }: { onOpen: (pkg: any) => void; onViewAll: () => void }) {
  const [pkgs, setPkgs] = useState<any[] | null>(null);
  const snap = usePairSnap(FULL_W + RAIL_GAP);
  // Which card is on screen, for the "1 of 4" counter and dots.
  const [at, setAt] = useState(0);
  const track = (e: any) => setAt(Math.round(e.nativeEvent.contentOffset.x / (FULL_W + RAIL_GAP)));
  useEffect(() => {
    let alive = true;
    holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'fixeddeparture', limit: 8 })
      .then((r: any) => alive && setPkgs(readList(r).filter((p) => upcomingDepartures(p).length > 0)))
      .catch(() => alive && setPkgs([]));
    return () => { alive = false; };
  }, []);
  if (!pkgs || pkgs.length === 0) return null;
  // One whole pass across the phone: its row of date chips needs the width.
  const cardW = FULL_W;

  return (
    <View style={[styles.section, { backgroundColor: '#fff' }]}>
      <DarshanaHeading
        eyebrow="Fixed dates, travel together"
        title="Group Departures"
        copy="Set dates, a fixed price and a coordinator throughout — you join a group of fellow pilgrims rather than planning the route yourself."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        ref={snap.ref}
        {...snap.props}
        onScrollEndDrag={(e) => { snap.props.onScrollEndDrag(e); track(e); }}
        onMomentumScrollEnd={(e) => { snap.props.onMomentumScrollEnd(e); track(e); }}
      >
        {pkgs.map((p, i) => (
          <DepartureCard key={p._id} pkg={p} index={i} width={cardW} pageBg="#fff" onPress={() => onOpen(p)} />
        ))}
      </ScrollView>
      {/* One card shows at a time, so say there are more and where you are. */}
      {pkgs.length > 1 && (
        <View style={styles.pager}>
          <View style={styles.pagerDots}>
            {pkgs.map((p, i) => (
              <Pressable
                key={p._id}
                hitSlop={8}
                onPress={() => { snap.ref.current?.scrollTo({ x: i * (FULL_W + RAIL_GAP), animated: true }); setAt(i); }}
                accessibilityLabel={`Show trip ${i + 1}`}
              >
                <View style={[styles.pagerDot, i === at && styles.pagerDotOn]} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.pagerText}>{Math.min(at, pkgs.length - 1) + 1} of {pkgs.length} · swipe for more</Text>
        </View>
      )}
      <ViewAll label="All group departures" onPress={onViewAll} />
    </View>
  );
}

// ─── Land-only packages ──────────────────────────────────────────────────

export function LandRail({ onOpen, onViewAll, onCallExpert }: {
  onOpen: (pkg: any) => void; onViewAll: () => void; onCallExpert: () => void;
}) {
  const [pkgs, setPkgs] = useState<any[] | null>(null);
  const { canPlay, scrollProps, inView } = useRailPlayback(ARCH_CARD_W, RAIL_GAP);
  const tick = useRailClock(inView);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Land-only first (both spellings are live), topped up with other
        // pilgrimage packages so the row is never a lone card.
        let list = readList(await holidayPackagesAPI.search({ category: 'Pilgrimage', tags: 'landonly,land-only', limit: 6 }));
        if (list.length < 6) {
          const extra = readList(await holidayPackagesAPI.search({ category: 'Pilgrimage', limit: 12 }));
          const seen = new Set(list.map((p) => p._id));
          list = [...list, ...extra.filter((p) => !seen.has(p._id))].slice(0, 6);
        }
        if (alive) setPkgs(list);
      } catch {
        if (alive) setPkgs([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const frames = useMemo(() => assignExclusiveFrames(pkgs || []), [pkgs]);
  if (!pkgs) return null;

  return (
    <View style={[styles.section, { backgroundColor: '#fff' }]}>
      <DarshanaHeading eyebrow="Group & Private Tours" title="Handpicked Land-only Packages" />
      {pkgs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyBadge}>COMING SOON</Text>
          <Text style={styles.emptyTitle}>New pilgrimage packages on the way</Text>
          <Text style={styles.emptyCopy}>We're curating our next set of handpicked yatras. Until then, let our team craft a custom itinerary just for you.</Text>
          <GoldRule />
          <Pressable onPress={onCallExpert} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Talk to a Yatra Expert</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} {...scrollProps}>
            {pkgs.map((p, i) => {
              const { name, rest } = archPosterNames(p);
              const start = typeof p.startPoint === 'string' ? p.startPoint : p.startPoint?.name || p.startPoint?.city;
              const price = p.platformSellingPrice || p.pricing?.startingFrom || 0;
              const n = p.duration?.nights;
              return (
                <ArchPoster
                  key={p._id}
                  frames={frames[p._id]?.length ? frames[p._id] : photosOf(p).slice(0, 1)}
                  name={name}
                  kind={upcomingDepartures(p).length > 0 ? 'Group yatra' : 'Yatra'}
                  strap={rest || (start ? `from ${start}` : p.primaryDestination)}
                  // Compact so it fits a half-width card: "5N/6D · FROM HARIDWAR".
                  eyebrow={[n > 0 && `${n}N/${p.duration?.days}D`, start && `from ${start}`].filter(Boolean).join(' · ')}
                  perks={inclusionsOf(p).slice(0, 3).map((label) => ({ label, Icon: PERK_ICONS[label] }))}
                  // Price above "per person": side by side, the label was cut to "/ per…".
                  footer={price > 0 ? (
                    <View>
                      <Text style={styles.archPrice} numberOfLines={1}>{inr(price)}</Text>
                      <Text style={styles.archPer} numberOfLines={1}>per person</Text>
                    </View>
                  ) : null}
                  cta="View"
                  playing={canPlay(i)}
                  tick={tick}
                  onPress={() => onOpen(p)}
                  accessibilityLabel={p.title}
                />
              );
            })}
          </ScrollView>
          <ViewAll label="View all" onPress={onViewAll} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 4 },
  pagerDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pagerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(122,31,10,0.22)' },
  pagerDotOn: { width: 20, backgroundColor: DD.maroon },
  pagerText: { fontSize: 11.5, fontWeight: '600', color: 'rgba(122,31,10,0.7)', letterSpacing: 0.3 },
  section: { paddingVertical: 32 },
  heading: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 2.75, color: DD.deep },
  title: { marginTop: 4, fontFamily: SERIF, fontSize: 28, lineHeight: 33, fontWeight: '700', color: DD.maroon, textAlign: 'center' },
  copy: { marginTop: 12, fontSize: 14, lineHeight: 20, color: '#4B5563', textAlign: 'center' },
  rule: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DD.gold },
  ruleLine: { width: 40, height: 1, backgroundColor: 'rgba(212,175,55,0.6)' },
  rail: { gap: RAIL_GAP, paddingHorizontal: RAIL_PAD, paddingBottom: 8 },
  viewAll: {
    marginTop: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(122,31,10,0.4)',
  },
  viewAllText: { fontSize: 16, fontWeight: '600', color: DD.maroon },

  // Helicopter
  shrine: {
    width: SHRINE_W, borderRadius: 24, paddingTop: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
    shadowColor: DD.maroon, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  shrineTop: { marginHorizontal: 8, alignItems: 'center' },
  shrineHood: { position: 'absolute', top: -14, left: -8, right: -8, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  omFinial: { position: 'absolute', top: -18, fontSize: 28, fontWeight: '700', color: DD.gold, textShadowColor: 'rgba(122,31,10,0.35)', textShadowRadius: 1, textShadowOffset: { width: 0, height: 1 } },
  heliBadge: {
    position: 'absolute', bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
    paddingLeft: 8, paddingRight: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,224,160,0.55)',
  },
  heliBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  shrineBody: { alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 18 },
  shrineTitle: { fontFamily: SERIF, fontSize: 16, fontWeight: '800', letterSpacing: 0.5, color: DD.maroon, textAlign: 'center' },
  shrineTag: { marginTop: 10, fontSize: 12, lineHeight: 16, color: '#4B5563', textAlign: 'center' },
  bookBtn: { marginTop: 14, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 },
  bookText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1.8 },

  // Group departure pass
  pass: {
    shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  passTop: { aspectRatio: 5 / 4, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', backgroundColor: DD.cream },
  depPill: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingLeft: 6, paddingRight: 10, paddingVertical: 4,
  },
  depPillIcon: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  depPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, color: DD.maroon },
  urgent: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(220,38,38,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  urgentText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  posterText: { position: 'absolute', left: 16, right: 16, bottom: 18 },
  posterRest: { fontSize: 10.5, fontWeight: '700', letterSpacing: 2.1, color: 'rgba(254,243,199,0.9)' },
  posterName: {
    fontSize: 25, lineHeight: 27, fontWeight: '800', letterSpacing: -0.4, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 },
  },
  posterStrapRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  posterStrapBar: { width: 16, height: 2, borderRadius: 1 },
  posterStrap: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
  tear: { height: 0, justifyContent: 'center', backgroundColor: '#fff', zIndex: 2 },
  notch: { position: 'absolute', top: -NOTCH, width: NOTCH * 2, height: NOTCH * 2, borderRadius: NOTCH },
  tearLine: { marginHorizontal: NOTCH + 6, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(17,24,39,0.14)' },
  stub: { backgroundColor: '#fff', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  passTitle: { fontFamily: SERIF, fontSize: 17, lineHeight: 21, fontWeight: '700', color: DD.maroon },
  inclRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  passLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: '#9CA3AF' },
  incl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inclText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
  pickRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickText: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, color: DD.deep },
  chips: { marginTop: 8, flexDirection: 'row', gap: 6 },
  chip: {
    width: 52, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: '#fff',
  },
  chipUrgent: { borderColor: 'rgba(122,31,10,0.5)', backgroundColor: 'rgba(122,31,10,0.05)' },
  chipDay: { fontSize: 15, lineHeight: 16, fontWeight: '700', color: DD.maroon },
  chipMonth: { marginTop: 2, fontSize: 9, fontWeight: '600', letterSpacing: 0.9, color: '#6B7280' },
  chipMore: { borderStyle: 'dashed', borderColor: 'rgba(212,175,55,0.5)' },
  chipMoreN: { fontSize: 13, lineHeight: 14, fontWeight: '700', color: DD.deep },
  chipMoreLabel: { marginTop: 2, fontSize: 9, fontWeight: '600', letterSpacing: 0.9, color: DD.deep },
  fareRow: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  fare: { marginTop: 4, fontSize: 19, fontWeight: '700', color: DD.maroon },
  fareMrp: { fontSize: 11, fontWeight: '400', color: '#9CA3AF', textDecorationLine: 'line-through' },
  farePer: { fontSize: 10, fontWeight: '500', color: '#6B7280' },
  datesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: DD.maroon, paddingLeft: 14, paddingRight: 12, paddingVertical: 8 },
  datesBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFBEB' },

  // Land
  archPrice: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: DD.maroon },
  archPer: { fontSize: 10, fontWeight: '500', color: '#6B7280' },
  empty: {
    marginHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: DD.cream, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center',
  },
  emptyBadge: { fontSize: 11, fontWeight: '600', letterSpacing: 2, color: DD.maroon },
  emptyTitle: { marginTop: 12, fontFamily: SERIF, fontSize: 24, fontWeight: '700', color: DD.maroon, textAlign: 'center' },
  emptyCopy: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#4B5563', textAlign: 'center' },
  emptyBtn: { marginTop: 20, borderRadius: 12, backgroundColor: DD.maroon, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
