import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  Card,
  Badge,
  StarRating,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { transportAPI } from '@prayana/shared-services';
import { useRequireAuth } from '../../lib/useRequireAuth';

const { width: SCREEN_W } = Dimensions.get('window');

type Vehicle = {
  _id: string;
  name: string;
  type?: string;
  description?: string;
  city?: string;
  state?: string;
  images?: { url: string }[];
  pricing?: { perKm?: number; perDay?: number; perHour?: number; basePrice?: number; deposit?: number; currency?: string };
  rating?: { average?: number; count?: number };
  capacity?: { passengers?: number; luggage?: number };
  fuelType?: string;
  transmission?: string;
  features?: string[];
  inclusions?: string[];
  exclusions?: string[];
  driverIncluded?: boolean;
  pickupPoints?: { name: string; address?: string }[];
};

export default function TransportDetailScreen() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);

  const fetchVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await transportAPI.getVehicleBySlug(id);
      setVehicle(res?.data || res?.vehicle || null);
    } catch (err: any) {
      console.warn('[TransportDetail] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Vehicle not found</Text>
          <Button title="Browse" onPress={() => router.replace('/transport')} variant="primary" size="md" />
        </View>
      </SafeAreaView>
    );
  }

  const images = vehicle.images?.length ? vehicle.images : [{ url: '' }];
  const headlinePrice =
    vehicle.pricing?.perDay
      ? `₹${vehicle.pricing.perDay.toLocaleString('en-IN')} / day`
      : vehicle.pricing?.perKm
        ? `₹${vehicle.pricing.perKm} / km`
        : vehicle.pricing?.perHour
          ? `₹${vehicle.pricing.perHour} / hr`
          : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.fab}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.carousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          >
            {images.map((img, idx) =>
              img.url ? (
                <Image key={idx} source={{ uri: img.url }} style={styles.carouselImage} contentFit="cover" />
              ) : (
                <LinearGradient key={idx} colors={[colors.gray[300], colors.gray[400]]} style={styles.carouselImage} />
              ),
            )}
          </ScrollView>
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImg && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.headerSection}>
          {vehicle.type ? (
            <Badge label={vehicle.type.replace(/_/g, ' ').toUpperCase()} variant="primary" size="sm" />
          ) : null}
          <Text style={styles.title}>{vehicle.name}</Text>
          {vehicle.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {[vehicle.city, vehicle.state].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
          {vehicle.rating?.average ? (
            <View style={styles.metaRow}>
              <StarRating rating={vehicle.rating.average} size={14} />
              <Text style={styles.metaText}>
                {vehicle.rating.average.toFixed(1)} ({vehicle.rating.count || 0} ratings)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Quick specs grid */}
        <Card style={styles.specCard}>
          <View style={styles.specGrid}>
            <SpecCell icon="people-outline" label="Capacity" value={`${vehicle.capacity?.passengers || '—'} pax`} />
            <SpecCell icon="briefcase-outline" label="Luggage" value={`${vehicle.capacity?.luggage || '—'} bags`} />
            <SpecCell icon="speedometer-outline" label="Transmission" value={vehicle.transmission || '—'} />
            <SpecCell icon="flash-outline" label="Fuel" value={vehicle.fuelType || '—'} />
          </View>
        </Card>

        {vehicle.description ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>About this vehicle</Text>
            <Text style={styles.bodyText}>{vehicle.description}</Text>
          </Card>
        ) : null}

        {vehicle.features && vehicle.features.length > 0 ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featRow}>
              {vehicle.features.map((f, i) => (
                <Badge key={i} label={f} variant="default" size="sm" />
              ))}
            </View>
          </Card>
        ) : null}

        {vehicle.inclusions && vehicle.inclusions.length > 0 ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>What's included</Text>
            {vehicle.inclusions.map((inc, i) => (
              <View key={i} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.checkText}>{inc}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {vehicle.exclusions && vehicle.exclusions.length > 0 ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Not included</Text>
            {vehicle.exclusions.map((ex, i) => (
              <View key={i} style={styles.checkRow}>
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={styles.checkText}>{ex}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {vehicle.pricing?.deposit ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Security deposit</Text>
            <Text style={styles.bodyText}>
              ₹{vehicle.pricing.deposit.toLocaleString('en-IN')} refundable on return.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.cta}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceLabel}>Starting at</Text>
          <Text style={styles.priceValue}>{headlinePrice}</Text>
        </View>
        <Button
          title="Book now"
          onPress={() => {
            const path = `/transport/checkout/${encodeURIComponent(vehicle._id)}`;
            if (!requireAuth({ reason: 'Sign in to book this vehicle. Trip details and payment will be saved to your account.', redirectAfter: path })) return;
            router.push(path);
          }}
          variant="primary"
          size="lg"
          icon={<Ionicons name="car" size={18} color="#fff" />}
        />
      </View>
    </SafeAreaView>
  );
}

function SpecCell({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.specCell}>
      <Ionicons name={icon} size={20} color={colors.primary[500]} />
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  errorTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  fab: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 50,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  carousel: { width: SCREEN_W, height: 260, backgroundColor: colors.gray[200] },
  carouselImage: { width: SCREEN_W, height: 260 },
  dots: { position: 'absolute', bottom: spacing.md, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },

  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary },

  specCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  specGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  specCell: { alignItems: 'center', flex: 1, gap: 4 },
  specLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  specValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  section: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  bodyText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },

  featRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  checkText: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  priceValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[600] },
});
