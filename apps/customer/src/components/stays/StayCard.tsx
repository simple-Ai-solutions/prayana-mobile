// StayCard — one search result, plus the small rating pieces the property
// screen reuses (StarRow, RatingBadge).
//
// The price block answers the question the guest actually has:
//   - with dates: the nightly rate (before GST), the whole-stay total incl.
//     taxes for their party and dates, or why they can't book it;
//   - without dates: the lowest nightly rate and a nudge to add dates.
// Unavailable stays stay in the list (the server sorts them last) but are
// dimmed, so a guest can still open one and try other dates.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { AMENITY_BY_ID, MEAL_LABEL, propertyTypeLabel } from '../../lib/stayLabels';
import { fmtRange, inrWhole, plural, type GoogleRating, type StayRatingSummary, type StaySearchCard } from '../../lib/stays';

const GREEN = '#059669';
const AMBER = '#F59E0B';

export function StarRow({ stars, size = 12 }: { stars?: number | null; size?: number }) {
  if (!stars) return null;
  return (
    <View style={styles.starRow} accessible accessibilityLabel={`${stars}-star property`}>
      {Array.from({ length: stars }).map((_, i) => (
        <Ionicons key={i} name="star" size={size} color={AMBER} />
      ))}
    </View>
  );
}

/**
 * Prayana guests' rating when there is one, else Google's. Prayana's comes
 * from verified stays, so it leads.
 */
export function RatingBadge({
  rating,
  google,
  size = 'sm',
  showBoth = false,
}: {
  rating?: StayRatingSummary;
  google?: GoogleRating;
  size?: 'sm' | 'md';
  /** On the property page both are shown, each labelled. */
  showBoth?: boolean;
}) {
  const { themeColors } = useTheme();
  const hasOwn = Boolean(rating && rating.count > 0 && rating.average);
  const hasGoogle = Boolean(google?.rating);
  const big = size === 'md';

  const pill = (value: number, color: string) => (
    <View style={[styles.ratingPill, { backgroundColor: color }, big && styles.ratingPillMd]}>
      <Text style={[styles.ratingPillText, big && { fontSize: fontSize.sm }]}>{value.toFixed(1)}</Text>
      <Ionicons name="star" size={big ? 11 : 10} color="#fff" />
    </View>
  );

  const own = hasOwn && rating ? (
    <View style={styles.ratingRow} accessible accessibilityLabel={`Rated ${rating.average.toFixed(1)} out of 5 by ${plural(rating.count, 'Prayana guest')}`}>
      {pill(rating.average, GREEN)}
      <Text style={[styles.ratingText, { color: themeColors.textSecondary }, big && { fontSize: fontSize.sm }]}>
        {plural(rating.count, 'review')}
      </Text>
    </View>
  ) : null;

  const g = hasGoogle && google?.rating ? (
    <View style={styles.ratingRow} accessible accessibilityLabel={`Rated ${Number(google.rating).toFixed(1)} on Google`}>
      {pill(Number(google.rating), hasOwn ? '#64748B' : GREEN)}
      <Text style={[styles.ratingText, { color: themeColors.textSecondary }, big && { fontSize: fontSize.sm }]}>
        {google.userRatingsTotal ? `${Number(google.userRatingsTotal).toLocaleString('en-IN')} on Google` : 'on Google'}
      </Text>
    </View>
  ) : null;

  if (showBoth) {
    if (!own && !g) return null;
    return (
      <View style={styles.ratingBoth}>
        {own}
        {g}
      </View>
    );
  }
  return own || g;
}

export function Chip({ icon, label, tone = 'neutral' }: { icon?: keyof typeof Ionicons.glyphMap; label: string; tone?: 'neutral' | 'brand' | 'green' }) {
  const { themeColors, brand, isDarkMode } = useTheme();
  const colorsFor = {
    neutral: { bg: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary, fg: themeColors.textSecondary },
    brand: { bg: isDarkMode ? 'rgba(249,115,22,0.16)' : brand[50], fg: isDarkMode ? brand[300] : brand[700] },
    green: { bg: isDarkMode ? 'rgba(16,185,129,0.16)' : '#ECFDF5', fg: isDarkMode ? '#6EE7B7' : '#047857' },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colorsFor.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={colorsFor.fg} /> : null}
      <Text style={[styles.chipText, { color: colorsFor.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PriceBlock({ stay, dates }: { stay: StaySearchCard; dates?: { checkIn: string; checkOut: string } | null }) {
  const { themeColors } = useTheme();
  const price = stay.price || {};

  if (price.available === false) {
    return (
      <View>
        <Text style={[styles.unavailTitle, { color: themeColors.text }]}>
          {price.soldOut ? 'Sold out for these dates' : "Doesn't fit your group"}
        </Text>
        <Text style={[styles.priceSub, { color: themeColors.textSecondary }]}>
          {price.soldOut ? 'Try other dates' : 'Try fewer guests or more rooms'}
        </Text>
      </View>
    );
  }

  if (price.available === true) {
    return (
      <View>
        {price.roomsLeft ? <Text style={styles.left}>Only {price.roomsLeft} left</Text> : null}
        <Text style={[styles.priceMain, { color: themeColors.text }]}>
          {inrWhole(price.nightly)}
          <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}> / night</Text>
        </Text>
        <Text style={[styles.priceSub, { color: themeColors.textSecondary }]}>{inrWhole(price.total)} total incl. taxes</Text>
        {dates ? (
          <Text style={[styles.priceSub, { color: themeColors.textTertiary }]}>
            {fmtRange(dates.checkIn, dates.checkOut)}
            {stay.nights ? ` · ${plural(stay.nights, 'night')}` : ''}
          </Text>
        ) : null}
      </View>
    );
  }

  // No dates: the lowest nightly price, before GST.
  return (
    <View>
      <Text style={[styles.priceSub, { color: themeColors.textSecondary }]}>from</Text>
      <Text style={[styles.priceMain, { color: themeColors.text }]}>
        {inrWhole(price.nightly)}
        <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}> / night + taxes</Text>
      </Text>
    </View>
  );
}

export function StayCard({
  stay,
  dates,
  onPress,
}: {
  stay: StaySearchCard;
  dates?: { checkIn: string; checkOut: string } | null;
  onPress: () => void;
}) {
  const { themeColors, brand, isDarkMode } = useTheme();
  const price = stay.price || {};
  const unavailable = price.available === false;
  const cover = stay.coverPhoto || stay.photos?.[0];
  const place = [stay.location?.locality, stay.location?.city].filter(Boolean).join(', ');
  const amenities = (stay.amenities || []).map((id) => AMENITY_BY_ID[id]).filter(Boolean).slice(0, 3);
  const rules = stay.houseRules || {};
  const typeLabel = propertyTypeLabel(stay.propertyType);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={`${stay.name}, ${typeLabel}${place ? ` in ${place}` : ''}`}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder },
          !isDarkMode && shadow.sm,
          unavailable && { opacity: 0.72 },
        ]}
      >
        <View style={[styles.cover, { backgroundColor: themeColors.backgroundSecondary }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={stay._id} />
          ) : (
            <View style={styles.coverEmpty}>
              <Ionicons name="bed-outline" size={36} color={themeColors.textTertiary} />
            </View>
          )}
          {stay.freeCancellation && !unavailable ? (
            <View style={styles.coverTag}>
              <Ionicons name="shield-checkmark" size={12} color={GREEN} />
              <Text style={styles.coverTagText}>Free cancellation</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.typeRow}>
            <Text style={[styles.type, { color: isDarkMode ? brand[300] : brand[700] }]}>{typeLabel}</Text>
            <StarRow stars={stay.starRating} />
          </View>
          <Text style={[styles.name, { color: themeColors.text }]} numberOfLines={2}>
            {stay.name}
          </Text>
          {place ? (
            <View style={styles.placeRow}>
              <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
              <Text style={[styles.place, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {place}
              </Text>
            </View>
          ) : null}
          <RatingBadge rating={stay.rating} google={stay.google} />

          {amenities.length > 0 || rules.coupleFriendly === true || rules.localIdAccepted === true || rules.petsAllowed === true ? (
            <View style={styles.chips}>
              {rules.coupleFriendly === true ? <Chip tone="brand" icon="heart-outline" label="Couple-friendly" /> : null}
              {rules.localIdAccepted === true ? <Chip icon="card-outline" label="Local ID OK" /> : null}
              {rules.petsAllowed === true ? <Chip icon="paw-outline" label="Pet-friendly" /> : null}
              {amenities.map((a) => (
                <Chip key={a.id} icon={a.icon} label={a.label} />
              ))}
            </View>
          ) : null}

          {price.available === true && price.roomTypeName ? (
            <Text style={[styles.roomLine, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {price.roomTypeName}
              {price.mealPlan && MEAL_LABEL[price.mealPlan] ? ` · ${MEAL_LABEL[price.mealPlan]}` : ''}
            </Text>
          ) : null}

          <View style={[styles.priceRow, { borderTopColor: themeColors.border }]}>
            <View style={{ flex: 1 }}>
              <PriceBlock stay={stay} dates={dates} />
            </View>
            {price.available == null ? (
              <View style={styles.addDates}>
                <Ionicons name="calendar-outline" size={13} color={brand[600]} />
                <Text style={[styles.addDatesText, { color: brand[600] }]}>Add dates for the total</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  coverTag: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  coverTagText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#047857' },
  body: { padding: spacing.md, gap: 6 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  type: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 20 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  place: { flex: 1, fontSize: fontSize.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBoth: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ratingPillMd: { paddingHorizontal: 8, paddingVertical: 3 },
  ratingPillText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  ratingText: { fontSize: fontSize.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full, maxWidth: '100%' },
  chipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, flexShrink: 1 },
  roomLine: { fontSize: fontSize.xs },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: 4,
  },
  left: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#DC2626', marginBottom: 2 },
  priceMain: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  priceUnit: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  priceSub: { fontSize: fontSize.xs, marginTop: 1 },
  unavailTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  addDates: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '45%' },
  addDatesText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, flexShrink: 1 },
});
