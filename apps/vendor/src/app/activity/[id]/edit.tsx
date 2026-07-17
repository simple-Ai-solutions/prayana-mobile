import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, EmptyState, useTheme } from '@prayana/shared-ui';
import { LoadingSpinner } from '../../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { useBusinessStore } from '@prayana/shared-stores';
import ActivityForm, {
  ActivityFormValues,
  activityToFormValues,
} from '../_components/ActivityForm';

// ─── Inventory & Pricing nav card (rendered on the wizard's Review step) ─────────

const INVENTORY_LINKS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  path: (id: string) => string;
}[] = [
  {
    icon: 'layers-outline',
    label: 'Variants & pricing tiers',
    desc: 'Standard / VIP / Private with their own prices',
    path: (id) => `/activity/${id}/variants`,
  },
  {
    icon: 'time-outline',
    label: 'Time slots & availability',
    desc: 'Multiple batches per day with capacity limits',
    path: (id) => `/activity/${id}/time-slots`,
  },
  {
    icon: 'pricetags-outline',
    label: 'Pricing rules',
    desc: 'Bulk discounts, seasonal rates & date overrides',
    path: (id) => `/activity/${id}/pricing`,
  },
  {
    icon: 'help-circle-outline',
    label: 'Booking questions',
    desc: 'Info collected from guests at checkout',
    path: (id) => `/activity/${id}/questions`,
  },
  {
    icon: 'calendar-outline',
    label: 'Availability calendar',
    desc: 'Block dates and manage day-level availability',
    path: (id) => `/activity/${id}/availability`,
  },
];

function InventoryCard({ id }: { id: string }) {
  const router = useRouter();
  const { themeColors } = useTheme();
  return (
    <Card style={styles.formSection}>
      <View style={styles.sectionHeader}>
        <Ionicons name="layers-outline" size={20} color={colors.primary[500]} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Inventory & Pricing</Text>
      </View>
      {INVENTORY_LINKS.map((link, i) => (
        <React.Fragment key={link.label}>
          {i > 0 && <View style={[styles.manageDivider, { backgroundColor: themeColors.border }]} />}
          <TouchableOpacity
            style={styles.manageLink}
            onPress={() => router.push(link.path(id))}
            activeOpacity={0.7}
          >
            <Ionicons name={link.icon} size={20} color={colors.primary[500]} />
            <View style={styles.manageLinkBody}>
              <Text style={[styles.manageLinkLabel, { color: themeColors.text }]}>{link.label}</Text>
              <Text style={[styles.manageLinkDesc, { color: themeColors.textTertiary }]}>{link.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </Card>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────────

export default function EditActivityScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { removeListingFromStore } = useBusinessStore();

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [initialValues, setInitialValues] = useState<ActivityFormValues | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res: any = await activityMarketplaceAPI.getActivityById(id);
      const a = res?.data || res?.activity || res;
      if (a && (a._id || a.title || a.name)) {
        setInitialValues(activityToFormValues(a));
      } else {
        setLoadFailed(true);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load activity' });
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchActivity();
  }, [id, fetchActivity]);

  // Delete — Alert confirm → deleteListing → removeListingFromStore → back.
  const handleDelete = useCallback(({ allowLeave }: { allowLeave: () => void }) => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await activityMarketplaceAPI.deleteListing(id);
              removeListingFromStore(id);
              Toast.show({ type: 'success', text1: 'Activity deleted' });
              allowLeave(); // wizard back-interceptor must let this navigation through
              router.back();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to delete', text2: err?.message });
            }
          },
        },
      ],
    );
  }, [id, removeListingFromStore, router]);

  if (loading || !initialValues) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Edit Activity</Text>
          <View style={styles.headerSpacer} />
        </View>
        {loading ? (
          <LoadingSpinner fullScreen message="Loading activity..." />
        ) : (
          <EmptyState
            icon={<Ionicons name="alert-circle-outline" size={44} color={themeColors.textTertiary} />}
            title="Couldn't load this activity"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={fetchActivity}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <ActivityForm
      mode="edit"
      activityId={id}
      initialValues={initialValues}
      headerTitle="Edit Activity"
      onDelete={handleDelete}
      reviewExtra={<InventoryCard id={id} />}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 36 },

  formSection: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },

  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  manageLinkBody: { flex: 1 },
  manageLinkLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  manageLinkDesc: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  manageDivider: { height: 1, backgroundColor: colors.border },
});
