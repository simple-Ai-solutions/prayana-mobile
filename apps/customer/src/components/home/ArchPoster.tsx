// The temple-arch poster, ported from the web's PosterTile variant="arch": a
// domed photo in a gold frame with the name set in gold italic serif, then an
// eyebrow line between gold rules, up to three icon perks, and a footer with
// an orange call to action. Photos step through `frames` while `playing`.
//
// Shared by the home "Sacred Pilgrimage Sites" rail and the Divya Darshana
// yatra cards, as on the web, so a pilgrim sees one card in both places.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '@prayana/shared-ui';
import { usePhotoStep } from './HomeRails';
import { TWO_UP_W } from '../../lib/railLayout';

export const ARCH_CARD_W = TWO_UP_W;
const PAD = 8;
const FRAME = 3; // the gold frame's width
const FOOT = 16;
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

// The web's dome is an ellipse; React Native radii are circular, so a radius
// of half the doorway's width is the closest round dome — computed per card,
// so a wider poster (the spotlight) keeps a full dome.
const arch = (dome: number, inset: number) => ({
  borderTopLeftRadius: dome - inset,
  borderTopRightRadius: dome - inset,
  borderBottomLeftRadius: FOOT - inset,
  borderBottomRightRadius: FOOT - inset,
});

export type ArchPerk = { label: string; Icon: React.ComponentType<any> };

export function ArchPoster({
  frames, name, kind, strap, eyebrow, perks = [], footer, cta = 'Explore',
  playing, tick, onPress, accessibilityLabel, width = ARCH_CARD_W,
}: {
  frames: string[];
  name: string;
  /** Small caps word above the name ("Group yatra"). */
  kind?: string | null;
  strap?: string | null;
  eyebrow?: string | null;
  perks?: ArchPerk[];
  footer?: React.ReactNode;
  cta?: string;
  playing: boolean;
  tick: number;
  onPress: () => void;
  accessibilityLabel?: string;
  width?: number;
}) {
  const { isDarkMode } = useTheme();
  const { photo, onLoad } = usePhotoStep(frames, playing, tick, width);
  const archW = width - PAD * 2;
  const archH = Math.round((archW * 4) / 3); // the web's 3:4 doorway
  const dome = Math.floor(archW / 2);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shadow, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel || name}
    >
      <LinearGradient
        colors={isDarkMode ? ['rgba(245,158,11,0.1)', '#111827'] : ['#FFFBEB', '#FFFFFF']}
        style={[styles.card, { width }, isDarkMode && styles.cardDark]}
      >
        {/* The doorway: a gold gradient frame around the domed photo. */}
        <LinearGradient
          colors={['#FDE68A', '#D97706', '#FCD34D', '#B45309']}
          locations={[0, 0.4, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ width: archW, height: archH, padding: FRAME }, arch(dome, 0)]}
        >
          <View style={[styles.photo, arch(dome, FRAME)]}>
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
              colors={['rgba(120,53,15,0.15)', 'rgba(0,0,0,0)', 'rgba(67,20,7,0.85)']}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.innerLine, arch(dome, FRAME + 7)]} pointerEvents="none" />
            <View style={styles.archBody}>
              {!!kind && <Text style={styles.kind}>{kind.toUpperCase()}</Text>}
              {/* Android measures italic serif narrower than it draws it, so a
                  name that fits pushed its last word onto a hidden line ("Do"
                  for "Do Dham"). Simple line breaking plus a little side room
                  keeps the whole name visible. */}
              <Text style={styles.name} numberOfLines={2} textBreakStrategy="simple">{name}</Text>
              {!!strap && <Text style={styles.strap} numberOfLines={1}>{strap}</Text>}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {!!eyebrow && (
            <View style={styles.eyebrow}>
              <View style={styles.rule} />
              <Text style={[styles.eyebrowText, isDarkMode && { color: '#FCD34D' }]} numberOfLines={1}>
                {eyebrow.toUpperCase()}
              </Text>
              <View style={styles.rule} />
            </View>
          )}
          {perks.length > 0 && (
            <View style={styles.perks}>
              {perks.slice(0, 3).map(({ label, Icon }) => (
                <View key={label} style={styles.perk}>
                  <Icon size={16} color={isDarkMode ? '#FCD34D' : '#B45309'} strokeWidth={1.8} />
                  <Text style={[styles.perkText, isDarkMode && { color: '#D1D5DB' }]} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.footer}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {typeof footer === 'string'
                ? <Text style={[styles.footerText, isDarkMode && { color: '#9CA3AF' }]} numberOfLines={1}>{footer}</Text>
                : footer}
            </View>
            <LinearGradient colors={['#F59E0B', '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Text style={styles.ctaText}>{cta}</Text>
              <ArrowRight size={14} color="#fff" />
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 26,
    shadowColor: '#B45309', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  card: { borderRadius: 26, padding: PAD, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(253,230,138,0.7)' },
  cardDark: { borderColor: 'rgba(245,158,11,0.2)' },

  photo: { flex: 1, overflow: 'hidden', backgroundColor: '#111827' },
  innerLine: {
    position: 'absolute', top: 7, left: 7, right: 7, bottom: 7,
    borderWidth: 1, borderColor: 'rgba(253,230,138,0.6)',
  },
  archBody: { position: 'absolute', left: 10, right: 10, bottom: 12, alignItems: 'center' },
  kind: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: 'rgba(253,230,138,0.9)' },
  name: {
    marginTop: 2, fontFamily: SERIF, fontStyle: 'italic', fontWeight: '600', fontSize: 20, lineHeight: 22,
    color: '#FEF3C7', textAlign: 'center', paddingHorizontal: 6,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 },
  },
  strap: { marginTop: 3, fontSize: 10, color: 'rgba(255,251,235,0.85)', textAlign: 'center' },

  body: { paddingHorizontal: 2, paddingTop: 10 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  rule: { width: 6, height: 1, backgroundColor: '#FBBF24' },
  eyebrowText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: '#B45309', flexShrink: 1 },
  perks: { marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  perk: { alignItems: 'center', gap: 2, minWidth: 0 },
  perkText: { maxWidth: 52, fontSize: 9, fontWeight: '600', color: '#4B5563' },
  footer: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  ctaText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
