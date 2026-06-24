import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import {
  Card,
  Badge,
  EmptyState,
  StarRating,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { transportAPI } from '@prayana/shared-services';

type VehicleType = 'all' | 'taxi' | 'self_drive_car' | 'self_drive_bike' | 'airport_transfer' | 'tempo' | 'bus';

const TYPES: { key: VehicleType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'taxi', label: 'Taxi', icon: 'car-sport-outline' },
  { key: 'self_drive_car', label: 'Self-drive 4W', icon: 'car-outline' },
  { key: 'self_drive_bike', label: 'Self-drive 2W', icon: 'bicycle-outline' },
  { key: 'airport_transfer', label: 'Airport', icon: 'airplane-outline' },
  { key: 'tempo', label: 'Tempo', icon: 'cube-outline' },
  { key: 'bus', label: 'Bus', icon: 'bus-outline' },
];

type Vehicle = {
  _id: string;
  slug?: string;
  name: string;
  type?: string;
  category?: string;
  city?: string;
  state?: string;
  images?: { url: string }[];
  pricing?: { perKm?: number; perDay?: number; perHour?: number; basePrice?: number; currency?: string };
  rating?: { average?: number; count?: number };
  capacity?: { passengers?: number; luggage?: number };
  fuelType?: string;
  transmission?: string;
};

export default function TransportScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [type, setType] = useState<VehicleType>('all');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await transportAPI.listVehicles({
        type: type !== 'all' ? type : undefined,
        limit: 30,
      });
      setVehicles(res?.data || res?.vehicles || []);
    } catch (err: any) {
      console.warn('[Transport] load failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Transport</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Hero */}
      <LinearGradient
        colors={[colors.primary[500], colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>Move freely, anywhere</Text>
        <Text style={styles.heroSubtitle}>
          Taxis, self-drive cars & bikes, airport transfers
        </Text>
      </LinearGradient>

      {/* Type chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
      >
        {TYPES.map((t) => {
          const active = type === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setType(t.key)}
              style={[
                styles.typeChip,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                active && styles.typeChipActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name={t.icon} size={16} color={active ? '#fff' : themeColors.textSecondary} />
              <Text style={[styles.typeChipText, { color: themeColors.textSecondary }, active && styles.typeChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="car-outline" size={56} color={colors.gray[300]} />}
          title="No vehicles found"
          description="Try a different vehicle type or check back later."
          actionLabel="Show all"
          onAction={() => setType('all')}
        />
      ) : (
        <FlashList
          data={vehicles}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <VehicleCard
              vehicle={item}
              onPress={() => router.push(`/transport/${encodeURIComponent(item.slug || item._id)}`)}
            />
          )}
          contentContainerStyle={{ paddingBottom: spacing['3xl'], paddingTop: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const { themeColors } = useTheme();
  const img = vehicle.images?.[0]?.url;
  const perDay = vehicle.pricing?.perDay;
  const perKm = vehicle.pricing?.perKm;
  const perHour = vehicle.pricing?.perHour;
  const headline = perDay
    ? `₹${perDay.toLocaleString('en-IN')}/day`
    : perKm
      ? `₹${perKm}/km`
      : perHour
        ? `₹${perHour}/hr`
        : '—';

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.cardWrap}>
      <Card style={styles.card}>
        <View style={styles.cardImageWrap}>
          {img ? (
            <Image source={{ uri: img }} style={styles.cardImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={[colors.gray[200], colors.gray[300]]} style={styles.cardImage} />
          )}
          {vehicle.type ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{vehicle.type.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>{vehicle.name}</Text>
          {vehicle.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{[vehicle.city, vehicle.state].filter(Boolean).join(', ')}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            {vehicle.capacity?.passengers ? (
              <>
                <Ionicons name="people-outline" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{vehicle.capacity.passengers} pax</Text>
              </>
            ) : null}
            {vehicle.transmission ? (
              <>
                <Text style={[styles.dot, { color: themeColors.textTertiary }]}>·</Text>
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{vehicle.transmission}</Text>
              </>
            ) : null}
            {vehicle.fuelType ? (
              <>
                <Text style={[styles.dot, { color: themeColors.textTertiary }]}>·</Text>
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{vehicle.fuelType}</Text>
              </>
            ) : null}
          </View>
          {vehicle.rating?.average ? (
            <View style={styles.metaRow}>
              <StarRating rating={vehicle.rating.average} size={12} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {vehicle.rating.average.toFixed(1)} ({vehicle.rating.count || 0})
              </Text>
            </View>
          ) : null}
          <View style={[styles.priceRow, { borderTopColor: themeColors.border }]}>
            <Text style={styles.priceValue}>{headline}</Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Book</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  heroTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: '#fff' },
  heroSubtitle: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  typeRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  typeChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  typeChipTextActive: { color: '#fff' },

  cardWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  card: { padding: 0, overflow: 'hidden', ...shadow.sm },
  cardImageWrap: { width: '100%', height: 160, position: 'relative', backgroundColor: colors.gray[200] },
  cardImage: { width: '100%', height: '100%' },
  typeBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardBody: { padding: spacing.md, gap: 4 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary },
  dot: { color: colors.textTertiary, fontSize: fontSize.sm },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[600] },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  ctaText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
