import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  Card,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import {
  saveNotificationPreferences,
  saveFcmToken,
  deleteFcmToken,
} from '@prayana/shared-services';
import Toast from 'react-native-toast-message';

// ============================================================
// SETUP: Foreground notification display handler
// ============================================================
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================================
// TYPES
// ============================================================
interface NotificationPreferences {
  // Channels
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
  // Per-event
  bookingConfirmation: boolean;
  bookingReminder: boolean;
  bookingCancellation: boolean;
  paymentReceipts: boolean;
  reviewRequests: boolean;
  tripUpdates: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  push: true,
  email: true,
  whatsapp: false,
  sms: false,
  bookingConfirmation: true,
  bookingReminder: true,
  bookingCancellation: true,
  paymentReceipts: true,
  reviewRequests: true,
  tripUpdates: true,
  promotions: false,
};

type PermissionState = 'unknown' | 'granted' | 'denied' | 'undetermined';

// ============================================================
// HELPER: Register for push notifications and get token
// ============================================================
async function registerForPushNotifications(): Promise<string | null> {
  if (!Constants.isDevice) {
    // Simulator/emulator — tokens don't work but won't crash
    return null;
  }

  let status = await ExpoNotifications.getPermissionsAsync();

  if (status.status !== 'granted') {
    status = await ExpoNotifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
  }

  if (status.status !== 'granted') {
    return null;
  }

  // Get Expo push token for cloud messaging
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = projectId
      ? await ExpoNotifications.getExpoPushTokenAsync({ projectId })
      : await ExpoNotifications.getExpoPushTokenAsync();

    return tokenData.data;
  } catch {
    return null;
  }
}

// ============================================================
// TOGGLE ROW COMPONENT
// ============================================================
function ToggleRow({
  icon,
  iconColor,
  iconBg,
  label,
  description,
  value,
  onToggle,
  isLast,
  disabled,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  isLast?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  const { themeColors } = useTheme();

  return (
    <View
      style={[
        styles.toggleRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.toggleLeft}>
        <View style={[styles.toggleIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.toggleTextWrap}>
          <View style={styles.toggleLabelRow}>
            <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{label}</Text>
            {badge}
          </View>
          <Text style={[styles.toggleDesc, { color: themeColors.textSecondary }]}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#d4d4d4', true: colors.primary[400] }}
        thumbColor={value ? colors.primary[500] : '#f5f5f5'}
        ios_backgroundColor="#d4d4d4"
      />
    </View>
  );
}

// ============================================================
// SECTION HEADER
// ============================================================
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{subtitle}</Text>}
    </View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================
export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode, themeColors } = useTheme();

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [permState, setPermState] = useState<PermissionState>('unknown');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  const notificationListener = useRef<ExpoNotifications.EventSubscription | null>(null);
  const responseListener = useRef<ExpoNotifications.EventSubscription | null>(null);

  // ── Check current permission status on mount ──
  useEffect(() => {
    (async () => {
      const { status } = await ExpoNotifications.getPermissionsAsync();
      setPermState(status as PermissionState);

      // Android: create default channel
      if (Platform.OS === 'android') {
        await ExpoNotifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: ExpoNotifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: colors.primary[500],
        });
        await ExpoNotifications.setNotificationChannelAsync('trips', {
          name: 'Trip Reminders',
          importance: ExpoNotifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500],
          lightColor: '#8b5cf6',
        });
        await ExpoNotifications.setNotificationChannelAsync('bookings', {
          name: 'Booking Updates',
          importance: ExpoNotifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#059669',
        });
      }
    })();

    // Listener: notification received while app is in foreground
    notificationListener.current = ExpoNotifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        Toast.show({ type: 'info', text1: title || 'Notification', text2: body || '' });
      }
    );

    // Listener: user taps a notification
    responseListener.current = ExpoNotifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        if (data?.route) {
          router.push(data.route);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // ── Enable push notifications ──
  const handleEnablePush = useCallback(async () => {
    if (permState === 'denied') {
      Alert.alert(
        'Notifications Blocked',
        'Push notifications are blocked in your device settings. Please enable them manually.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    setTokenLoading(true);
    try {
      const token = await registerForPushNotifications();
      const { status } = await ExpoNotifications.getPermissionsAsync();
      setPermState(status as PermissionState);

      if (token) {
        setPushToken(token);
        const device = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        try {
          await saveFcmToken(token, device);
        } catch {
          // Backend token save failed — non-blocking
        }
        await handleToggle('push', true);
        Toast.show({ type: 'success', text1: 'Push notifications enabled!', text2: 'You\'ll now receive real-time alerts.' });
      } else if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Enable notifications in device settings.' });
      }
    } finally {
      setTokenLoading(false);
    }
  }, [permState]);

  // ── Disable push notifications ──
  const handleDisablePush = useCallback(async () => {
    if (pushToken) {
      try { await deleteFcmToken(pushToken); } catch {}
    }
    await handleToggle('push', false);
    Toast.show({ type: 'info', text1: 'Push notifications disabled', visibilityTime: 2000 });
  }, [pushToken]);

  // ── Save a single preference toggle ──
  const handleToggle = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);

      if (!user?.uid || user.uid === 'guest-user') {
        Toast.show({ type: 'error', text1: 'Sign in required', text2: 'Please sign in to save preferences.' });
        setPrefs((prev) => ({ ...prev, [key]: !value }));
        return;
      }

      setSaving(true);
      try {
        await saveNotificationPreferences(updated);
      } catch {
        setPrefs((prev) => ({ ...prev, [key]: !value }));
        Toast.show({ type: 'error', text1: 'Save failed', text2: 'Could not update preference.' });
      } finally {
        setSaving(false);
      }
    },
    [prefs, user]
  );

  // ── Push status badge ──
  const PushBadge = () => {
    if (permState === 'granted')
      return (
        <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
          <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
          <Text style={[styles.badgeText, { color: '#16a34a' }]}>Enabled</Text>
        </View>
      );
    if (permState === 'denied')
      return (
        <View style={[styles.badge, { backgroundColor: '#fef2f2' }]}>
          <Ionicons name="close-circle" size={11} color="#dc2626" />
          <Text style={[styles.badgeText, { color: '#dc2626' }]}>Blocked</Text>
        </View>
      );
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Notifications</Text>
        {saving ? (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Info Banner ── */}
        <View style={[styles.infoBanner, { backgroundColor: isDarkMode ? '#0d2424' : colors.primary[50], borderColor: colors.primary[200] }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary[500]} />
          <Text style={[styles.infoBannerText, { color: isDarkMode ? colors.primary[300] : colors.primary[700] }]}>
            Manage how Prayana reaches you. Changes are saved instantly.
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════
            SECTION 1: DELIVERY CHANNELS
        ════════════════════════════════════════════════ */}
        <SectionHeader
          title="Delivery Channels"
          subtitle="Choose how you receive notifications"
        />
        <Card style={[styles.card, { backgroundColor: themeColors.card }]}>
          {/* Push Notifications */}
          <View style={[styles.toggleRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border }]}>
            <View style={styles.toggleLeft}>
              <View style={[styles.toggleIcon, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="notifications" size={20} color="#f97316" />
              </View>
              <View style={styles.toggleTextWrap}>
                <View style={styles.toggleLabelRow}>
                  <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Push Notifications</Text>
                  <PushBadge />
                </View>
                <Text style={[styles.toggleDesc, { color: themeColors.textSecondary }]}>
                  Real-time alerts on your device
                </Text>
                {/* Permission action */}
                {permState !== 'granted' && (
                  <TouchableOpacity
                    onPress={handleEnablePush}
                    disabled={tokenLoading}
                    style={styles.permissionAction}
                    activeOpacity={0.7}
                  >
                    {tokenLoading ? (
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                    ) : (
                      <>
                        <Ionicons
                          name={permState === 'denied' ? 'settings-outline' : 'finger-print-outline'}
                          size={13}
                          color={colors.primary[500]}
                        />
                        <Text style={styles.permissionActionText}>
                          {permState === 'denied' ? 'Open device settings to enable' : 'Tap to enable push notifications'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Switch
              value={prefs.push && permState === 'granted'}
              onValueChange={(val) => {
                if (val) handleEnablePush();
                else handleDisablePush();
              }}
              trackColor={{ false: '#d4d4d4', true: colors.primary[400] }}
              thumbColor={prefs.push && permState === 'granted' ? colors.primary[500] : '#f5f5f5'}
              ios_backgroundColor="#d4d4d4"
            />
          </View>

          {/* Email */}
          <ToggleRow
            icon="mail-outline"
            iconColor="#3b82f6"
            iconBg="#eff6ff"
            label="Email Notifications"
            description="Booking confirmations, reminders & receipts"
            value={prefs.email}
            onToggle={(val) => handleToggle('email', val)}
          />

          {/* WhatsApp */}
          <ToggleRow
            icon="logo-whatsapp"
            iconColor="#22c55e"
            iconBg="#f0fdf4"
            label="WhatsApp"
            description="Booking updates via WhatsApp messages"
            value={prefs.whatsapp}
            onToggle={(val) => handleToggle('whatsapp', val)}
          />

          {/* SMS */}
          <ToggleRow
            icon="phone-portrait-outline"
            iconColor="#8b5cf6"
            iconBg="#f3f0ff"
            label="SMS"
            description="Text messages for urgent booking updates"
            value={prefs.sms}
            onToggle={(val) => handleToggle('sms', val)}
            isLast
          />
        </Card>

        {/* ═══════════════════════════════════════════════
            SECTION 2: TRIP & BOOKING EVENTS
        ════════════════════════════════════════════════ */}
        <SectionHeader
          title="Trip & Booking"
          subtitle="Critical updates — always sent via email"
        />
        <Card style={[styles.card, { backgroundColor: themeColors.card }]}>
          <ToggleRow
            icon="checkmark-circle-outline"
            iconColor="#059669"
            iconBg="#ecfdf5"
            label="Booking Confirmations"
            description="When your booking is confirmed by the business"
            value={prefs.bookingConfirmation}
            onToggle={(val) => handleToggle('bookingConfirmation', val)}
          />
          <ToggleRow
            icon="alarm-outline"
            iconColor="#8b5cf6"
            iconBg="#f3f0ff"
            label="Booking Reminders"
            description="24 hours before your activity starts"
            value={prefs.bookingReminder}
            onToggle={(val) => handleToggle('bookingReminder', val)}
          />
          <ToggleRow
            icon="close-circle-outline"
            iconColor="#ef4444"
            iconBg="#fef2f2"
            label="Cancellations & Refunds"
            description="When a booking is cancelled or refunded"
            value={prefs.bookingCancellation}
            onToggle={(val) => handleToggle('bookingCancellation', val)}
          />
          <ToggleRow
            icon="receipt-outline"
            iconColor="#0ea5e9"
            iconBg="#f0f9ff"
            label="Payment Receipts"
            description="Payment confirmation and invoice details"
            value={prefs.paymentReceipts}
            onToggle={(val) => handleToggle('paymentReceipts', val)}
            isLast
          />
        </Card>

        {/* ═══════════════════════════════════════════════
            SECTION 3: ACTIVITIES & SOCIAL
        ════════════════════════════════════════════════ */}
        <SectionHeader title="Activities & Social" />
        <Card style={[styles.card, { backgroundColor: themeColors.card }]}>
          <ToggleRow
            icon="star-outline"
            iconColor="#f59e0b"
            iconBg="#fffbeb"
            label="Review Requests"
            description="Reminders to review after your activity"
            value={prefs.reviewRequests}
            onToggle={(val) => handleToggle('reviewRequests', val)}
          />
          <ToggleRow
            icon="people-outline"
            iconColor="#6366f1"
            iconBg="#eef2ff"
            label="Trip Collaboration"
            description="When someone edits or comments on your shared trip"
            value={prefs.tripUpdates}
            onToggle={(val) => handleToggle('tripUpdates', val)}
          />
          <ToggleRow
            icon="megaphone-outline"
            iconColor="#f97316"
            iconBg="#fff7ed"
            label="Deals & Promotions"
            description="Special offers, discounts, and new activities"
            value={prefs.promotions}
            onToggle={(val) => handleToggle('promotions', val)}
            isLast
          />
        </Card>

        {/* ── Test push notification (dev helper) ── */}
        {permState === 'granted' && (
          <View style={styles.testSection}>
            <TouchableOpacity
              style={[styles.testBtn, { borderColor: themeColors.border }]}
              onPress={async () => {
                await ExpoNotifications.scheduleNotificationAsync({
                  content: {
                    title: '🌏 Prayana Test',
                    body: 'Push notifications are working perfectly!',
                    data: {},
                  },
                  trigger: { type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
                });
                Toast.show({ type: 'success', text1: 'Test sent!', text2: 'You\'ll see it in ~1 second.', visibilityTime: 2000 });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="paper-plane-outline" size={16} color={colors.primary[500]} />
              <Text style={[styles.testBtnText, { color: colors.primary[500] }]}>Send Test Notification</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Footer note ── */}
        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={themeColors.textTertiary} />
          <Text style={[styles.footerNoteText, { color: themeColors.textTertiary }]}>
            Critical notifications (booking confirmations, payment receipts) will always be sent via email regardless of your settings. You can unsubscribe from promotional emails at any time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },

  content: { paddingBottom: 48 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  infoBannerText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },

  sectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  card: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: spacing.md,
  },
  toggleIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  toggleTextWrap: { marginLeft: spacing.md, flex: 1 },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  toggleLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  toggleDesc: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 17,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10, fontWeight: '600' as any },

  permissionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  permissionActionText: {
    fontSize: 12,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },

  testSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  testBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  footerNoteText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});
