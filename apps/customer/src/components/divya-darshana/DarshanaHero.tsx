// The Divya Darshana hero, ported from the web's
// components/divya-darshana/DarshanaHero.jsx in its phone layout: the temple
// photo first, set in an aged parchment frame with torn edges, gold corner
// filigree and a wax seal; then the copy centred beneath it — an italic
// eyebrow between flourishes, the serif headline, a filigree divider, the
// season date and price, two calls to action and the named slide pills.
// Behind it all, the web's sacred backdrop: faint mandalas and scattered ॐ.
//
// The web draws the torn edge with an SVG turbulence filter, which
// react-native-svg cannot do; here the same ragged edge is a fixed jagged
// path, and the page's cream is painted outside it.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, AccessibilityInfo, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';
import { MapPin, Phone, Star } from 'lucide-react-native';
import { DD } from './YatraRails';

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const PAGE = DD.cream;


const SLIDES = [
  {
    title: 'Char Dham', placeName: 'Kedarnath Temple', destination: 'Kedarnath, Uttarakhand',
    eyebrow: 'Char Dham Journeys Curated for Your', headline: 'Comfort & Peace of Mind.',
    date: 'Yatra Season Opens 26 Apr', info: 'Helicopter & Group options', price: 'From ₹27,824',
    // A colour photo from our place-image service. The web uses an 1860
    // black-and-white photograph, which read as a grey box on a phone.
    image: 'https://prayanaai.com/images/place-specific/ChIJtbCmiuA-CDkRAu4Clouuvds/img-1_google_places_529eb6aa.jpg',
  },
  {
    title: 'Badrinath', placeName: 'Badrinath Temple', destination: 'Badrinath, Uttarakhand',
    eyebrow: 'A Journey to the Abode of', headline: 'Lord Vishnu Himself.',
    date: 'Gates Open 27 Apr', info: 'VIP darshan & sattvik meals', price: 'From ₹32,499',
    // The web's own illustration file is missing, so it falls back to this
    // place photo from our image service; the phone uses it directly.
    image: 'https://prayanaai.com/images/place-specific/ChIJ5ag2xx-MpzkR75QOCiSXnLE/img-1_google_places_5201cea3.jpg',
  },
  {
    title: 'Tirumala', placeName: 'Tirumala Venkateswara Temple', destination: 'Tirumala, Andhra Pradesh',
    eyebrow: 'Seek Blessings of', headline: 'Lord Venkateswara.',
    date: 'Sarva Darshan Year-round', info: 'Seva darshan booked', price: 'From ₹14,999',
    image: 'https://prayanaai.com/images/place-specific/ChIJm3DMpWK1sjsRMn1YUr0AekA/img-1_google_places_da6d49f2.jpg',
  },
  {
    title: 'Vaishno Devi', placeName: 'Vaishno Devi Shrine', destination: 'Katra, Jammu & Kashmir',
    eyebrow: 'A Sacred Trek to', headline: 'The Holy Cave of Mata Rani.',
    date: 'Open All Year', info: 'Helicopter & Trek options', price: 'From ₹18,499',
    image: 'https://prayanaai.com/images/place-specific/ChIJraqFaWt4HjkRkYEErxG2SqA/img-3_google_places_36551d09.png',
  },
];

// ─── The torn edge ───────────────────────────────────────────────────────

/** A small fixed pseudo-random sequence, so the edge is the same every render. */
function jitter(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** A ragged rectangle inset 2–7px from the box, like hand-torn paper. */
function tornPath(w: number, h: number) {
  const r = jitter(9);
  const pts: [number, number][] = [];
  const edge = (from: [number, number], to: [number, number], inward: [number, number], step: number) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const d = 2 + r() * 5 + (r() < 0.15 ? 3 : 0); // the odd deeper nick
      pts.push([from[0] + (to[0] - from[0]) * t + inward[0] * d, from[1] + (to[1] - from[1]) * t + inward[1] * d]);
    }
  };
  edge([0, 0], [w, 0], [0, 1], 7);
  edge([w, 0], [w, h], [-1, 0], 9);
  edge([w, h], [0, h], [0, -1], 7);
  edge([0, h], [0, 0], [1, 0], 9);
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} Z`;
}

function CornerFiligree({ x, y, sx, sy }: { x: number; y: number; sx: 1 | -1; sy: 1 | -1 }) {
  // The web's 48-unit corner ornament, drawn at 40px and mirrored per corner.
  return (
    <G transform={`translate(${x} ${y}) scale(${(sx * 40) / 48} ${(sy * 40) / 48})`} opacity={0.55}>
      <G fill="none" stroke="#8a6535" strokeWidth={1.2} strokeLinecap="round">
        <Path d="M4 4 L20 4" />
        <Path d="M4 4 L4 20" />
        <Path d="M6 6 L16 6 Q16 10, 20 10" />
        <Path d="M6 6 L6 16 Q10 16, 10 20" />
        <Path d="M20 4 Q24 4, 24 8" />
        <Path d="M4 20 Q4 24, 8 24" />
      </G>
      <Circle cx={4} cy={4} r={1.4} fill="#b8860b" />
    </G>
  );
}

/** The photo in its parchment frame. */
function ParchmentFrame({ width, image, placeName, destination, onLoad }: {
  width: number; image: string; placeName: string; destination: string; onLoad: () => void;
}) {
  const w = width;
  // A 3:2 photo window, as tall as the phone allows without hiding the copy.
  const h = Math.round(w * 0.66);
  const torn = useMemo(() => tornPath(w, h), [w]);

  return (
    <View style={[styles.frameShadow, { width: w, height: h }]}>
      {/* Parchment base, the photo and its warm wash. */}
      {/* Inset 1px so no edge of it can show past the torn outline (≥2px in). */}
      <LinearGradient colors={['#f2dfb8', '#e8cfa0', '#d9b67e']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.parchment} />
      <View style={styles.photoInset}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={600} cachePolicy="memory-disk" onLoad={onLoad} />
        <LinearGradient
          colors={['rgba(232,195,140,0.18)', 'rgba(0,0,0,0)', 'rgba(60,20,5,0.45)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Name over place, so a long one ("Katra, Jammu & Kashmir") is never cut. */}
        <View style={styles.placeLabel}>
          <MapPin size={14} color="#fff" style={{ marginTop: 2 }} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.placeText} numberOfLines={1}>{placeName}</Text>
            <Text style={styles.placeSub} numberOfLines={1}>{destination}</Text>
          </View>
        </View>
      </View>

      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="burn" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0.55" stopColor="#50230c" stopOpacity={0} />
            <Stop offset="0.85" stopColor="#50230c" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#321608" stopOpacity={0.7} />
          </RadialGradient>
          <RadialGradient id="stain" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#783c14" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#783c14" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Age stains in the corners, then the burnt-edge vignette. */}
        <Circle cx={w * 0.06} cy={h * 0.1} r={h * 0.28} fill="url(#stain)" />
        <Circle cx={w * 0.95} cy={h * 0.08} r={h * 0.24} fill="url(#stain)" />
        <Circle cx={w * 0.92} cy={h * 0.9} r={h * 0.3} fill="url(#stain)" />
        <Circle cx={w * 0.05} cy={h * 0.93} r={h * 0.26} fill="url(#stain)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#burn)" />
        <CornerFiligree x={8} y={8} sx={1} sy={1} />
        <CornerFiligree x={w - 8} y={8} sx={-1} sy={1} />
        <CornerFiligree x={8} y={h - 8} sx={1} sy={-1} />
        <CornerFiligree x={w - 8} y={h - 8} sx={-1} sy={-1} />
        {/* Wax seal, bottom right. */}
        <G transform={`translate(${w - 64} ${h - 58}) rotate(-6 24 24)`}>
          <Circle cx={24} cy={24} r={24} fill="#8a1f0c" />
          <Circle cx={20} cy={18} r={14} fill="#b03826" opacity={0.6} />
          <Circle cx={24} cy={24} r={17} fill="none" stroke="#f3d581" strokeWidth={1} strokeDasharray="1.5 2" opacity={0.85} />
          <Circle cx={24} cy={24} r={12} fill="none" stroke="#f3d581" strokeWidth={1} opacity={0.85} />
          <SvgText x={24} y={30} textAnchor="middle" fill="#f3d581" fontSize={15} fontWeight="500">ॐ</SvgText>
        </G>
        {/* The page painted outside the torn outline, which cuts the frame. */}
        <Path d={`M0,0 H${w} V${h} H0 Z ${torn}`} fill={PAGE} fillRule="evenodd" />
      </Svg>
    </View>
  );
}

// ─── Ornaments for the copy ──────────────────────────────────────────────

function EyebrowFlourish({ mirror }: { mirror?: boolean }) {
  return (
    <Svg width={36} height={10} viewBox="0 0 48 12" style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}>
      <G fill="none" stroke={DD.maroon} strokeWidth={1.2} strokeLinecap="round" opacity={0.75}>
        <Path d="M2 6 L28 6" />
        <Path d="M30 6 Q34 2, 38 6 Q42 10, 46 6" />
      </G>
      <Circle cx={46} cy={6} r={1.6} fill="#b8860b" opacity={0.8} />
    </Svg>
  );
}

function FiligreeDivider() {
  return (
    <Svg width={150} height={15} viewBox="0 0 240 24" style={{ marginTop: 8 }}>
      <G fill="none" stroke={DD.maroon} strokeWidth={1.4} strokeLinecap="round" opacity={0.85}>
        <Path d="M8 12 L96 12" />
        <Path d="M144 12 L232 12" />
        <Path d="M100 12 Q108 4, 116 12 Q120 16, 124 12 Q132 4, 140 12" />
      </G>
      <G fill="#b8860b">
        <Circle cx={120} cy={12} r={2.4} />
        <Circle cx={8} cy={12} r={1.8} opacity={0.8} />
        <Circle cx={232} cy={12} r={1.8} opacity={0.8} />
      </G>
      <G fill="none" stroke="#b8860b" strokeWidth={0.9} opacity={0.7}>
        <Path d="M120 5 L120 1" />
        <Path d="M120 19 L120 23" />
      </G>
    </Svg>
  );
}

/** The web's sacred backdrop: two faint mandalas and scattered ॐ glyphs. */
function SacredBackdrop({ width, height }: { width: number; height: number }) {
  const mandala = (cx: number, cy: number, s: number) => (
    <G transform={`translate(${cx} ${cy}) scale(${s})`} fill="none" stroke={DD.maroon} strokeWidth={0.8} opacity={0.09}>
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
  const oms = [
    { x: 0.04, y: 0.5, size: 70, rot: -8, op: 0.07 },
    { x: 0.78, y: 0.56, size: 90, rot: 6, op: 0.06 },
    { x: 0.1, y: 0.84, size: 60, rot: -12, op: 0.07 },
    { x: 0.7, y: 0.9, size: 54, rot: 4, op: 0.05 },
  ];
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {mandala(width * 0.08, height * 0.62, 1.3)}
      {mandala(width * 0.95, height * 0.85, 1.1)}
      {oms.map((o, i) => (
        <SvgText
          key={i}
          x={width * o.x}
          y={height * o.y}
          fontSize={o.size}
          fill={DD.maroon}
          opacity={o.op}
          transform={`rotate(${o.rot} ${width * o.x} ${height * o.y})`}
        >
          ॐ
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── The hero ────────────────────────────────────────────────────────────

export function DarshanaHero({ onPackages, onCallExpert }: { onPackages: () => void; onCallExpert: () => void }) {
  const { width: screenW } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const [heroH, setHeroH] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  // The web's 7-second rotation; a tap on a pill restarts the count.
  useEffect(() => {
    if (reduceMotion) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, [idx, reduceMotion]);

  // Fetch every slide's photo up front so a change never waits on a download.
  useEffect(() => { Image.prefetch(SLIDES.map((s) => s.image)); }, []);

  const slide = SLIDES[idx];
  // The frame keeps showing the last photo until the next one has loaded, so
  // its place label follows the photo on show rather than the chosen slide.
  const [shown, setShown] = useState(0);
  const pictured = SLIDES[shown];

  return (
    <View style={styles.hero} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
      {heroH > 0 && <SacredBackdrop width={screenW} height={heroH} />}

      <View style={styles.framePad}>
        <ParchmentFrame
          width={screenW - 32}
          image={slide.image}
          placeName={pictured.placeName}
          destination={pictured.destination}
          onLoad={() => setShown(idx)}
        />
      </View>

      <View style={styles.copy}>
        {/* A cream glow quietens the backdrop behind the headline. */}
        <Svg style={styles.glow} pointerEvents="none">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#fbefd3" stopOpacity={0.95} />
              <Stop offset="0.6" stopColor="#fbefd3" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#fbefd3" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#glow)" />
        </Svg>
        <View style={styles.eyebrowRow}>
          <EyebrowFlourish mirror />
          <Text style={styles.eyebrow} numberOfLines={1}>{slide.eyebrow}</Text>
          <EyebrowFlourish />
        </View>
        {/* Always one line: a long headline ("The Holy Cave of Mata Rani.")
            shrinks to fit rather than wrapping, so every slide is the same
            height and the page below never moves. */}
        <Text
          style={styles.headline}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          textBreakStrategy="simple"
        >
          {slide.headline}
        </Text>
        <FiligreeDivider />

        <View style={styles.facts}>
          <LinearGradient colors={['#9c2c12', DD.maroon, '#651806']} style={styles.datePill}>
            <View style={styles.dateDot} />
            <Text style={styles.dateText} numberOfLines={1}>{slide.date}</Text>
          </LinearGradient>
          <LinearGradient colors={['#f3d581', '#d4a73a']} style={styles.pricePill}>
            <Star size={11} color="#b91c1c" fill="#b91c1c" strokeWidth={0} />
            <Text style={styles.priceText} numberOfLines={1}>{slide.price}</Text>
          </LinearGradient>
        </View>
        <Text style={styles.info} numberOfLines={1}>✦  {slide.info}  ✦</Text>

        <View style={styles.ctas}>
          <Pressable onPress={onPackages} style={({ pressed }) => [styles.ctaPrimaryWrap, pressed && { opacity: 0.9 }]} accessibilityRole="button">
            <LinearGradient colors={['#9c2c12', DD.maroon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryText} numberOfLines={1}>Holiday Packages</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onCallExpert} style={({ pressed }) => [styles.ctaSecondary, pressed && { backgroundColor: 'rgba(212,175,55,0.3)' }]} accessibilityRole="button">
            <Phone size={14} color={DD.maroon} />
            <Text style={styles.ctaSecondaryText} numberOfLines={1}>Talk to Expert</Text>
          </Pressable>
        </View>

        {/* Wrapped and centred: in a sideways row the end pills were cut off at
            both screen edges. */}
        <View style={styles.pills}>
          {SLIDES.map((s, i) => {
            const on = i === idx;
            return (
              <Pressable
                key={s.title}
                onPress={() => setIdx(i)}
                style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
                accessibilityRole="button"
                accessibilityLabel={`Show ${s.title}`}
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.pillDot, { backgroundColor: on ? DD.gold : 'rgba(122,31,10,0.4)' }]} />
                <Text style={[styles.pillText, { color: on ? '#fff' : DD.maroon }]}>{s.title.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: PAGE, paddingTop: 16, paddingBottom: 20, overflow: 'hidden' },
  framePad: { paddingHorizontal: 16 },
  frameShadow: {
    shadowColor: '#5a2d0f', shadowOpacity: 0.38, shadowRadius: 20, shadowOffset: { width: 0, height: 14 },
  },
  parchment: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1 },
  photoInset: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, overflow: 'hidden' },
  placeLabel: { position: 'absolute', left: 18, right: 78, bottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  placeText: {
    color: '#fff', fontSize: 14, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  placeSub: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },

  copy: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 18 },
  glow: { position: 'absolute', top: -20, left: -30, right: -30, height: 230 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { flexShrink: 1, fontFamily: SERIF, fontStyle: 'italic', fontWeight: '600', fontSize: 14, letterSpacing: 0.8, color: DD.deep },
  headline: { marginTop: 4, fontFamily: SERIF, fontWeight: '700', fontSize: 27, color: DD.maroon, textAlign: 'center', alignSelf: 'stretch', paddingHorizontal: 6 },
  facts: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4,
    shadowColor: '#50190a', shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  dateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f3d581', shadowColor: '#f3d581', shadowOpacity: 0.8, shadowRadius: 4 },
  dateText: { color: '#fff', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  info: { marginTop: 8, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.3, color: 'rgba(122,31,10,0.8)' },
  pricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
    shadowColor: '#50190a', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  priceText: { fontSize: 12, fontWeight: '700', color: '#5c1206' },
  // Two equal buttons across the phone.
  ctas: { marginTop: 16, flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  ctaPrimaryWrap: {
    flex: 1, borderRadius: 14,
    shadowColor: '#5a1608', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  ctaPrimary: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  ctaPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  ctaSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1.5, borderColor: DD.gold,
    backgroundColor: 'rgba(255,255,255,0.75)', paddingVertical: 13,
  },
  ctaSecondaryText: { color: DD.maroon, fontSize: 14, fontWeight: '700' },
  pills: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  pillOn: { backgroundColor: DD.maroon, borderColor: DD.maroon, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  pillOff: { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(122,31,10,0.3)' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600', letterSpacing: 1.3 },
});
