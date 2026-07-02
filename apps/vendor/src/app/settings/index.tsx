import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Card, TextInput } from '@prayana/shared-ui';
import { Button } from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
import { useAuth } from '@prayana/shared-hooks';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Constants ──────────────────────────────────────────────────────────────

// Mirrors the web PWA tab strip: Profile / Branding / Tax / Documents, plus a
// mobile-native "Account" tab for notification prefs + sign-out (the web
// Business Settings page has no equivalent; those live in the mobile shell).
const TABS = [
  { id: 'profile', label: 'Profile', icon: 'settings-outline' },
  { id: 'branding', label: 'Branding', icon: 'image-outline' },
  { id: 'tax', label: 'Tax', icon: 'receipt-outline' },
  { id: 'documents', label: 'Documents', icon: 'document-text-outline' },
  { id: 'account', label: 'Account', icon: 'person-outline' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  emailNewBooking: boolean;
  emailBookingConfirmed: boolean;
  emailDailySummary: boolean;
  smsNewBooking: boolean;
  pushNotifications: boolean;
}

interface ProfileForm {
  businessName: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  logo: string;
}

const isVerified = (s?: string) =>
  s === 'verified' || s === 'auto_verified' || s === 'manually_verified';

// ─── Small building blocks ──────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InfoCell({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

function VerifiedBadge() {
  return (
    <View style={styles.verifiedBadge}>
      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
      <Text style={styles.verifiedBadgeText}>Verified</Text>
    </View>
  );
}

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
      {rightElement ||
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        ) : null)}
    </TouchableOpacity>
  );
}

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
  const { businessAccount, setBusinessAccount, clearBusinessAccount } =
    useBusinessStore();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState<ProfileForm>({
    businessName: '',
    tagline: '',
    description: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    address: '',
    logo: '',
  });

  // Tax tab state
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [verifyingGstin, setVerifyingGstin] = useState(false);
  const [verifyingPan, setVerifyingPan] = useState(false);

  // Notification prefs (Account tab)
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailNewBooking: true,
    emailBookingConfirmed: true,
    emailDailySummary: false,
    smsNewBooking: false,
    pushNotifications: true,
  });

  // ── Hydrate from business account ──────────────────────────────────────────

  useEffect(() => {
    if (!businessAccount) return;
    setForm({
      businessName: businessAccount.businessName || businessAccount.name || '',
      tagline: businessAccount.tagline || '',
      description: businessAccount.description || '',
      email: businessAccount.contact?.email || '',
      phone: businessAccount.contact?.phone || '',
      city: businessAccount.location?.city || '',
      state: businessAccount.location?.state || '',
      address: businessAccount.location?.address || '',
      logo: businessAccount.logo || '',
    });
    setGstin(businessAccount.gstDetails?.gstin || '');
    setPan(businessAccount.panDetails?.panNumber || '');
    if (businessAccount.notificationPreferences) {
      setPrefs((p) => ({ ...p, ...businessAccount.notificationPreferences }));
    }
  }, [businessAccount]);

  // Auto-hide the "Saved" pill after 3s
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const update = (key: keyof ProfileForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const refreshBusiness = useCallback(async () => {
    try {
      const fresh = await businessAPI.getMyBusiness();
      if (fresh?.success && fresh.data) setBusinessAccount(fresh.data);
    } catch {
      /* non-fatal */
    }
  }, [setBusinessAccount]);

  // ── Save profile ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!form.businessName.trim()) {
      Toast.show({ type: 'error', text1: 'Business name is required' });
      return;
    }
    setSaving(true);
    try {
      const res = await businessAPI.updateMyBusiness({
        businessName: form.businessName,
        tagline: form.tagline,
        description: form.description,
        contact: { email: form.email, phone: form.phone },
        location: { city: form.city, state: form.state, address: form.address },
      });
      if (res?.success) {
        if (res.data) setBusinessAccount(res.data);
        setSavedAt(Date.now());
        Toast.show({ type: 'success', text1: 'Settings saved!' });
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to save' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  }, [form, setBusinessAccount]);

  // ── Logo upload ──────────────────────────────────────────────────────────────

  const handleLogoUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Photo permission required' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', {
        uri: asset.uri,
        name: asset.fileName || 'logo.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);

      const res = await businessAPI.uploadLogo(formData);
      if (res?.success) {
        const newLogo =
          res.logoUrl || res.data?.logoUrl || res.data?.logo || res.url;
        if (newLogo) setForm((f) => ({ ...f, logo: newLogo }));
        await refreshBusiness();
        Toast.show({ type: 'success', text1: 'Logo uploaded!' });
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Upload failed' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Upload failed' });
    } finally {
      setUploadingLogo(false);
    }
  }, [refreshBusiness]);

  // ── GSTIN / PAN verify ───────────────────────────────────────────────────────

  const handleVerifyGstin = useCallback(async () => {
    const value = gstin.trim().toUpperCase();
    if (value.length !== 15) {
      Toast.show({ type: 'error', text1: 'GSTIN must be 15 characters' });
      return;
    }
    setVerifyingGstin(true);
    try {
      const res = await businessAPI.verifyGSTIN(value);
      if (res?.success && (res.data?.valid ?? true)) {
        Toast.show({ type: 'success', text1: 'GSTIN verified!' });
        await refreshBusiness();
      } else {
        Toast.show({
          type: 'error',
          text1: res?.error || res?.message || 'Invalid GSTIN',
        });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to verify. Try again.' });
    } finally {
      setVerifyingGstin(false);
    }
  }, [gstin, refreshBusiness]);

  const handleVerifyPan = useCallback(async () => {
    const value = pan.trim().toUpperCase();
    if (value.length !== 10) {
      Toast.show({ type: 'error', text1: 'PAN must be 10 characters' });
      return;
    }
    setVerifyingPan(true);
    try {
      const res = await businessAPI.verifyPAN(value);
      if (res?.success) {
        Toast.show({ type: 'success', text1: 'PAN verified!' });
        await refreshBusiness();
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Invalid PAN' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to verify. Try again.' });
    } finally {
      setVerifyingPan(false);
    }
  }, [pan, refreshBusiness]);

  // ── Notification pref toggle ─────────────────────────────────────────────────

  const updatePref = useCallback(
    async (key: keyof NotificationPrefs, value: boolean) => {
      const prev = prefs;
      const newPrefs = { ...prefs, [key]: value };
      setPrefs(newPrefs);
      try {
        await businessAPI.updateMyBusiness({ notificationPreferences: newPrefs });
      } catch {
        setPrefs(prev);
        Toast.show({ type: 'error', text1: 'Failed to update preferences' });
      }
    },
    [prefs]
  );

  // ── Sign out ────────────────────────────────────────────────────────────────

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
          } catch {
            Toast.show({ type: 'error', text1: 'Failed to sign out' });
          }
        },
      },
    ]);
  }, [logout, clearBusinessAccount]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeIdx = TABS.findIndex((t) => t.id === activeTab);
  const gstinStatus = businessAccount?.gstDetails?.verificationStatus;
  const panStatus = businessAccount?.panDetails?.verificationStatus;
  const memberSince = businessAccount?.createdAt
    ? new Date(businessAccount.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      })
    : '—';

  // ── Render helpers for State picker (simple Alert-based select) ──────────────
  const pickState = () => {
    Alert.alert(
      'Select State',
      undefined,
      [
        ...INDIAN_STATES.map((s) => ({ text: s, onPress: () => update('state', s) })),
        { text: 'Cancel', style: 'cancel' as const },
      ].slice(0, 30)
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab strip + step indicator (mirrors PWA) */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabStrip}
        >
          {TABS.map((t, i) => {
            const active = t.id === activeTab;
            const done = i < activeIdx;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                style={[styles.tab, active && styles.tabActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : (t.icon as keyof typeof Ionicons.glyphMap)}
                  size={15}
                  color={active ? colors.surface : colors.primary[500]}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.stepIndicator}>
          Step {activeIdx + 1} of {TABS.length}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── PROFILE ───────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <Card style={styles.tabCard}>
            <SectionTitle>Business Profile</SectionTitle>
            <TextInput
              label="Business Name *"
              value={form.businessName}
              onChangeText={(v) => update('businessName', v)}
              placeholder="Your business or guide name"
            />
            <TextInput
              label="Tagline"
              value={form.tagline}
              onChangeText={(v) => update('tagline', v)}
              maxLength={80}
              placeholder="e.g., Expert heritage tours in Karnataka"
            />
            <TextInput
              label="About your business"
              value={form.description}
              onChangeText={(v) => update('description', v)}
              placeholder="Tell travelers about your experience, specialties, and what makes you unique..."
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />

            <View style={styles.sectionGap} />
            <SectionTitle>Contact</SectionTitle>
            <TextInput
              label="Email"
              value={form.email}
              onChangeText={(v) => update('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="contact@example.com"
            />
            <TextInput
              label="Phone"
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              keyboardType="phone-pad"
              placeholder="+91 XXXXX XXXXX"
            />

            <View style={styles.sectionGap} />
            <SectionTitle>Location</SectionTitle>
            <TextInput
              label="City"
              value={form.city}
              onChangeText={(v) => update('city', v)}
              placeholder="e.g., Hampi"
            />
            <Text style={styles.fieldLabel}>State</Text>
            <TouchableOpacity style={styles.selectInput} onPress={pickState}>
              <Text style={form.state ? styles.selectValue : styles.selectPlaceholder}>
                {form.state || 'Select state'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <TextInput
              label="Full address"
              value={form.address}
              onChangeText={(v) => update('address', v)}
              placeholder="Street address, landmarks, etc."
              multiline
              numberOfLines={2}
              style={styles.textArea}
            />

            <View style={styles.sectionGap} />
            <SectionTitle>Account information</SectionTitle>
            <View style={styles.infoGrid}>
              <InfoCell label="Account type" value={businessAccount?.accountType} />
              <InfoCell
                label="Status"
                value={businessAccount?.verificationStatus}
              />
              <InfoCell label="Member since" value={memberSince} />
              <InfoCell label="Slug" value={businessAccount?.slug} />
            </View>

            <View style={styles.saveRow}>
              {savedAt ? (
                <View style={styles.savedPill}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.savedPillText}>Saved</Text>
                </View>
              ) : (
                <View />
              )}
              <Button
                title="Save"
                onPress={handleSave}
                loading={saving}
                icon={<Ionicons name="checkmark" size={16} color={colors.surface} />}
              />
            </View>
          </Card>
        )}

        {/* ── BRANDING ──────────────────────────────────────────────── */}
        {activeTab === 'branding' && (
          <Card style={styles.tabCard}>
            <SectionTitle>Business Logo</SectionTitle>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {form.logo ? (
                  <Image source={{ uri: form.logo }} style={styles.logoImg} />
                ) : (
                  <Ionicons
                    name={
                      businessAccount?.accountType === 'company'
                        ? 'business-outline'
                        : 'person-outline'
                    }
                    size={32}
                    color={colors.textTertiary}
                  />
                )}
              </View>
              <View style={styles.logoActions}>
                <Button
                  title={
                    uploadingLogo
                      ? 'Uploading...'
                      : form.logo
                      ? 'Replace Logo'
                      : 'Upload Logo'
                  }
                  variant="outline"
                  size="sm"
                  loading={uploadingLogo}
                  onPress={handleLogoUpload}
                  icon={<Ionicons name="camera-outline" size={16} color={colors.primary[500]} />}
                />
                <Text style={styles.logoHint}>
                  Max 5MB. Square images work best. Auto-saved on upload.
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* ── TAX (GSTIN / PAN) ─────────────────────────────────────── */}
        {activeTab === 'tax' && (
          <>
            <Card style={styles.tabCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>GSTIN Verification</Text>
                {isVerified(gstinStatus) && <VerifiedBadge />}
              </View>
              <Text style={styles.cardHelp}>
                Verify your 15-character GSTIN. Optional for individuals/agents,
                required for company accounts.
              </Text>
              <TextInput
                value={gstin}
                onChangeText={(v) => setGstin(v.toUpperCase().slice(0, 15))}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                autoCapitalize="characters"
              />
              <Button
                title="Verify"
                onPress={handleVerifyGstin}
                loading={verifyingGstin}
                disabled={gstin.length !== 15}
                fullWidth
                icon={<Ionicons name="checkmark-circle-outline" size={16} color={colors.surface} />}
                style={styles.verifyBtn}
              />
            </Card>

            <Card style={styles.tabCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>PAN Verification</Text>
                {isVerified(panStatus) && <VerifiedBadge />}
              </View>
              <Text style={styles.cardHelp}>
                Verify your 10-character PAN. Required to receive payouts.
              </Text>
              <TextInput
                value={pan}
                onChangeText={(v) => setPan(v.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F"
                maxLength={10}
                autoCapitalize="characters"
              />
              <Button
                title="Verify"
                onPress={handleVerifyPan}
                loading={verifyingPan}
                disabled={pan.length !== 10}
                fullWidth
                icon={<Ionicons name="checkmark-circle-outline" size={16} color={colors.surface} />}
                style={styles.verifyBtn}
              />
            </Card>
          </>
        )}

        {/* ── DOCUMENTS ─────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <Card style={styles.tabCard}>
            <SectionTitle>Documents &amp; KYC</SectionTitle>
            <Text style={styles.cardHelp}>
              Upload and verify your business documents to unlock listings and
              payouts.
            </Text>
            <MenuItem
              icon="document-text-outline"
              label="Manage Documents & KYC"
              subtitle="Upload registration, ID proof, and business photos"
              onPress={() => router.push('/verification')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Quality Score"
              subtitle="View your seller quality metrics"
              onPress={() => router.push('/quality')}
            />
          </Card>
        )}

        {/* ── ACCOUNT (notifications + payouts + sign out) ──────────── */}
        {activeTab === 'account' && (
          <>
            <SectionTitle>Notifications</SectionTitle>
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

            <SectionTitle>Payments</SectionTitle>
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

            <SectionTitle>Account</SectionTitle>
            <Card padding="sm" style={styles.menuCard}>
              <MenuItem
                icon="help-circle-outline"
                label="Help & Support"
                onPress={() =>
                  Toast.show({ type: 'info', text1: 'Contact support@prayana.in' })
                }
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
          </>
        )}

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

  // Tab strip
  tabBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  tabStrip: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
  },
  tabActive: {
    backgroundColor: colors.primary[500],
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.surface,
  },
  stepIndicator: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },

  scrollContent: {
    padding: spacing.xl,
  },

  // Tab card
  tabCard: {
    marginBottom: spacing.md,
  },

  // Sections
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  sectionGap: {
    height: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },

  // Select (state picker)
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  selectValue: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  selectPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },

  // Account info grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoCell: {
    width: '46%',
    flexGrow: 1,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: 2,
    textTransform: 'capitalize',
  },

  // Save row
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  savedPillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoActions: {
    flex: 1,
    gap: spacing.xs,
  },
  logoHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Tax cards
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardHelp: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  verifiedBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  verifyBtn: {
    marginTop: spacing.sm,
  },

  // Menu (Documents + Account tabs)
  menuCard: {
    marginBottom: spacing.md,
  },
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
