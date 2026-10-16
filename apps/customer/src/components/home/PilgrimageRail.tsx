// "Sacred Pilgrimage Sites", the home page's temple section.
//
// Each site is a temple-arch poster (see ArchPoster): the name in gold italic
// serif, then the state, the three things the place is known for (the aarti,
// the langar, the qawwali), its rating and an Explore button. Photos step
// through the site's gallery while the card is on screen.
//
// The section around the cards is its own: the page's white with faint
// mandalas in the Divya Darshana palette, a diya divider under the heading, and in
// place of the standard progress bar a "yatra path" — a dotted route with a
// stop for every site and a lit diya that travels along it as the rail
// scrolls, lighting the stops it has passed and naming the one it's on.
import React, { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import {
  Building2, Church, Flame, Footprints, Landmark, Mountain, Music, Palette,
  Sailboat, Sparkles, TreePine, UtensilsCrossed, Waves,
} from 'lucide-react-native';
import { spacing, useTheme } from '@prayana/shared-ui';
import { Rail, useRailPlayback, useRailClock, type RailProgressProps } from './HomeRails';
import { DD } from '../divya-darshana/YatraRails';
import { ArchPoster, ARCH_CARD_W } from './ArchPoster';
import { RAIL_GAP } from '../../lib/railLayout';
import {
  PILGRIMAGE_SITES, SITE_INFO, SITE_GALLERY, type PilgrimagePlace, type PerkIcon,
} from '../../lib/pilgrimage';

const ICONS: Record<PerkIcon, React.ComponentType<any>> = {
  Building2, Church, Flame, Footprints, Landmark, Mountain, Music, Palette,
  Sailboat, Sparkles, TreePine, UtensilsCrossed, Waves,
};

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/** The whole home section: band, heading, rail and yatra path. */
export function PilgrimageSection({ onPlacePress }: {
  onPlacePress: (place: PilgrimagePlace) => void;
}) {
  const { isDarkMode, themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const [bandH, setBandH] = useState(0);
  const ink = isDarkMode ? DD.gold : DD.maroon;
  return (
    <View
      style={[styles.band, { backgroundColor: themeColors.background }]}
      onLayout={(e) => setBandH(e.nativeEvent.layout.height)}
    >
      {bandH > 0 && <Mandalas width={width} height={bandH} color={isDarkMode ? DD.gold : DD.maroon} />}
      <Text style={styles.eyebrow}>॥  TIRTH YATRA  ॥</Text>
      <Text style={[styles.title, { color: ink }]}>Sacred Pilgrimage Sites</Text>
      <Text style={[styles.subtitle, { color: isDarkMode ? 'rgba(255,248,231,0.7)' : '#7C5A44' }]}>
        India's most revered places, one stop at a time
      </Text>
      <DiyaDivider />
      <PilgrimageRail onPlacePress={onPlacePress} />
    </View>
  );
}

export function PilgrimageRail({ onPlacePress }: {
  onPlacePress: (place: PilgrimagePlace) => void;
}) {
  const { canPlay, scrollProps, inView } = useRailPlayback(ARCH_CARD_W, RAIL_GAP);
  const tick = useRailClock(inView);
  return (
    <Rail
      scrollProps={scrollProps}
      contentContainerStyle={styles.rail}
      renderProgress={(p) => <YatraPath {...p} />}
    >
      {PILGRIMAGE_SITES.map((place, i) => {
        const info = SITE_INFO[place.id];
        return (
          <ArchPoster
            key={place.id}
            frames={[...new Set([place.image, ...(SITE_GALLERY[place.id] || [])])]}
            name={place.name}
            strap={info?.strap}
            eyebrow={info?.state}
            perks={(info?.perks || []).map(([label, icon]) => ({ label, Icon: ICONS[icon] }))}
            footer={place.rating ? `★ ${place.rating} rated` : ''}
            playing={canPlay(i)}
            tick={tick}
            onPress={() => onPlacePress(place)}
            accessibilityLabel={`${place.name}${info ? `, ${info.state}` : ''}`}
          />
        );
      })}
    </Rail>
  );
}

/** ── ✦ (diya) ✦ ── under the heading. */
function DiyaDivider() {
  return (
    <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.dividerLine} />
      <Text style={styles.dividerStar}>✦</Text>
      <View style={styles.diyaSmall}>
        <Flame size={12} color={DD.saffron} fill={DD.saffron} />
      </View>
      <Text style={styles.dividerStar}>✦</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

/** Two faint mandalas behind the band, as on the Divya Darshana page. */
function Mandalas({ width, height, color }: { width: number; height: number; color: string }) {
  const mandala = (cx: number, cy: number, s: number) => (
    <G transform={`translate(${cx} ${cy}) scale(${s})`} fill="none" stroke={color} strokeWidth={0.8} opacity={0.08}>
      {[12, 28, 50, 72].map((r) => <Circle key={r} cx={0} cy={0} r={r} />)}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        return <Line key={i} x1={Math.cos(a) * 28} y1={Math.sin(a) * 28} x2={Math.cos(a) * 72} y2={Math.sin(a) * 72} />;
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <Circle key={i} cx={Math.cos(a) * 50} cy={Math.sin(a) * 50} r={8} />;
      })}
    </G>
  );
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {mandala(width * 0.92, 70, 1.2)}
      {mandala(width * 0.04, height - 60, 1)}
    </Svg>
  );
}

const PATH_PAD = 28; // the path's inset from the screen edges
const DIYA = 24;

/**
 * The yatra path: a dotted route with a stop per site; a lit diya rides along
 * it with the rail's scroll, the trail behind it turns gold and the stops it
 * has passed light up. The site it's on is named underneath.
 */
function YatraPath({ scrollX, contentW, viewW }: RailProgressProps) {
  const { width } = useWindowDimensions();
  const { isDarkMode, themeColors } = useTheme();
  const n = PILGRIMAGE_SITES.length;
  const pathW = width - PATH_PAD * 2;
  const maxScroll = Math.max(1, contentW - viewW);
  const step = ARCH_CARD_W + RAIL_GAP;
  // The diya sits on the stop of the first card on screen. The rail runs out
  // of scroll before the last cards can lead (they're already on screen), so
  // the final stretch of scroll carries the diya the rest of the way: at the
  // very end it rests on the last site.
  const lastLead = Math.max(0, Math.min(n - 1, Math.floor((maxScroll - 1) / step)));
  const stopX = (k: number) => (k / (n - 1)) * pathW;
  const siteAt = (x: number) => (x >= maxScroll - 2 ? n - 1 : Math.max(0, Math.min(lastLead, Math.round(x / step))));
  const [at, setAt] = useState(0);

  // Which stop the diya is on, for the label. Updated only when it changes.
  useEffect(() => {
    let last = -1;
    const id = scrollX.addListener(({ value }) => {
      const i = siteAt(value);
      if (i !== last) { last = i; setAt(i); }
    });
    return () => scrollX.removeListener(id);
    // siteAt only depends on these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollX, maxScroll, step, n]);

  if (!contentW || !viewW) return <View style={{ height: 64 }} />;

  const inputRange = [...Array.from({ length: lastLead + 1 }, (_, k) => k * step), maxScroll];
  const progress = scrollX.interpolate({
    inputRange,
    outputRange: [...Array.from({ length: lastLead + 1 }, (_, k) => stopX(k)), pathW],
    extrapolate: 'clamp',
  });
  const trail = progress.interpolate({
    inputRange: [0, pathW], outputRange: [0.0001, 1], extrapolate: 'clamp',
  });
  const site = PILGRIMAGE_SITES[at];
  const state = SITE_INFO[site.id]?.state;

  return (
    <View style={styles.yatra} accessibilityRole="text" accessibilityLabel={`Stop ${at + 1} of ${n}: ${site.name}`}>
      <View style={{ width: pathW, height: DIYA }}>
        {/* The route, dotted. */}
        <Svg width={pathW} height={DIYA} style={StyleSheet.absoluteFill}>
          <Line
            x1={0} y1={DIYA / 2} x2={pathW} y2={DIYA / 2}
            stroke={isDarkMode ? 'rgba(212,175,55,0.35)' : 'rgba(122,31,10,0.25)'}
            strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round"
          />
        </Svg>
        {/* The stretch already travelled, in gold. */}
        <Animated.View
          style={[styles.trail, { width: pathW, transform: [{ scaleX: trail }] }]}
        />
        {/* A stop per site; each lights once the diya reaches it. */}
        {PILGRIMAGE_SITES.map((p, k) => {
          const x = stopX(k);
          const lit = progress.interpolate({
            inputRange: [x - 2, x], outputRange: [0, 1], extrapolate: 'clamp',
          });
          return (
            <View
              key={p.id}
              style={[styles.stop, {
                left: x - 3,
                // Filled with the band colour so the dotted route doesn't run through it.
                backgroundColor: themeColors.background,
                borderColor: isDarkMode ? 'rgba(212,175,55,0.5)' : 'rgba(122,31,10,0.3)',
              }]}
            >
              <Animated.View style={[styles.stopLit, { opacity: lit }]} />
            </View>
          );
        })}
        {/* The diya. */}
        <Animated.View style={[styles.diya, { transform: [{ translateX: Animated.subtract(progress, DIYA / 2) }] }]}>
          <Flame size={13} color={DD.saffron} fill={DD.saffron} />
        </Animated.View>
      </View>
      <Text style={[styles.yatraLabel, { color: isDarkMode ? DD.gold : DD.maroon }]} numberOfLines={1}>
        <Text style={styles.yatraCount}>{at + 1}/{n}</Text>
        {'  ·  '}{site.name}{state ? `, ${state}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingTop: 28, paddingBottom: 20, marginTop: 12, overflow: 'hidden' },
  eyebrow: {
    textAlign: 'center', color: DD.saffron, fontSize: 11, fontWeight: '700', letterSpacing: 3,
  },
  title: {
    marginTop: 6, textAlign: 'center', fontFamily: SERIF, fontSize: 25, fontWeight: '700',
    paddingHorizontal: 20,
  },
  subtitle: { marginTop: 6, textAlign: 'center', fontSize: 13, paddingHorizontal: 24 },
  divider: {
    marginTop: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dividerLine: { width: 44, height: 1, backgroundColor: DD.gold, opacity: 0.7 },
  dividerStar: { color: DD.gold, fontSize: 10 },
  diyaSmall: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,111,0,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.6)',
  },
  rail: { gap: RAIL_GAP, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 12 },

  yatra: { alignItems: 'center', marginTop: 8 },
  trail: {
    position: 'absolute', left: 0, top: DIYA / 2 - 1, height: 2, borderRadius: 1,
    backgroundColor: DD.gold, transformOrigin: 'left',
  },
  stop: {
    position: 'absolute', top: DIYA / 2 - 3, width: 6, height: 6, borderRadius: 3,
    borderWidth: 1, overflow: 'hidden',
  },
  stopLit: { flex: 1, backgroundColor: DD.gold },
  diya: {
    position: 'absolute', left: 0, top: 0, width: DIYA, height: DIYA, borderRadius: DIYA / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF3D6', borderWidth: 1.5, borderColor: DD.gold,
    shadowColor: DD.saffron, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  yatraLabel: { marginTop: 10, fontFamily: SERIF, fontSize: 13, fontStyle: 'italic', paddingHorizontal: 24 },
  yatraCount: { fontStyle: 'normal', fontWeight: '700', color: DD.saffron },
});
