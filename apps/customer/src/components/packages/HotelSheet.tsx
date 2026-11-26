// Tap a hotel on the package page → this sheet: a big photo (tap for full
// screen), rating, which nights you stay there, room type, and a one-tap
// "See on map". Only shows what the package actually carries — nothing made up.
import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';

export type HotelInfo = {
  name: string;
  city?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  /** e.g. "4-Star" */
  category?: string;
  roomType?: string;
  /** Itinerary day numbers spent at this hotel. */
  days?: number[];
};

export function HotelSheet({ hotel, onClose, onPhoto }: {
  hotel: HotelInfo | null;
  onClose: () => void;
  onPhoto?: (uri: string) => void;
}) {
  const { themeColors } = useTheme();
  const h = hotel;
  const nights = h?.days?.length || 0;
  const openMap = () => {
    if (!h) return;
    const q = encodeURIComponent([h.name, h.address || h.city].filter(Boolean).join(', '));
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };

  return (
    <Modal visible={!!h} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: themeColors.surface }]} onPress={() => {}}>
          {h ? (
            <>
              <Pressable
                onPress={() => h.imageUrl && onPhoto?.(h.imageUrl)}
                disabled={!h.imageUrl}
                accessibilityLabel="See photo full screen"
              >
                {h.imageUrl ? (
                  <Image source={{ uri: h.imageUrl }} style={s.photo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                ) : (
                  <View style={[s.photo, s.photoPh]}>
                    <Ionicons name="bed" size={40} color="#9ca3af" />
                  </View>
                )}
                {h.imageUrl ? (
                  <View style={s.expand}>
                    <Ionicons name="expand" size={14} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
              <Pressable onPress={onClose} style={s.close} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>

              <View style={s.body}>
                <Text style={[s.name, { color: themeColors.text }]}>{h.name}</Text>
                <View style={s.metaRow}>
                  {h.city ? (
                    <View style={s.meta}>
                      <Ionicons name="location-outline" size={14} color={themeColors.textSecondary} />
                      <Text style={[s.metaText, { color: themeColors.textSecondary }]}>{h.city}</Text>
                    </View>
                  ) : null}
                  {h.rating ? (
                    <View style={s.meta}>
                      <Ionicons name="star" size={13} color="#d97706" />
                      <Text style={[s.metaText, { color: themeColors.text, fontWeight: '800' }]}>
                        {h.rating}
                        {h.reviewCount ? (
                          <Text style={{ color: themeColors.textSecondary, fontWeight: '600' }}>
                            {' '}({Number(h.reviewCount).toLocaleString('en-IN')} reviews)
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={s.facts}>
                  {nights ? (
                    <Fact icon="moon-outline" label={`${nights} night${nights === 1 ? '' : 's'}`}
                      sub={`Day ${h.days!.join(', ')}`} color={themeColors.text} subColor={themeColors.textSecondary} border={themeColors.border} />
                  ) : null}
                  {h.category ? (
                    <Fact icon="business-outline" label={h.category} sub="Hotel" color={themeColors.text} subColor={themeColors.textSecondary} border={themeColors.border} />
                  ) : null}
                  {h.roomType ? (
                    <Fact icon="bed-outline" label={h.roomType} sub="Room" color={themeColors.text} subColor={themeColors.textSecondary} border={themeColors.border} />
                  ) : null}
                </View>

                {h.address ? (
                  <Text style={[s.address, { color: themeColors.textSecondary }]}>{h.address}</Text>
                ) : null}

                <Pressable onPress={openMap} style={({ pressed }) => [s.mapBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                  <Ionicons name="map-outline" size={17} color="#EA580C" />
                  <Text style={s.mapText}>See on map</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Fact({ icon, label, sub, color, subColor, border }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; color: string; subColor: string; border: string;
}) {
  return (
    <View style={[s.fact, { borderColor: border }]}>
      <Ionicons name={icon} size={16} color="#f97316" />
      <Text style={[s.factLabel, { color }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.factSub, { color: subColor }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 28 },
  photo: { width: '100%', height: 220 },
  photoPh: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  expand: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 7 },
  close: { position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 6 },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13.5, fontWeight: '600' },
  facts: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fact: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 10, gap: 2 },
  factLabel: { fontSize: 13.5, fontWeight: '800', marginTop: 4 },
  factSub: { fontSize: 11.5, fontWeight: '600' },
  address: { fontSize: 13, marginTop: 14, lineHeight: 18 },
  mapBtn: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#f97316', borderRadius: 14, paddingVertical: 12,
  },
  mapText: { color: '#EA580C', fontSize: 15, fontWeight: '800' },
  note: { fontSize: 11.5, textAlign: 'center', marginTop: 10 },
});
