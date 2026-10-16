// A destination edition as a magazine cover: the country's photo washed in the
// edition's accent, its masthead, name and tagline. Used by the editions index
// and the "Destination editions" rail on Explore World.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DestinationEdition, editionHref, editionImage } from '../../lib/destinationEditions';

export function EditionPoster({
  edition,
  width,
  height,
  compact,
}: {
  edition: DestinationEdition;
  width: number;
  height: number;
  /** Rail size: drops the tagline. */
  compact?: boolean;
}) {
  const img = editionImage(edition, Math.min(1200, Math.round(width * 2.5)));
  const vol = edition.masthead.split('·').pop()?.trim();
  return (
    <Pressable
      onPress={() => router.push(editionHref(edition) as any)}
      style={({ pressed }) => [s.card, { width, height }, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${edition.displayName} edition`}
    >
      {img ? (
        <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
      ) : null}
      <LinearGradient
        colors={[`${edition.accent.from}CC`, `${edition.accent.to}33`, 'rgba(0,0,0,0.88)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.top}>
        <View style={s.emoji}>
          <Text style={{ fontSize: compact ? 14 : 16 }}>{edition.emoji}</Text>
        </View>
        {!!vol && <Text style={s.vol}>{vol}</Text>}
      </View>
      <View style={s.bottom}>
        <Text style={s.mast} numberOfLines={1}>
          {compact ? 'Edition' : `${edition.displayName} edition`}
        </Text>
        <Text style={[s.name, compact && s.nameCompact]} numberOfLines={1} adjustsFontSizeToFit>
          {edition.displayName}
        </Text>
        {!compact && (
          <Text style={s.tagline} numberOfLines={2}>
            {edition.tagline}
          </Text>
        )}
        <View style={[s.readRow, { marginTop: compact ? 6 : 10 }]}>
          <Text style={s.read}>Read</Text>
          <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

export default EditionPoster;

const s = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10 },
  emoji: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  vol: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  mast: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  nameCompact: { fontSize: 19, letterSpacing: -0.4 },
  tagline: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, fontStyle: 'italic', lineHeight: 17, marginTop: 4 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  read: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
});
