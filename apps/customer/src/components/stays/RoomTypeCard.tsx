// RoomTypeCard — one room type on the property screen: its photo, what's in
// it, and what it costs this guest. Five price states, driven by the
// server's availability for the chosen dates and party (web: RoomTypeCard):
//   no dates     → nightly rate + "Choose dates"
//   doesn't fit  → the server's reason, plus "Book N rooms" when more rooms
//                  of this type would fit everyone
//   sold out     → dimmed, no button
//   too few left → "Only N left", no button
//   bookable     → total incl. GST for the stay, and Reserve
//
// Dorm rooms are sold by the bed: `units` is the number of guests.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Button, useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { BED_LABEL, FEATURE_LABEL, MEAL_LABEL } from '../../lib/stayLabels';
import {
  MAX_ROOMS,
  inrWhole,
  plural,
  unitWord,
  type AvailabilityRow,
  type StayPhoto,
  type StayRoomType,
} from '../../lib/stays';
import { Chip } from './StayCard';

// Bed types that read naturally with "bed" after them ("Queen bed", not "Sofa-bed bed").
const SAYS_BED = new Set(['king', 'queen', 'double', 'single', 'bunk']);

function bedText(room: StayRoomType): string | null {
  const label = room.bedType ? BED_LABEL[room.bedType] : undefined;
  const beds = Number(room.beds) || 0;
  if (room.kind === 'dorm') {
    return [beds ? `${beds}-bed dorm` : 'Dorm', label ? `${label.toLowerCase()} beds` : null].filter(Boolean).join(' · ');
  }
  if (room.kind === 'entire_place') {
    const bedrooms = Number(room.bedrooms) || 1;
    return [plural(bedrooms, 'bedroom'), beds ? plural(beds, 'bed') : null].filter(Boolean).join(' · ');
  }
  if (!label) return beds > 1 ? plural(beds, 'bed') : null;
  const name = room.bedType && SAYS_BED.has(room.bedType) ? `${label} bed` : label;
  return beds > 1 ? `${beds} × ${name}` : name;
}

function bathText(room: StayRoomType): string | null {
  if (room.kind === 'entire_place' && room.bathrooms) return plural(Number(room.bathrooms), 'bathroom');
  if (room.bathroom === 'shared') return 'Shared bathroom';
  if (room.bathroom === 'attached') return room.kind === 'entire_place' ? 'Private bathroom' : 'Attached bathroom';
  return null;
}

function Fact({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: string | null | undefined }) {
  const { themeColors } = useTheme();
  if (!children) return null;
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={themeColors.textTertiary} />
      <Text style={[styles.factText, { color: themeColors.textSecondary }]}>{children}</Text>
    </View>
  );
}

export function RoomTypeCard({
  room,
  photos,
  avail,
  nights,
  adults,
  onReserve,
  onBookRooms,
  onChooseDates,
  onOpenPhotos,
}: {
  room: StayRoomType;
  photos: StayPhoto[];
  /** This room's availability row, or null without dates. */
  avail: AvailabilityRow | null;
  nights: number | null;
  adults: number;
  onReserve: (avail: AvailabilityRow) => void;
  onBookRooms: (n: number) => void;
  onChooseDates: () => void;
  onOpenPhotos: () => void;
}) {
  const { themeColors, isDarkMode, brand } = useTheme();
  const isDorm = room.kind === 'dorm';
  const perNight = room.price?.perNight;
  const extraPerson = Number(room.price?.extraPerson) || 0;
  const features = (room.features || []).map((f) => FEATURE_LABEL[f]).filter(Boolean);
  const cover = photos[0];

  const soldOut = Boolean(avail && avail.fits && (avail.soldOut || avail.available <= 0));
  const tooFew = Boolean(avail && avail.fits && !soldOut && !avail.price);
  const bookable = Boolean(avail && avail.fits && avail.price);
  // Only offer more rooms when the picker could set that many: each room
  // needs an adult, and the picker stops at MAX_ROOMS.
  const canBookMore = Boolean(
    avail && !avail.fits && avail.roomsNeeded && avail.roomsNeeded <= MAX_ROOMS && avail.roomsNeeded <= adults,
  );
  const per = isDorm ? 'bed' : 'room';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder },
        soldOut && { opacity: 0.72 },
      ]}
    >
      {cover ? (
        <TouchableOpacity
          onPress={onOpenPhotos}
          activeOpacity={0.9}
          accessibilityRole="imagebutton"
          accessibilityLabel={`See photos of ${room.name}`}
        >
          <Image source={{ uri: cover.url }} style={styles.photo} contentFit="cover" transition={150} />
          {photos.length > 1 ? (
            <View style={styles.photoCount}>
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}

      <View style={styles.body}>
        <Text style={[styles.name, { color: themeColors.text }]}>{room.name}</Text>
        <View style={styles.facts}>
          <Fact icon={room.ac === false ? 'leaf-outline' : 'snow-outline'}>{room.ac === false ? 'Non-AC' : 'AC'}</Fact>
          <Fact icon="bed-outline">{bedText(room)}</Fact>
          <Fact icon="water-outline">{bathText(room)}</Fact>
          <Fact icon="resize-outline">{room.sizeSqft ? `${Number(room.sizeSqft).toLocaleString('en-IN')} sq ft` : null}</Fact>
          <Fact icon="people-outline">{isDorm ? 'Priced per bed' : room.maxOccupancy ? `Sleeps up to ${room.maxOccupancy}` : null}</Fact>
          <Fact icon="restaurant-outline">{room.mealPlan ? MEAL_LABEL[room.mealPlan] : null}</Fact>
        </View>
        {features.length > 0 ? (
          <View style={styles.chips}>
            {features.map((f) => (
              <Chip key={f} label={f} />
            ))}
          </View>
        ) : null}
        {!isDorm && extraPerson > 0 && (room.baseOccupancy || 0) > 0 && (room.maxOccupancy || 0) > (room.baseOccupancy || 0) ? (
          <Text style={[styles.note, { color: themeColors.textSecondary }]}>
            Price is for {plural(room.baseOccupancy || 0, 'guest')}; each extra guest {inrWhole(extraPerson)} a night.
          </Text>
        ) : null}
      </View>

      <View style={[styles.priceArea, { borderTopColor: themeColors.border }]}>
        {!avail ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={[styles.price, { color: themeColors.text }]}>
                {inrWhole(perNight)}
                <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}> / {isDorm ? 'bed' : 'night'} + taxes</Text>
              </Text>
              {room.price?.weekendPerNight && room.price.weekendPerNight !== perNight ? (
                <Text style={[styles.sub, { color: themeColors.textSecondary }]}>Weekends {inrWhole(room.price.weekendPerNight)}</Text>
              ) : null}
              <Text style={[styles.sub, { color: themeColors.textSecondary }]}>Choose dates to see the total</Text>
            </View>
            <Button
              title="Choose dates"
              variant="outline"
              size="sm"
              onPress={onChooseDates}
              icon={<Ionicons name="calendar-outline" size={15} color={brand[500]} />}
            />
          </>
        ) : !avail.fits ? (
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={styles.fitRow}>
              <Ionicons name="information-circle-outline" size={16} color={isDarkMode ? '#FCD34D' : '#B45309'} />
              <Text style={[styles.fitText, { color: isDarkMode ? '#FCD34D' : '#B45309' }]}>
                {avail.fitMessage || "This room doesn't fit your group"}
              </Text>
            </View>
            <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
              {inrWhole(avail.avgNightly)} / {per} a night + taxes
            </Text>
            {canBookMore && avail.roomsNeeded ? (
              <Button
                title={`Book ${avail.roomsNeeded} ${unitWord(room.kind, avail.roomsNeeded)}`}
                variant="outline"
                size="sm"
                onPress={() => onBookRooms(avail.roomsNeeded as number)}
                style={{ alignSelf: 'flex-start' }}
              />
            ) : null}
          </View>
        ) : soldOut ? (
          <View style={{ flex: 1 }}>
            <Text style={[styles.unavail, { color: themeColors.text }]}>Sold out for these dates</Text>
            <Text style={[styles.sub, { color: themeColors.textSecondary }]}>Try other dates or another room</Text>
          </View>
        ) : tooFew ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.left}>
              Only {avail.available} {unitWord(room.kind, avail.available)} left
            </Text>
            <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
              You need {avail.units}. Try other dates or another room.
            </Text>
          </View>
        ) : bookable && avail.price ? (
          <>
            <View style={{ flex: 1 }}>
              {avail.available <= 3 ? (
                <Text style={styles.left}>
                  Only {avail.available} {unitWord(room.kind, avail.available)} left
                </Text>
              ) : null}
              <Text style={[styles.price, { color: themeColors.text }]}>
                {inrWhole(avail.price.total)}
                <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}> incl. taxes</Text>
              </Text>
              <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
                {inrWhole(avail.avgNightly)} / {per} a night · {plural(nights || 0, 'night')} · {avail.units}{' '}
                {unitWord(room.kind, avail.units)}
              </Text>
              {Number(avail.price.extraTotal) > 0 ? (
                <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
                  Includes {inrWhole(avail.price.extraTotal)} for extra guests
                </Text>
              ) : null}
            </View>
            <Button title="Reserve" onPress={() => onReserve(avail)} size="md" />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  photoCount: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  photoCountText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  body: { padding: spacing.md, gap: spacing.sm },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { fontSize: fontSize.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { fontSize: fontSize.xs },
  priceArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  priceUnit: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  sub: { fontSize: fontSize.xs, marginTop: 2 },
  left: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#DC2626', marginBottom: 2 },
  unavail: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  fitText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
