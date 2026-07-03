import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  Avatar,
  Button,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  emailNewBooking: boolean;
  emailBookingConfirmed: boolean;
  emailDailySummary: boolean;
  smsNewBooking: boolean;
  pushNotifications: boolean;
}

// ─── Menu Item ────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  rightElement,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightElement}
    >
      <Ionicons
        name={icon}
        size={22}
        color={danger ? colors.error : colors.primary[500]}
      />
      <View style={styles.menuItemContent}>
        <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>
          {label}
        </Text>
        {subtitle && <Text style={styles.menuItemSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

// ─── Toggle Item ──────────────────────────────────────────────────────────────

function ToggleItem({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}) {
  return (
    <MenuItem
      icon={icon}
      label={label}
      rightElement={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
          thumbColor={value ? colors.primary[500] : colors.gray[400]}
        />
      }
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { businessAccount, clearBusinessAccount } = useBusinessStore();

  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailNewBooking: true,
    emailBookingConfirmed: true,
    emailDailySummary: false,
    smsNewBooking: false,
    pushNotifications: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const businessName = businessAccount?.businessName || businessAccount?.name || 'Business';
  const email = businessAccount?.contact?.email || user?.email || '';

  // ── Update Pref ──────────────────────────────────────────────────────────

  const updatePref = useCallback(
    async (key: keyof NotificationPrefs, value: boolean) => {
      const newPrefs = { ...prefs, [key]: value };
      setPrefs(newPrefs);

      try {
        await businessAPI.updateMyBusiness({
          notificationPreferences: newPrefs,
        });
      } catch (err) {
        // Revert on failure
        setPrefs(prefs);
        Toast.show({ type: 'error', text1: 'Failed to update preferences' });
      }
    },
    [prefs]
  );

  // ── Sign Out ─────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            clearBusinessAccount();
            await logout();
          } catch (err) {
            Toast.show({ type: 'error', text1: 'Failed to sign out' });
          }
        },
      },
    ]);
  }, [logout, clearBusinessAccount]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Business Profile */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar
              name={businessName}
              uri={businessAccount?.logo}
              size={56}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{businessName}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
              {businessAccount?.status && (
                <View
                  style={[
                    styles.profileStatusBadge,
                    {
                      backgroundColor:
                        businessAccount.status === 'approved'
                          ? colors.successLight
                          : colors.warningLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.profileStatusText,
                      {
                        color:
                          businessAccount.status === 'approved'
                            ? colors.success
                            : colors.warning,
                      },
                    ]}
                  >
                    {businessAccount.status === 'approved' ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Business Section */}
        <Text style={styles.sectionTitle}>Business</Text>
        <Card padding="sm" style={styles.menuCard}>
          <MenuItem
            icon="storefront-outline"
            label="Business Profile"
            subtitle="Edit name, description, logo"
            onPress={() => router.push('/onboarding')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="document-text-outline"
            label="Documents & KYC"
            subtitle="Verify your business documents"
            onPress={() => router.push('/onboarding')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Quality Score"
            subtitle="View your seller quality metrics"
            onPress={() => router.push('/quality')}
          />
        </Card>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Card padding="sm" style={styles.menuCard}>
          <ToggleItem
            icon="notifications-outline"
            label="Push Notifications"
            value={prefs.pushNotifications}
            onValueChange={(v) => updatePref('pushNotifications', v)}
          />
          <View style={styles.menuDivider} />
          <ToggleItem
            icon="mail-outline"
            label="Email: New Booking"
            value={prefs.emailNewBooking}
            onValueChange={(v) => updatePref('emailNewBooking', v)}
          />
          <View style={styles.menuDivider} />
          <ToggleItem
            icon="mail-outline"
            label="Email: Booking Confirmed"
            value={prefs.emailBookingConfirmed}
            onValueChange={(v) => updatePref('emailBookingConfirmed', v)}
          />
          <View style={styles.menuDivider} />
          <ToggleItem
            icon="newspaper-outline"
            label="Email: Daily Summary"
            value={prefs.emailDailySummary}
            onValueChange={(v) => updatePref('emailDailySummary', v)}
          />
          <View style={styles.menuDivider} />
          <ToggleItem
            icon="chatbox-outline"
            label="SMS: New Booking"
            value={prefs.smsNewBooking}
            onValueChange={(v) => updatePref('smsNewBooking', v)}
          />
        </Card>

        {/* Payout */}
        <Text style={styles.sectionTitle}>Payments</Text>
        <Card padding="sm" style={styles.menuCard}>
          <MenuItem
            icon="wallet-outline"
            label="Earnings & Payouts"
            subtitle="View balance, request payouts"
            onPress={() => router.push('/earnings')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="card-outline"
            label="Bank Account"
            subtitle="Manage payout bank details"
            onPress={() => router.push('/earnings')}
          />
        </Card>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <Card padding="sm" style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => {
              Toast.show({ type: 'info', text1: 'Contact support@prayana.in' });
            }}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="information-circle-outline"
            label="About Prayana Business"
            subtitle="Version 1.0.0"
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            danger
          />
        </Card>

        <View style={styles.bottomSpacer} />
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
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: spacing.xl,
  },

  // Profile Card
  profileCard: {
    marginBottom: spacing.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  profileStatusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // Sections
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  menuCard: {
    marginBottom: spacing.md,
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  menuItemLabelDanger: {
    color: colors.error,
  },
  menuItemSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 22 + spacing.md,
  },

  bottomSpacer: {
    height: spacing['5xl'],
  },
});
