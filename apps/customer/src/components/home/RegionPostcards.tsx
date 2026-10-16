// "Explore India by Region", ported from the web's
// components/destination/IndianRegionalDestinations.jsx.
//
// Each place is a postcard: a cream card with a photo side carrying a round
// postmark with the state and the name in a handwritten script; underneath, "Greetings from" and the state. A pill
// slides between the four regions and Shuffle reorders the deck. Every tab
// change or shuffle deals the cards in again, one after another, tilted and
// settling straight.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, AccessibilityInfo, useWindowDimensions,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, DancingScript_400Regular, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { ArrowRight, Shuffle } from 'lucide-react-native';
import { useTheme, spacing } from '@prayana/shared-ui';
import { REGIONS, type RegionKey, type RegionPlace } from '../../lib/regions';
import { sizedImageUrl } from '../../lib/imageUrl';

// Postcards sit two to a row.
const POSTCARD_W = Math.round(Dimensions.get('window').width / 2);

const GAP = 14;
const FIRST_DEAL = 4; // two rows of two, then "View All in …"
const TAB_LABEL: Record<RegionKey, string> = { north: 'NORTH', south: 'SOUTH', east: 'EAST', west: 'WEST' };
const TABS = Object.keys(REGIONS) as RegionKey[];

/** A small, stable tilt per card per deal — the "just dealt" look. */
function tiltOf(name: string, deal: number) {
  let h = deal * 31;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) - 6) * 1.2; // -7.2° … +7.2°
}

function Postcard({ dest, region, index, width, deal, still, script, scriptBold, onPress }: {
  dest: RegionPlace; region: string; index: number; width: number; deal: number; still: boolean;
  script?: string; scriptBold?: string; onPress: () => void;
}) {
  // Dealt in: rises, grows and straightens from its tilt, a beat after the last.
  const t = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return undefined;
    t.setValue(0);
    const anim = Animated.spring(t, {
      toValue: 1, stiffness: 260, damping: 22, mass: 1, delay: index * 70, useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [deal, still, index, t]);

  const tilt = tiltOf(dest.name, deal);
  // Every postcard rests slightly off-square, alternating, as on the web.
  const rest = index % 2 === 0 ? -1.2 : 1.2;
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: [`${tilt + rest}deg`, `${rest}deg`] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [46, 0] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const opacity = t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });
  const long = dest.name.length > 11;

  return (
    <Animated.View style={{ width, opacity, transform: [{ translateY }, { scale }, { rotate }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.97 }] }]}
        accessibilityRole="link"
        accessibilityLabel={`${dest.name}, ${dest.state}`}
      >
        {/* The postcard's picture side. */}
        <View style={styles.photo}>
          <Image
            source={{ uri: sizedImageUrl(dest.image, POSTCARD_W) }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Postmark in the corner. */}
          <View style={[styles.postmark, { transform: [{ rotate: '-12deg' }] }]} pointerEvents="none">
            <Text style={styles.postmarkText} numberOfLines={1}>{(dest.state || region).slice(0, 10).toUpperCase()}</Text>
          </View>

          <Text
            style={[
              styles.name,
              { fontSize: long ? 24 : 30, lineHeight: long ? 26 : 32, transform: [{ rotate: '-3deg' }] },
              scriptBold ? { fontFamily: scriptBold } : styles.nameFallback,
            ]}
            numberOfLines={2}
          >
            {dest.name}
          </Text>
        </View>

        {/* The writing side: "Greetings from …" and the state. */}
        <View style={styles.back}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.greet, script ? { fontFamily: script } : styles.greetFallback]}>Greetings from</Text>
            <Text style={styles.state} numberOfLines={1}>{(dest.state || dest.name).toUpperCase()}</Text>
          </View>
          <View style={styles.go}>
            <ArrowRight size={14} color="#fff" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function RegionPostcards({ onPlacePress }: { onPlacePress: (place: RegionPlace) => void }) {
  const { isDarkMode } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ DancingScript_400Regular, DancingScript_700Bold });
  const [active, setActive] = useState<RegionKey>('north');
  const [order, setOrder] = useState<Partial<Record<RegionKey, string[]>>>({});
  const [deal, setDeal] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  const region = REGIONS[active];
  const ordered = useMemo(() => {
    const names = order[active];
    return names
      ? names.map((n) => region.destinations.find((d) => d.name === n)).filter(Boolean) as RegionPlace[]
      : region.destinations;
  }, [order, active, region]);
  const shown = showAll ? ordered : ordered.slice(0, FIRST_DEAL);
  const cardW = (screenW - spacing.lg * 2 - GAP) / 2;

  const pickRegion = (key: RegionKey) => {
    if (key === active) return;
    setActive(key);
    setShowAll(false);
    setDeal((d) => d + 1);
  };
  const shuffle = () => {
    const names = (order[active] || region.destinations.map((d) => d.name)).slice();
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    setOrder((o) => ({ ...o, [active]: names }));
    setDeal((d) => d + 1);
  };

  return (
    <View>
      {/* Region tabs — a pill that slides between regions — and Shuffle. */}
      <View style={styles.controls}>
        <RegionTabs active={active} onPick={pickRegion} dark={isDarkMode} instant={reduceMotion} />
        <Pressable
          onPress={shuffle}
          style={({ pressed }) => [styles.shuffle, isDarkMode && styles.shuffleDark, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`Shuffle ${region.title} destinations`}
        >
          <Shuffle size={16} color={isDarkMode ? '#E5E7EB' : '#374151'} />
          <Text style={[styles.shuffleText, { color: isDarkMode ? '#E5E7EB' : '#374151' }]}>Shuffle</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {shown.map((dest, i) => (
          <Postcard
            key={`${active}-${deal}-${dest.name}`}
            dest={dest}
            region={region.title}
            index={i}
            width={cardW}
            deal={deal}
            still={reduceMotion}
            script={fontsLoaded ? 'DancingScript_400Regular' : undefined}
            scriptBold={fontsLoaded ? 'DancingScript_700Bold' : undefined}
            onPress={() => onPlacePress(dest)}
          />
        ))}
      </View>

      {!showAll && ordered.length > FIRST_DEAL && (
        <Pressable onPress={() => setShowAll(true)} style={styles.viewAllWrap} accessibilityRole="button">
          <LinearGradient colors={['#F97316', '#E61417']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.viewAll}>
            <Text style={styles.viewAllText}>View All in {region.title}</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

/** Four region tabs with an orange pill that slides to the chosen one. */
function RegionTabs({ active, onPick, dark, instant }: {
  active: RegionKey; onPick: (k: RegionKey) => void; dark: boolean; instant: boolean;
}) {
  const [widths, setWidths] = useState<number[]>([]);
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const idx = TABS.indexOf(active);

  useEffect(() => {
    if (widths.length !== TABS.length) return;
    const left = widths.slice(0, idx).reduce((a, b) => a + b, 0);
    if (instant) {
      x.setValue(left);
      w.setValue(widths[idx]);
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: left, stiffness: 420, damping: 34, mass: 1, useNativeDriver: false }),
      Animated.spring(w, { toValue: widths[idx], stiffness: 420, damping: 34, mass: 1, useNativeDriver: false }),
    ]).start();
  }, [idx, widths, instant, x, w]);

  return (
    <View style={[styles.tabs, dark && styles.tabsDark]}>
      {widths.length === TABS.length && (
        <Animated.View style={[styles.pill, { left: Animated.add(x, 4), width: w }]}>
          <LinearGradient colors={['#F97316', '#E61417']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {TABS.map((key, i) => {
        const on = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onPick(key)}
            onLayout={(e) => {
              const width = e.nativeEvent.layout.width;
              setWidths((prev) => {
                if (prev[i] === width) return prev;
                const next = prev.slice();
                next[i] = width;
                return next;
              });
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tabText, { color: on ? '#fff' : dark ? '#D1D5DB' : '#4B5563' }]}>{TAB_LABEL[key]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: spacing.lg, marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  tabsDark: { backgroundColor: 'rgba(31,41,55,0.8)', borderColor: '#374151' },
  pill: { position: 'absolute', top: 4, bottom: 4, borderRadius: 999, overflow: 'hidden' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  tabText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  shuffle: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  shuffleDark: { backgroundColor: 'rgba(31,41,55,0.8)', borderColor: '#374151' },
  shuffleText: { fontSize: 12, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: spacing.lg },
  card: {
    borderRadius: 6, backgroundColor: '#FFFDF8', padding: 8, paddingBottom: 0,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 5,
  },
  photo: { aspectRatio: 4 / 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#D1D5DB' },
  postmark: {
    position: 'absolute', top: 10, right: 10, width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  postmarkText: { color: 'rgba(17,24,39,0.5)', fontSize: 6.5, fontWeight: '700', letterSpacing: 0.8 },
  name: {
    position: 'absolute', left: 12, right: 12, bottom: 12, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 1, textShadowOffset: { width: 2, height: 3 },
  },
  nameFallback: { fontStyle: 'italic', fontWeight: '800' },

  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 10 },
  greet: { color: '#6B7280', fontSize: 15, lineHeight: 18 },
  greetFallback: { fontStyle: 'italic' },
  state: { color: '#1F2937', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  go: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },

  viewAllWrap: { alignSelf: 'center', marginTop: 32 },
  viewAll: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  viewAllText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
