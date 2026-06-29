import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  StatusBadge,
  EmptyState,
  LoadingSpinner,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { packageAPI } from '@prayana/shared-services';

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageItem = {
  _id: string;
  title?: string;
  primaryDestination?: string;
  category?: string | string[];
  status?: string;
  packageType?: string;
  duration?: { nights?: number; days?: number };
  variants?: Array<{ pricing?: { basePrice?: number } }>;
  stats?: { totalBookings?: number; views?: number };
  destinations?: Array<{ name?: string; city?: string }>;
};

type Dashboard = {
  totalPackages?: number;
  statusBreakdown?: Record<string, number>;
  recentBookings?: number;
};

type StatusFilter = 'all' | 'active' | 'pending' | 'draft' | 'archived';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'draft', label: 'Draft' },
  { key: 'archived', label: 'Archived' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rupee(n?: number) {
  if (n == null || isNaN(n)) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function categoryLabel(cat?: string | string[]) {
  if (!cat) return '';
  if (Array.isArray(cat)) return cat.slice(0, 2).join(' · ');
  return cat;
}

function destinationLabel(pkg: PackageItem) {
  if (pkg.primaryDestination) return pkg.primaryDestination;
  const first = pkg.destinations?.[0];
  return first?.name || first?.city || 'No destination';
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PackagesScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [listRes, dashRes] = await Promise.all([
        packageAPI.getMyPackages(),
        packageAPI.getVendorPackageDashboard().catch(() => null),
      ]);
      const list: PackageItem[] =
        listRes?.data?.packages ?? listRes?.packages ?? listRes?.data ?? listRes ?? [];
      setPackages(Array.isArray(list) ? list : []);
      const dash = dashRes?.data ?? dashRes;
      setDashboard(dash || null);
    } catch (err: any) {
      console.warn('[Packages] fetch failed:', err?.message);
      Toast.show({ type: 'error', text1: 'Failed to load packages', text2: err?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh when returning from create/edit screens.
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let list = packages;
    if (filter !== 'all') {
      list = list.filter((p) => {
        const status = (p.status || '').toLowerCase();
        if (filter === 'active') return status === 'active' || status === 'approved' || status === 'published';
        if (filter === 'pending') return status === 'pending' || status === 'pending_approval' || status === 'review' || status === 'submitted';
        if (filter === 'draft') return status === 'draft';
        if (filter === 'archived') return status === 'archived' || status === 'inactive';
        return true;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          destinationLabel(p).toLowerCase().includes(q),
      );
    }
    return list;
  }, [packages, filter, search]);

  const handleDelete = useCallback(
    (pkg: PackageItem) => {
      Alert.alert(
        'Delete package',
        `Are you sure you want to delete "${pkg.title || 'this package'}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await packageAPI.deletePackage(pkg._id);
                setPackages((prev) => prev.filter((p) => p._id !== pkg._id));
                Toast.show({ type: 'success', text1: 'Package deleted' });
              } catch (err: any) {
                Toast.show({ type: 'error', text1: 'Delete failed', text2: err?.message });
              }
            },
          },
        ],
      );
    },
    [],
  );

  const handleToggleStatus = useCallback(async (pkg: PackageItem) => {
    const current = (pkg.status || '').toLowerCase();
    const isLive = current === 'active' || current === 'approved' || current === 'published';
    const next = isLive ? 'inactive' : 'active';
    try {
      const res = await packageAPI.toggleStatus(pkg._id, next);
      const updated = res?.data ?? res;
      const newStatus = updated?.status || next;
      setPackages((prev) =>
        prev.map((p) => (p._id === pkg._id ? { ...p, status: newStatus } : p)),
      );
      Toast.show({
        type: 'success',
        text1: isLive ? 'Package paused' : 'Package activated',
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Status update failed', text2: err?.message });
    }
  }, []);

  const renderHeader = () => (
    <View>
      {/* Dashboard stats */}
      {dashboard ? (
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {dashboard.totalPackages ?? packages.length}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Total</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary[600] }]}>
              {dashboard.statusBreakdown?.active ?? dashboard.statusBreakdown?.approved ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Active</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {dashboard.recentBookings ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Bookings</Text>
          </Card>
        </View>
      ) : null}

      {/* Search */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={themeColors.textTertiary} />
        <RNTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search packages..."
          placeholderTextColor={themeColors.textTertiary}
          style={[styles.searchInput, { color: themeColors.text }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                active && styles.filterChipActive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: themeColors.textSecondary },
                  active && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: PackageItem }) => {
    const status = (item.status || 'draft').toLowerCase();
    const isLive = status === 'active' || status === 'approved' || status === 'published';
    const basePrice = item.variants?.[0]?.pricing?.basePrice;
    const nights = item.duration?.nights;

    return (
      <Card style={styles.packageCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/packages/${item._id}`)}
        >
          <View style={styles.cardTop}>
            <View style={styles.cardTitleWrap}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>
                {item.title || 'Untitled package'}
              </Text>
              <View style={styles.cardMetaRow}>
                <Ionicons name="location-outline" size={13} color={themeColors.textSecondary} />
                <Text style={[styles.cardMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {destinationLabel(item)}
                </Text>
              </View>
            </View>
            <StatusBadge status={item.status || 'draft'} />
          </View>

          <View style={styles.cardTagsRow}>
            {!!categoryLabel(item.category) && (
              <View style={[styles.tag, { backgroundColor: themeColors.inputBackground }]}>
                <Text style={[styles.tagText, { color: themeColors.textSecondary }]}>
                  {categoryLabel(item.category)}
                </Text>
              </View>
            )}
            {nights != null && (
              <View style={[styles.tag, { backgroundColor: themeColors.inputBackground }]}>
                <Text style={[styles.tagText, { color: themeColors.textSecondary }]}>
                  {nights}N / {nights + 1}D
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.cardStatsRow, { borderTopColor: themeColors.border }]}>
            <View style={styles.cardStat}>
              <Text style={[styles.cardStatValue, { color: themeColors.text }]}>{rupee(basePrice)}</Text>
              <Text style={[styles.cardStatLabel, { color: themeColors.textTertiary }]}>From</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={[styles.cardStatValue, { color: themeColors.text }]}>
                {item.stats?.totalBookings ?? 0}
              </Text>
              <Text style={[styles.cardStatLabel, { color: themeColors.textTertiary }]}>Bookings</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={[styles.cardStatValue, { color: themeColors.text }]}>
                {item.stats?.views ?? 0}
              </Text>
              <Text style={[styles.cardStatLabel, { color: themeColors.textTertiary }]}>Views</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        <View style={[styles.cardActions, { borderTopColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => router.push(`/packages/${item._id}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary[500]} />
            <Text style={[styles.cardActionText, { color: colors.primary[600] }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => handleToggleStatus(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLive ? 'pause-circle-outline' : 'play-circle-outline'}
              size={18}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.cardActionText, { color: themeColors.textSecondary }]}>
              {isLive ? 'Pause' : 'Activate'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.cardActionText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Packages</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <LoadingSpinner message="Loading packages..." />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<Ionicons name="cube-outline" size={56} color={colors.gray[300]} />}
                title={search || filter !== 'all' ? 'No matching packages' : 'No packages yet'}
                description={
                  search || filter !== 'all'
                    ? 'Try a different search or filter.'
                    : 'Create your first holiday package to start selling.'
                }
              />
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/packages/new')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

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

  listContent: { padding: spacing.lg, paddingBottom: spacing['3xl'] + 60 },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: 2 },

  // Filters
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  filterText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },

  // Cards
  packageCard: { marginBottom: spacing.md, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardMeta: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },

  cardTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  tagText: { fontSize: fontSize.xs, color: colors.textSecondary },

  cardStatsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  cardStatLabel: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },

  cardActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  cardActionText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  emptyWrap: { paddingTop: spacing['3xl'] },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
