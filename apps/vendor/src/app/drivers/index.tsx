import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput as RNTextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { driverAPI } from '@prayana/shared-services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  _id: string;
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  photo?: string;
  photoUrl?: string;
  avatar?: string;
  languagesSpoken?: string[];
  experienceYears?: number;
  totalTrips?: number;
  rating?: { average?: number; count?: number };
  isAvailable?: boolean;
  backgroundCheckStatus?: string;
}

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi'];
const LICENSE_TYPE_OPTIONS = ['LMV', 'LMV-TR', 'MCWG', 'HMV', 'HGMV', 'Trans'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function driverPhoto(d: Driver): string | undefined {
  return d.photo || d.photoUrl || d.avatar;
}

function backgroundCheckVariant(status?: string): 'success' | 'warning' | 'error' | 'default' {
  const s = (status || '').toLowerCase();
  if (s === 'verified' || s === 'approved' || s === 'passed' || s === 'clear') return 'success';
  if (s === 'pending' || s === 'in_progress' || s === 'in-progress') return 'warning';
  if (s === 'failed' || s === 'rejected') return 'error';
  return 'default';
}

// ─── Driver Card ──────────────────────────────────────────────────────────────

function DriverCard({
  driver,
  onToggle,
  toggling,
}: {
  driver: Driver;
  onToggle: () => void;
  toggling: boolean;
}) {
  const { themeColors } = useTheme();
  const photo = driverPhoto(driver);
  const initials = (driver.name || 'D')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card style={styles.driverCard} padding="md">
      <View style={styles.driverHead}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary[100] }]}>
            <Text style={[styles.avatarInitials, { color: colors.primary[600] }]}>{initials}</Text>
          </View>
        )}

        <View style={styles.driverInfo}>
          <Text style={[styles.driverName, { color: themeColors.text }]} numberOfLines={1}>
            {driver.name || 'Driver'}
          </Text>
          {driver.phone ? (
            <View style={styles.metaLine}>
              <Ionicons name="call-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {driver.phone}
              </Text>
            </View>
          ) : null}
          {Array.isArray(driver.languagesSpoken) && driver.languagesSpoken.length ? (
            <View style={styles.metaLine}>
              <Ionicons name="language-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {driver.languagesSpoken.join(', ')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.availabilityWrap}>
          <Switch
            value={!!driver.isAvailable}
            onValueChange={onToggle}
            disabled={toggling}
            trackColor={{ false: colors.gray[300], true: colors.primary[300] }}
            thumbColor={driver.isAvailable ? colors.primary[500] : colors.gray[100]}
          />
          <Text style={[styles.availabilityLabel, { color: driver.isAvailable ? colors.success : themeColors.textTertiary }]}>
            {driver.isAvailable ? 'Available' : 'Off'}
          </Text>
        </View>
      </View>

      <View style={[styles.driverStats, { borderTopColor: themeColors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: themeColors.text }]}>{driver.experienceYears ?? 0}y</Text>
          <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Experience</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: themeColors.text }]}>{driver.totalTrips ?? 0}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Trips</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
        <View style={styles.statItem}>
          <View style={styles.ratingInline}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {(driver.rating?.average ?? 0).toFixed(1)}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Rating</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <Badge
          label={driver.isAvailable ? 'Available' : 'Unavailable'}
          variant={driver.isAvailable ? 'success' : 'default'}
          size="sm"
        />
        <Badge
          label={`Check: ${(driver.backgroundCheckStatus || 'pending').replace(/[_-]+/g, ' ')}`}
          variant={backgroundCheckVariant(driver.backgroundCheckStatus)}
          size="sm"
        />
      </View>
    </Card>
  );
}

// ─── Multi-select pills ───────────────────────────────────────────────────────

function MultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.chipContainer}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.chip,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              active && styles.chipSelected,
            ]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: themeColors.textSecondary }, active && styles.chipTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DriversScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Add-driver form
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState<string[]>([]);
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>(['English']);
  const [experienceYears, setExperienceYears] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await driverAPI.getDrivers();
      const data = res?.data ?? res;
      const list = data?.drivers || (Array.isArray(data) ? data : []);
      setDrivers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('[Drivers] fetch failed:', err?.message);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchDrivers();
    setLoading(false);
  }, [fetchDrivers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
  }, [fetchDrivers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAvailability = useCallback(
    async (driver: Driver) => {
      const id = driver._id || driver.id;
      if (!id) return;
      const next = !driver.isAvailable;
      setTogglingId(id);
      setDrivers((prev) =>
        prev.map((d) => ((d._id || d.id) === id ? { ...d, isAvailable: next } : d))
      );
      try {
        await driverAPI.toggleDriverAvailability(id, next);
        Toast.show({ type: 'success', text1: next ? 'Driver available' : 'Driver set offline' });
      } catch (err: any) {
        setDrivers((prev) =>
          prev.map((d) => ((d._id || d.id) === id ? { ...d, isAvailable: !next } : d))
        );
        Toast.show({ type: 'error', text1: 'Update failed', text2: err?.message });
      } finally {
        setTogglingId(null);
      }
    },
    []
  );

  const toggleLicenseType = useCallback((val: string) => {
    setLicenseType((prev) => (prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]));
  }, []);

  const toggleLanguage = useCallback((val: string) => {
    setLanguagesSpoken((prev) => (prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]));
  }, []);

  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
    setEmail('');
    setLicenseNumber('');
    setLicenseType([]);
    setLicenseExpiry('');
    setLanguagesSpoken(['English']);
    setExperienceYears('');
  }, []);

  const validate = (): string | null => {
    if (!name.trim()) return 'Driver name is required';
    if (!phone.trim()) return 'Phone number is required';
    if (!licenseNumber.trim()) return 'License number is required';
    if (licenseType.length === 0) return 'Select at least one license type';
    if (!licenseExpiry.trim()) return 'License expiry is required';
    return null;
  };

  const handleAddDriver = useCallback(async () => {
    const error = validate();
    if (error) {
      Toast.show({ type: 'error', text1: error });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        licenseNumber: licenseNumber.trim(),
        licenseType,
        licenseExpiry: licenseExpiry.trim(),
        languagesSpoken,
        experienceYears: Number(experienceYears) || 0,
      };

      const res = await driverAPI.addDriver(payload);
      const created = res?.data || res?.driver || res;

      if (created?._id || created?.id) {
        setDrivers((prev) => [created, ...prev]);
        Toast.show({ type: 'success', text1: 'Driver added' });
        resetForm();
        setFormOpen(false);
      } else {
        await fetchDrivers();
        Toast.show({ type: 'success', text1: 'Driver added' });
        resetForm();
        setFormOpen(false);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not add driver', text2: err?.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [
    name, phone, email, licenseNumber, licenseType, licenseExpiry,
    languagesSpoken, experienceYears, resetForm, fetchDrivers,
  ]);

  const labelStyle = [styles.label, { color: themeColors.textSecondary }];
  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Drivers</Text>
        <TouchableOpacity
          onPress={() => setFormOpen((v) => !v)}
          style={styles.headerAction}
        >
          <Ionicons name={formOpen ? 'close' : 'person-add-outline'} size={22} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {loading ? (
          <LoadingSpinner fullScreen message="Loading drivers..." />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
            }
          >
            {/* Add Driver form (collapsible) */}
            {formOpen ? (
              <Card style={styles.formCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-add-outline" size={20} color={colors.primary[500]} />
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Add Driver</Text>
                </View>

                <Text style={labelStyle}>Full Name *</Text>
                <RNTextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />

                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={labelStyle}>Phone *</Text>
                    <RNTextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="10-digit number"
                      placeholderTextColor={themeColors.textTertiary}
                      style={inputStyle}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={labelStyle}>Experience (yrs)</Text>
                    <RNTextInput
                      value={experienceYears}
                      onChangeText={setExperienceYears}
                      placeholder="e.g. 5"
                      placeholderTextColor={themeColors.textTertiary}
                      style={inputStyle}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={labelStyle}>Email</Text>
                <RNTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="driver@example.com"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={labelStyle}>License Number *</Text>
                    <RNTextInput
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      placeholder="e.g. KA0120200001234"
                      placeholderTextColor={themeColors.textTertiary}
                      style={inputStyle}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={labelStyle}>License Expiry *</Text>
                    <RNTextInput
                      value={licenseExpiry}
                      onChangeText={setLicenseExpiry}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={themeColors.textTertiary}
                      style={inputStyle}
                    />
                  </View>
                </View>

                <Text style={labelStyle}>License Type *</Text>
                <MultiSelect options={LICENSE_TYPE_OPTIONS} selected={licenseType} onToggle={toggleLicenseType} />

                <Text style={labelStyle}>Languages Spoken</Text>
                <MultiSelect options={LANGUAGE_OPTIONS} selected={languagesSpoken} onToggle={toggleLanguage} />

                <View style={styles.formActions}>
                  <Button
                    title="Cancel"
                    onPress={() => {
                      resetForm();
                      setFormOpen(false);
                    }}
                    variant="outline"
                    size="lg"
                    disabled={saving}
                    style={styles.formActionBtn}
                  />
                  <Button
                    title="Add Driver"
                    onPress={handleAddDriver}
                    size="lg"
                    loading={saving}
                    style={styles.formActionBtn}
                  />
                </View>
              </Card>
            ) : null}

            {/* Driver list */}
            {drivers.length === 0 ? (
              !formOpen ? (
                <View style={styles.emptyWrap}>
                  <EmptyState
                    icon={<Ionicons name="people-outline" size={56} color={colors.gray[300]} />}
                    title="No drivers yet"
                    description="Add drivers to assign them to chauffeur-driven transport bookings."
                    actionLabel="Add Driver"
                    onAction={() => setFormOpen(true)}
                  />
                </View>
              ) : null
            ) : (
              drivers.map((driver) => (
                <DriverCard
                  key={driver._id || driver.id}
                  driver={driver}
                  toggling={togglingId === (driver._id || driver.id)}
                  onToggle={() => toggleAvailability(driver)}
                />
              ))
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
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
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
  },
  emptyWrap: {
    paddingTop: spacing['3xl'],
  },

  // Form
  formCard: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  formActionBtn: {
    flex: 1,
  },

  // Driver card
  driverCard: {
    marginBottom: spacing.md,
  },
  driverHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  availabilityWrap: {
    alignItems: 'center',
    gap: 2,
  },
  availabilityLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  driverStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
