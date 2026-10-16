import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { useIsha } from './ishaTheme';

const FALLBACK = 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=200&h=200&fit=crop&q=70';

type Destination = {
  name: string;
  city?: string;
  image?: string | null;
  images?: Array<string | { url?: string | null }>;
};

function imageOf(d: Destination) {
  const first = d.images?.[0];
  const url = (typeof first === 'string' ? first : first?.url) || d.image;
  return url ? normalizeImageUrl(url) : FALLBACK;
}

/** One row that opens the destination's page. */
export default function DestinationOverviewCard({ destination, onOpen }: { destination: Destination; onOpen: () => void }) {
  const t = useIsha();
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${destination.name}`}
      style={({ pressed }) => [styles.row, { borderColor: t.border, backgroundColor: pressed ? t.pressed : t.surface }]}
    >
      <Image
        source={{ uri: failed ? FALLBACK : imageOf(destination) }}
        onError={() => setFailed(true)}
        style={[styles.thumb, { backgroundColor: t.sunken }]}
        contentFit="cover"
      />
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: t.muted }]}>Explore the destination</Text>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {destination.name}
        </Text>
        {/* Only when it adds something: the name twice read "Manali / Manali" */}
        {!!destination.city && destination.city !== destination.name && (
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={12} color={t.muted} />
            <Text style={[styles.city, { color: t.muted }]} numberOfLines={1}>
              {destination.city}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.open}>
        <Text style={[styles.openText, { color: t.text }]}>Open</Text>
        <Ionicons name="chevron-forward" size={16} color={t.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 8 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  body: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: '500' },
  name: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  city: { fontSize: 12 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingRight: 4 },
  openText: { fontSize: 13, fontWeight: '600' },
});
