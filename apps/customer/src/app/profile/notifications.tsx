import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  colors,
  spacing,
  fontSize,
  fontWeight,
  useTheme,
} from '@prayana/shared-ui';
import {
  fetchUserProfile,
  saveNotificationPreferences,
} from '@prayana/shared-services';

type Channels = {
  push: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
};

type Categories = {
  bookings: boolean;
  trips: boolean;
  collaboration: boolean;
  promotions: boolean;
  reviews: boolean;
  product_updates: boolean;
};

const CHANNEL_META: { key: keyof Channels; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { key: 'push', label: 'Push notifications', icon: 'notifications-outline', description: 'Real-time alerts on this device.' },
  { key: 'email', label: 'Email', icon: 'mail-outline', description: 'Receipts, itineraries, and travel updates.' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', description: 'Booking confirmations and trip nudges.' },
  { key: 'sms', label: 'SMS', icon: 'chatbox-outline', description: 'Critical alerts only (OTPs, ride driver details).' },
];

const CATEGORY_META: { key: keyof Categories; label: string; description: string }[] = [
  { key: 'bookings', label: 'Bookings', description: 'Confirmations, payment receipts, refunds.' },
  { key: 'trips', label: 'Trip reminders', description: 'Day-before checklists, weather, time-to-leave.' },
  { key: 'collaboration', label: 'Trip collaboration', description: 'Comments, edits, chat from co-travellers.' },
  { key: 'reviews', label: 'Review requests', description: 'A nudge after each completed activity.' },
  { key: 'promotions', label: 'Promotions', description: 'Deals, coupons, and seasonal offers.' },
  { key: 'product_updates', label: 'Product updates', description: 'New features, app announcements.' },
];

const DEFAULTS: { channels: Channels; categories: Categories } = {
  channels: { push: true, email: true, sms: true, whatsapp: true },
  categories: {
    bookings: true,
    trips: true,
    collaboration: true,
    reviews: true,
    promotions: false,
    product_updates: false,
  },
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const [channels, setChannels] = useState<Channels>(DEFAULTS.channels);
  const [categories, setCategories] = useState<Categories>(DEFAULTS.categories);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = useCallback(async () => {
    try {
      const res: any = await fetchUserProfile();
      const prefs = res?.data?.preferences?.notifications || res?.user?.preferences?.notifications || {};
      setChannels({
        push: prefs.push !== false,
        email: prefs.email !== false,
        sms: prefs.sms !== false,
        whatsapp: prefs.whatsapp !== false,
      });
      setCategories({
        bookings: prefs.bookings !== false,
        trips: prefs.trips !== false,
        collaboration: prefs.collaboration !== false,
        reviews: prefs.reviews !== false,
        promotions: !!prefs.promotions,
        product_updates: !!prefs.product_updates,
      });
    } catch (err: any) {
      console.warn('[Notifications] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  // Debounced save: any toggle persists immediately so users never wonder if it stuck.
  const persist = useCallback(async (next: { channels: Channels; categories: Categories }) => {
    setSaving(true);
    try {
      await saveNotificationPreferences({ ...next.channels, ...next.categories });
      Haptics.selectionAsync();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: err?.message });
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleChannel = (key: keyof Channels, value: boolean) => {
    const next = { ...channels, [key]: value };
    setChannels(next);
    persist({ channels: next, categories });
  };

  const toggleCategory = (key: keyof Categories, value: boolean) => {
    const next = { ...categories, [key]: value };
    setCategories(next);
    persist({ channels, categories: next });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Notifications</Text>
        {saving ? (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : (
          <>
            <Card style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Channels</Text>
              {CHANNEL_META.map((c, idx) => (
                <View key={c.key}>
                  <View style={styles.row}>
                    <View style={styles.iconBubble}>
                      <Ionicons name={c.icon} size={18} color={colors.primary[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: themeColors.text }]}>{c.label}</Text>
                      <Text style={[styles.rowDesc, { color: themeColors.textTertiary }]}>{c.description}</Text>
                    </View>
                    <Switch
                      value={channels[c.key]}
                      onValueChange={(v) => toggleChannel(c.key, v)}
                      trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                      thumbColor={channels[c.key] ? colors.primary[600] : colors.gray[100]}
                    />
                  </View>
                  {idx < CHANNEL_META.length - 1 ? <View style={[styles.divider, { backgroundColor: themeColors.border }]} /> : null}
                </View>
              ))}
            </Card>

            <Card style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Topics</Text>
              {CATEGORY_META.map((c, idx) => (
                <View key={c.key}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: themeColors.text }]}>{c.label}</Text>
                      <Text style={[styles.rowDesc, { color: themeColors.textTertiary }]}>{c.description}</Text>
                    </View>
                    <Switch
                      value={categories[c.key]}
                      onValueChange={(v) => toggleCategory(c.key, v)}
                      trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                      thumbColor={categories[c.key] ? colors.primary[600] : colors.gray[100]}
                    />
                  </View>
                  {idx < CATEGORY_META.length - 1 ? <View style={[styles.divider, { backgroundColor: themeColors.border }]} /> : null}
                </View>
              ))}
            </Card>

            <Text style={[styles.footnote, { color: themeColors.textTertiary }]}>
              You'll always receive critical security messages (OTP, login alerts) regardless of these settings.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { padding: spacing.xl, alignItems: 'center' },
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

  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },

  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  rowDesc: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  footnote: {
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
