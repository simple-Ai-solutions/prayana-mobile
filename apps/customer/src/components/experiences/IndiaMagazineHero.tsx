// IndiaMagazineHero — the "India edition · Vol 01" magazine block from the web
// /global-experiences (web IndiaHero). A cover carousel over INDIA_DESTINATIONS
// with a tricolor masthead, then an "Editor's letter" with numbered highlights
// and a "Browse all of India" CTA. Orange-only accents (no rose/fuchsia here),
// matching the web.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { INDIA_DESTINATIONS, INDIA_HERO_HIGHLIGHTS } from '../../lib/globalExperiencesData';

const ORANGE = '#F97316';

export const IndiaMagazineHero: React.FC = () => {
  const { themeColors, isDarkMode } = useTheme();
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const dest = INDIA_DESTINATIONS[idx];
  const go = (d: number) =>
    setIdx((i) => (i + d + INDIA_DESTINATIONS.length) % INDIA_DESTINATIONS.length);

  return (
    <View style={styles.section}>
      {/* Cover carousel */}
      <View style={styles.cover}>
        <Image source={{ uri: dest.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Masthead — "India edition · Vol 01" + tricolor swatch */}
        <View style={styles.masthead}>
          <View style={styles.tricolor}>
            <View style={{ flex: 1, backgroundColor: '#FF9933' }} />
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
            <View style={{ flex: 1, backgroundColor: '#138808' }} />
          </View>
          <Text style={styles.mastheadText}>India edition · Vol 01</Text>
        </View>

        {/* Prev / next */}
        <TouchableOpacity style={[styles.navBtn, { left: 10 }]} onPress={() => go(-1)} accessibilityLabel="Previous">
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, { right: 10 }]} onPress={() => go(1)} accessibilityLabel="Next">
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Caption + dots */}
        <View style={styles.coverCaption}>
          <Text style={styles.coverTheme}>{dest.theme.toUpperCase()}</Text>
          <Text style={styles.coverName}>{dest.name}</Text>
          <Text style={styles.coverBlurb} numberOfLines={2}>
            {dest.blurb}
          </Text>
          <View style={styles.dots}>
            {INDIA_DESTINATIONS.map((_, i) => (
              <Pressable key={i} onPress={() => setIdx(i)} hitSlop={6}>
                <View style={[styles.dot, i === idx && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Editor's letter */}
      <View style={[styles.letter, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={styles.eyebrow}>EDITOR&apos;S LETTER</Text>
        <Text style={[styles.headline, { color: themeColors.text }]}>
          The India that doesn&apos;t make it to the brochures.
        </Text>
        <Text style={[styles.leadIn, { color: themeColors.textSecondary }]}>
          India, scouted in person —
        </Text>
        <View style={styles.highlights}>
          {INDIA_HERO_HIGHLIGHTS.map((h, i) => (
            <View key={h} style={styles.highlightRow}>
              <Text style={styles.highlightNum}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={[styles.highlightText, { color: themeColors.text }]}>{h}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push('/india-experiences' as any)}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Browse all of India</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.footer, { color: themeColors.textTertiary }]}>
          {INDIA_DESTINATIONS.length} destinations · walked
        </Text>
      </View>
    </View>
  );
};

export default IndiaMagazineHero;

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  cover: {
    height: 300,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    justifyContent: 'flex-end',
  },
  masthead: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tricolor: {
    width: 26,
    height: 17,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  mastheadText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  navBtn: {
    position: 'absolute',
    top: '46%',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  coverCaption: { padding: spacing.lg },
  coverTheme: { color: '#FDBA74', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  coverName: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  coverBlurb: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFFFFF', width: 18 },

  letter: {
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderTopWidth: 0,
    padding: spacing.lg,
  },
  eyebrow: { color: '#EA580C', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  headline: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, fontStyle: 'italic', marginTop: 8, lineHeight: 27 },
  leadIn: { fontSize: fontSize.sm, marginTop: 8, fontWeight: fontWeight.semibold },
  highlights: { marginTop: spacing.md, gap: spacing.sm },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  highlightNum: { color: ORANGE, fontSize: fontSize.md, fontWeight: fontWeight.bold, width: 24 },
  highlightText: { fontSize: fontSize.sm, flex: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.lg,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: ORANGE,
  },
  ctaText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  footer: { fontSize: fontSize.xs, marginTop: spacing.md },
});
