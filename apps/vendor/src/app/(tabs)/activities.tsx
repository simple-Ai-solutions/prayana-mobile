import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
import {
  activityMarketplaceAPI,
  packageAPI,
  vehicleAPI,
} from '@prayana/shared-services';

// ─── Listing types ──────────────────────────────────────────────────────────────
// The Listings tab is a chooser: the vendor picks which kind of inventory to
// manage, then proceeds into that type's own screen. Order/labels mirror the
// More menu's Listings section.

type ListingKey = 'activities' | 'packages' | 'transport';

interface ListingType {
  key: ListingKey;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  route: string;
}

const LISTING_TYPES: ListingType[] = [
  {
    key: 'activities',
    icon: 'ticket-outline',
    label: 'Activities',
    subtitle: 'Tours & experiences you host',
    route: '/activity',
  },
  {
    key: 'packages',
    icon: 'cube-outline',
    label: 'Holiday Packages',
    subtitle: 'Multi-day packages & departures',
    route: '/packages',
  },
  {
    key: 'transport',
    icon: 'car-outline',
    label: 'Transport',
    subtitle: 'Vehicle rentals & drivers',
    route: '/transport',
  },
];

const ICON_COLOR = colors.primary[700];
const ICON_TILE_GRADIENT = [colors.primary[50], colors.primary[100]] as const;

// Normalise the various list-response shapes the three APIs return into a count.
function countOf(res: any): number | null {
  if (res == null) return null;
  const list = Array.isArray(res)
    ? res
    : res.data || res.listings || res.activities || res.packages || res.vehicles || [];
  return Array.isArray(list) ? list.length : null;
}

// ─── Type Card ──────────────────────────────────────────────────────────────────

function ListingTypeCard({
  type,
  count,
  onPress,
}: {
  type: ListingType;
  count: number | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={styles.typeCard}>
        <LinearGradient
          colors={ICON_TILE_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.typeIcon}
        >
          <Ionicons name={type.icon} size={24} color={ICON_COLOR} />
        </LinearGradient>
        <View style={styles.typeContent}>
          <Text style={styles.typeLabel}>{type.label}</Text>
          <Text style={styles.typeSubtitle}>{type.subtitle}</Text>
        </View>
        {count != null && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.primary[500]} />
      </Card>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ListingsScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<ListingKey, number | null>>({
    activities: null,
    packages: null,
    transport: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadCounts = useCallback(async () => {
    const [a, p, t] = await Promise.all([
      activityMarketplaceAPI.getMyListings().catch(() => null),
      packageAPI.getMyPackages().catch(() => null),
      vehicleAPI.getMyVehicleListings().catch(() => null),
    ]);
    setCounts({
      activities: countOf(a),
      packages: countOf(p),
      transport: countOf(t),
    });
  }, []);

  // Refresh whenever the tab regains focus, so counts reflect edits made after
  // navigating into a type and coming back.
  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCounts();
    setRefreshing(false);
  }, [loadCounts]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Listings</Text>
          <Text style={styles.subtitle}>Choose what you'd like to manage.</Text>
        </View>

        {LISTING_TYPES.map((type) => (
          <ListingTypeCard
            key={type.key}
            type={type}
            count={counts[type.key]}
            onPress={() => router.push(type.route as any)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Type card
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    // Blue-tinted lift, matching the More menu tiles.
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  typeContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  typeSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  countPill: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[700],
  },
});
