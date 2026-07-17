// Package preview — RN port of the web partner-portal's PackagePreview.jsx
// (apps/vendor/business/packages/PackagePreview.jsx, ground truth).
//
// Read-only review of the whole wizard state plus a submission checklist. Props
// are `{ values }` only (no onChange) — nothing here mutates the form.
// This is a wizard SUB-STEP: it renders plain content; the shell owns the page
// chrome (SafeAreaView / ScrollView / header).

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, useTheme } from '@prayana/shared-ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import { PackageFormValues } from './packageTypes';

// Vendor price convention (packages/index.tsx): ₹ + en-IN grouping.
const formatPrice = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

const fmtDepartureDate = (iso: string) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function PackagePreview({ values }: { values: PackageFormValues }) {
  const { themeColors } = useTheme();

  const defaultVariant = values.variants.find((v) => v.isDefault) || values.variants[0];
  const nights = Math.max(0, Math.round(Number(values.nights) || 0));
  const days = nights + 1;
  const coverImage =
    values.images.find((img) => img.isPrimary)?.url || values.images[0]?.url;
  const activeVariants = values.variants.filter((v) => v.isActive);
  const destinationLabel =
    values.destinations
      .map((d) => d.name || d.city)
      .filter(Boolean)
      .join(' → ') || 'No destinations';

  const checklist = [
    { ok: !!values.title.trim(), label: 'Package title' },
    { ok: !!values.description.trim(), label: 'Description' },
    { ok: values.category.length > 0, label: 'Categories selected' },
    { ok: values.destinations.some((d) => d.name || d.city), label: 'Destinations added' },
    { ok: values.itinerary.length > 0, label: 'Itinerary built' },
    { ok: values.variants.some((v) => Number(v.pricing.basePrice) > 0), label: 'Pricing set' },
    { ok: values.images.length > 0, label: 'At least 1 image' },
  ];

  return (
    <View style={styles.root}>
      {/* ── Approval notice ── */}
      <View style={[styles.notice, { backgroundColor: colors.warningLight }]}>
        <Ionicons name="information-circle-outline" size={18} color="#a16207" />
        <Text style={[styles.noticeText, { color: '#a16207' }]}>
          Review your package below. Once submitted, it will go through admin approval before going
          live.
        </Text>
      </View>

      {/* ── Header card ── */}
      <Card bordered elevated={false} padding="lg" style={styles.headerCard}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.cover} resizeMode="cover" />
        ) : null}
        <View style={styles.headerBody}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.title, { color: themeColors.text }]}>
                {values.title || 'Untitled Package'}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={themeColors.textTertiary} />
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {destinationLabel}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={themeColors.textTertiary} />
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                  {days}D / {nights}N
                </Text>
              </View>
            </View>
            {defaultVariant ? (
              <View style={styles.priceWrap}>
                <Text style={[styles.price, { color: colors.primary[500] }]}>
                  {formatPrice(defaultVariant.pricing.basePrice)}
                </Text>
                <Text style={[styles.priceLabel, { color: themeColors.textTertiary }]}>per person</Text>
              </View>
            ) : null}
          </View>

          {values.description ? (
            <Text style={[styles.description, { color: themeColors.textSecondary }]}>
              {values.description.slice(0, 200)}
              {values.description.length > 200 ? '…' : ''}
            </Text>
          ) : null}

          {values.category.length > 0 ? (
            <View style={styles.chipWrap}>
              {values.category.map((cat) => (
                <View key={cat} style={[styles.categoryChip, { backgroundColor: colors.primary[50] }]}>
                  <Text style={[styles.categoryChipText, { color: colors.primary[600] }]}>{cat}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      {/* ── Variants ── */}
      {activeVariants.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Package Variants</Text>
          {activeVariants.map((v, idx) => (
            <Card
              key={idx}
              bordered
              elevated={false}
              padding="md"
              style={[styles.variantCard, v.isDefault && { borderColor: colors.primary[500] }]}
            >
              <View style={styles.variantHead}>
                <Text style={[styles.variantName, { color: themeColors.text }]}>
                  {v.displayName || v.name}
                </Text>
                {v.isDefault ? <Badge label="Popular" variant="primary" /> : null}
              </View>
              <Text style={[styles.variantPrice, { color: themeColors.text }]}>
                {formatPrice(v.pricing.basePrice)}
                <Text style={[styles.variantPriceUnit, { color: themeColors.textTertiary }]}> /person</Text>
              </Text>
              <View style={styles.variantMetaWrap}>
                {v.hotelCategory ? (
                  <VariantMeta icon="bed-outline" text={`${v.hotelCategory} hotel`} themeColors={themeColors} />
                ) : null}
                {v.mealPlan ? (
                  <VariantMeta icon="restaurant-outline" text={`${v.mealPlan} meal plan`} themeColors={themeColors} />
                ) : null}
                {v.maxGroupSize ? (
                  <VariantMeta icon="people-outline" text={`Max ${v.maxGroupSize} people`} themeColors={themeColors} />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ── Itinerary summary ── */}
      {values.itinerary.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Itinerary</Text>
          {values.itinerary.map((day, idx) => {
            const activityCount = (day.activities || []).length;
            const meals: string[] = [];
            if (day.meals?.breakfast?.included) meals.push('Breakfast');
            if (day.meals?.lunch?.included) meals.push('Lunch');
            if (day.meals?.dinner?.included) meals.push('Dinner');
            const parts = [`${activityCount} ${activityCount === 1 ? 'activity' : 'activities'}`, ...meals];
            if (day.accommodation?.hotelName) parts.push(`Stay: ${day.accommodation.hotelName}`);
            return (
              <View key={idx} style={[styles.dayRow, { backgroundColor: themeColors.backgroundSecondary }]}>
                <View style={[styles.dayBadge, { backgroundColor: colors.primary[500] }]}>
                  <Text style={styles.dayBadgeText}>{day.dayNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dayTitle, { color: themeColors.text }]}>
                    {day.title || `Day ${day.dayNumber}`}
                    {day.destination ? (
                      <Text style={[styles.dayDestination, { color: themeColors.textTertiary }]}>
                        {' '}
                        - {day.destination}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={[styles.daySub, { color: themeColors.textSecondary }]}>
                    {parts.join(' | ')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* ── Inclusions ── */}
      {values.inclusions.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Included</Text>
          {values.inclusions.map((item, idx) => (
            <View key={idx} style={styles.listRow}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Exclusions ── */}
      {values.exclusions.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Not Included</Text>
          {values.exclusions.map((item, idx) => (
            <View key={idx} style={styles.listRow}>
              <Ionicons name="close-circle" size={15} color={colors.error} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Departures ── */}
      {values.departures.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Upcoming Departures</Text>
          <View style={styles.departureWrap}>
            {values.departures.map((dep, idx) => (
              <View
                key={idx}
                style={[styles.departureChip, { backgroundColor: themeColors.backgroundSecondary }]}
              >
                <Text style={[styles.departureDate, { color: themeColors.text }]}>
                  {fmtDepartureDate(dep.startDate)}
                </Text>
                <Text style={[styles.departureSlots, { color: themeColors.textTertiary }]}>
                  {dep.availableSlots} slots
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Submission checklist ── */}
      <View style={[styles.checklistCard, { backgroundColor: colors.primary[50] }]}>
        <Text style={[styles.checklistTitle, { color: colors.primary[700] }]}>Submission Checklist</Text>
        {checklist.map((item, idx) => (
          <View key={idx} style={styles.checklistRow}>
            <Ionicons
              name={item.ok ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={item.ok ? colors.success : colors.error}
            />
            <Text style={[styles.checklistText, { color: item.ok ? colors.success : colors.error }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function VariantMeta({
  icon,
  text,
  themeColors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  themeColors: ReturnType<typeof useTheme>['themeColors'];
}) {
  return (
    <View style={styles.variantMetaRow}>
      <Ionicons name={icon} size={13} color={themeColors.textTertiary} />
      <Text style={[styles.variantMetaText, { color: themeColors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },

  // Notice
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  noticeText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },

  // Header card
  headerCard: { padding: 0 },
  cover: { width: '100%', height: 180 },
  headerBody: { padding: spacing.lg, gap: spacing.sm },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  headerTitleWrap: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { flex: 1, fontSize: fontSize.sm },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  priceLabel: { fontSize: fontSize.xs },
  description: { fontSize: fontSize.sm, lineHeight: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  categoryChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  // Sections
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  // Variants
  variantCard: { gap: spacing.xs, borderWidth: 1 },
  variantHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  variantName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1 },
  variantPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  variantPriceUnit: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },
  variantMetaWrap: { gap: 4, marginTop: spacing.xs },
  variantMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  variantMetaText: { fontSize: fontSize.xs, textTransform: 'capitalize' },

  // Itinerary
  dayRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  dayTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  dayDestination: { fontWeight: fontWeight.normal },
  daySub: { fontSize: fontSize.xs, marginTop: 2 },

  // Inclusion / exclusion lists
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listText: { flex: 1, fontSize: fontSize.sm },

  // Departures
  departureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  departureChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  departureDate: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  departureSlots: { fontSize: fontSize.xs, marginTop: 2 },

  // Checklist
  checklistCard: { padding: spacing.md, borderRadius: borderRadius.lg, gap: spacing.xs },
  checklistTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checklistText: { fontSize: fontSize.sm },
});
