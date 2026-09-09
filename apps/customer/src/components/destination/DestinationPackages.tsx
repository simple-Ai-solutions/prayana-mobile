// "Holiday Packages" tab for the destination search-results page.
// Loads Prayana holiday packages for the destination (searchPackages by name,
// which the server expands: "Rajasthan" → Jaipur/Udaipur/… ) and renders them
// as tappable cards → /packages/[id]. Mirrors the PWA DestinationPackagesPanel.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Briefcase, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';

interface Props {
  locationName: string;
}

const pkgImage = (p: any) =>
  p?.images?.find?.((i: any) => i.isPrimary)?.url || p?.images?.[0]?.url || p?.coverImage || null;

export const DestinationPackages: React.FC<Props> = ({ locationName }) => {
  const { themeColors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res: any = await holidayPackagesAPI.search({ destination: locationName, limit: 12 });
        const data = res?.data || res?.data?.packages || res?.packages || [];
        if (active) setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.warn('[DestinationPackages] failed:', e?.message);
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [locationName]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary[500]} size="large" />
        <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
          Finding holiday packages for {locationName}…
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <View style={[styles.emptyIcon, { backgroundColor: themeColors.surface }]}>
          <Briefcase size={22} color={themeColors.textTertiary} />
        </View>
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
          No packages for {locationName} yet
        </Text>
        <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
          We can still put one together — or browse what we do have.
        </Text>
        <TouchableOpacity
          style={[styles.cta, { borderColor: colors.primary[300] }]}
          activeOpacity={0.85}
          onPress={() => router.push('/packages' as any)}
        >
          <Text style={[styles.ctaText, { color: colors.primary[600] }]}>Browse all packages</Text>
          <ArrowRight size={16} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((p: any, idx: number) => {
        const img = pkgImage(p);
        const price = p?.pricing?.startingFrom ?? null;
        const days = p?.duration?.days;
        const nights = p?.duration?.nights ?? (days ? days - 1 : 0);
        return (
          <TouchableOpacity
            key={p._id || idx}
            style={[styles.card, shadow.sm, { backgroundColor: themeColors.surface }]}
            activeOpacity={0.85}
            onPress={() => router.push(`/packages/${encodeURIComponent(p.slug || p._id)}` as any)}
          >
            {img ? (
              <Image source={{ uri: img }} style={styles.cardImg} />
            ) : (
              <View style={[styles.cardImg, { backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' }]}>
                <Briefcase size={22} color={colors.primary[400]} />
              </View>
            )}
            {days ? (
              <View style={styles.durBadge}><Text style={styles.durBadgeText}>{days}D / {nights}N</Text></View>
            ) : null}
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
                {p.title}
              </Text>
              {price != null && price > 0 && (
                <Text style={styles.priceText}>
                  <Text style={[styles.fromLabel, { color: themeColors.textSecondary }]}>from </Text>
                  ₹{Number(price).toLocaleString('en-IN')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.cta, { borderColor: colors.primary[300] }]}
        activeOpacity={0.85}
        onPress={() => router.push('/packages' as any)}
      >
        <Text style={[styles.ctaText, { color: colors.primary[600] }]}>Browse all packages</Text>
        <ArrowRight size={16} color={colors.primary[600]} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md },
  centerText: { fontSize: fontSize.sm, textAlign: 'center', maxWidth: 280 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: '48%', borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md },
  cardImg: { width: '100%', height: 120 },
  durBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  durBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 18 },
  priceText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[600] },
  fromLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },
  cta: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1.5, marginTop: spacing.sm },
  ctaText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
