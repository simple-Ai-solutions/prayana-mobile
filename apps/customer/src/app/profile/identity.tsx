// Identity Vault — passport, PAN, driving licence (manual/scan); Aadhaar via DigiLocker.
//
// Rewritten to the REAL server contract (routes/userIdentity.js):
//   • GET /users/me/identity → { data: { passport, aadhaar, pan, drivingLicence, kycTier, ... } }
//     each doc masked as { numberLast4, status, fullName?, expiryDate?, ... } (NOT a documents[] list).
//   • Writes go through PATCH /users/me/identity WITH a consent block that
//     identityAPI fetches from /consent-text — the old plain POST /:type had no
//     route and no consent, so every save 404'd and the vault always showed empty.
//   • Aadhaar is DigiLocker-only (no manual number entry).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Badge,
  TextInput,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { identityAPI } from '@prayana/shared-services';

// Server-supported doc types (SUPPORTED_DOC_TYPES + aadhaar via DigiLocker).
type DocType = 'passport' | 'aadhaar' | 'pan' | 'drivingLicence';

// The masked per-doc shape the server returns (sectionForDisplay / identityForDisplay).
interface DocSection {
  numberLast4?: string | null;
  status?: 'verified' | 'pending' | 'expired' | 'unverified' | string | null;
  fullName?: string | null;
  nameOnPan?: string | null;
  nameOnAadhaar?: string | null;
  expiryDate?: string | null;
  validUntil?: string | null;
  updatedAt?: string | null;
}

interface IdentityData {
  passport?: DocSection | null;
  aadhaar?: DocSection | null;
  pan?: DocSection | null;
  drivingLicence?: DocSection | null;
  kycTier?: string;
  kycCompletionPercent?: number;
}

const DOC_META: Record<
  DocType,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
    placeholder: string;
    digilockerOnly?: boolean;
    hasExpiry?: boolean;
  }
> = {
  passport: {
    label: 'Passport',
    icon: 'airplane-outline',
    description: 'Used for international travel + eSIM activation.',
    placeholder: 'A12345678',
    hasExpiry: true,
  },
  aadhaar: {
    label: 'Aadhaar',
    icon: 'finger-print-outline',
    description: 'Linked securely via DigiLocker — no manual entry.',
    placeholder: '',
    digilockerOnly: true,
  },
  pan: {
    label: 'PAN',
    icon: 'card-outline',
    description: 'Used for tax invoices on high-value bookings.',
    placeholder: 'ABCDE1234F',
  },
  drivingLicence: {
    label: "Driving Licence",
    icon: 'car-outline',
    description: 'Required for self-drive vehicle rentals.',
    placeholder: 'KA0120240000123',
    hasExpiry: true,
  },
};

const DOC_ORDER: DocType[] = ['passport', 'aadhaar', 'pan', 'drivingLicence'];

export default function IdentityVaultScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const [data, setData] = useState<IdentityData>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal (manual-entry docs only)
  const [editing, setEditing] = useState<DocType | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holderName, setHolderName] = useState('');

  const fetchDocs = useCallback(async () => {
    try {
      const res: any = await identityAPI.get();
      setData(res?.data || {});
    } catch (err: any) {
      console.warn('[Identity] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const openEditor = (type: DocType) => {
    Haptics.selectionAsync();
    const sec = data[type];
    setEditing(type);
    setDocNumber('');
    setExpiry(sec?.expiryDate || sec?.validUntil || '');
    setHolderName(sec?.fullName || sec?.nameOnPan || '');
  };

  const closeEditor = () => {
    setEditing(null);
    setDocNumber('');
    setExpiry('');
    setHolderName('');
  };

  // Build the per-docType field object the PATCH endpoint expects.
  const buildFields = (type: DocType): Record<string, any> => {
    const number = docNumber.trim();
    if (type === 'passport') {
      return { number, fullName: holderName.trim() || undefined, expiryDate: expiry || undefined };
    }
    if (type === 'pan') {
      return { number, nameOnPan: holderName.trim() || undefined };
    }
    if (type === 'drivingLicence') {
      return { number, validUntil: expiry || undefined };
    }
    return { number };
  };

  const saveDoc = async () => {
    if (!editing || editing === 'aadhaar') return;
    if (!docNumber.trim()) {
      Toast.show({ type: 'error', text1: 'Document number required' });
      return;
    }
    setSubmitting(true);
    try {
      // saveDetails fetches the consent text + hash and PATCHes with the
      // required consent block. Any 4xx (incl. consent) surfaces as a throw.
      const res: any = await identityAPI.saveDetails(editing, buildFields(editing));
      if (res?.success !== false) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Saved securely' });
        closeEditor();
        // Use the fresh identity the PATCH returns (avoids a second round-trip).
        if (res?.data) setData(res.data);
        else await fetchDocs();
      } else {
        Toast.show({ type: 'error', text1: 'Save failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err?.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const linkAadhaar = async () => {
    try {
      const res: any = await identityAPI.digilockerInitiate('aadhaar');
      const url = res?.data?.url || res?.url || res?.data?.redirectUrl;
      if (url) {
        Linking.openURL(url).catch(() =>
          Toast.show({ type: 'error', text1: "Couldn't open DigiLocker" }),
        );
      } else {
        Toast.show({
          type: 'info',
          text1: 'DigiLocker link unavailable',
          text2: 'Please try again shortly.',
        });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'DigiLocker error', text2: err?.message });
    }
  };

  const removeDoc = (type: DocType) => {
    Alert.alert(
      'Remove document',
      `This permanently removes your stored ${DOC_META[type].label}. You can re-add it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await identityAPI.removeDoc(type);
              if (res?.success !== false) {
                Toast.show({ type: 'success', text1: 'Removed' });
                await fetchDocs();
              }
            } catch {
              Toast.show({ type: 'error', text1: 'Could not remove' });
            }
          },
        },
      ],
    );
  };

  const requestErasure = () => {
    Alert.alert(
      'Erase all identity documents',
      'This permanently deletes every document stored in your vault. Required by law to be irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await identityAPI.requestErasure();
              Toast.show({ type: 'success', text1: 'Erasure requested' });
              await fetchDocs();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
            }
          },
        },
      ],
    );
  };

  const statusBadge = (status?: string | null) => {
    const s = (status || 'unverified').toLowerCase();
    if (s === 'verified') return { label: 'Verified', variant: 'success' as const };
    if (s === 'expired') return { label: 'Expired', variant: 'error' as const };
    if (s === 'pending') return { label: 'Pending', variant: 'warning' as const };
    return { label: 'Stored', variant: 'default' as const };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Identity Vault</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={[styles.banner, isDarkMode && { backgroundColor: themeColors.card }]}>
          <View style={styles.bannerHead}>
            <Ionicons name="lock-closed" size={18} color={colors.primary[600]} />
            <Text style={styles.bannerTitle}>Encrypted at rest</Text>
          </View>
          <Text style={[styles.bannerBody, { color: themeColors.textSecondary }]}>
            Documents are encrypted on our servers. Only the last 4 digits and validity status are
            shown — full numbers are auto-filled when you book international travel, eSIM, or self-drive
            vehicles.
          </Text>
        </Card>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : (
          DOC_ORDER.map((type) => {
            const meta = DOC_META[type];
            const sec = data[type];
            const stored = !!sec?.numberLast4;
            const badge = stored ? statusBadge(sec?.status) : null;
            const exp = sec?.expiryDate || sec?.validUntil;
            return (
              <Card key={type} style={[styles.docCard, { backgroundColor: themeColors.card }]}>
                <View style={styles.docHead}>
                  <View style={styles.docIcon}>
                    <Ionicons name={meta.icon} size={20} color={colors.primary[600]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.docNameRow}>
                      <Text style={[styles.docLabel, { color: themeColors.text }]}>{meta.label}</Text>
                      {badge ? <Badge label={badge.label} variant={badge.variant} size="sm" /> : null}
                      {meta.digilockerOnly && !stored ? (
                        <Badge label="DigiLocker" variant="default" size="sm" />
                      ) : null}
                    </View>
                    {stored ? (
                      <Text style={[styles.docMeta, { color: themeColors.textSecondary }]}>
                        ••••{sec?.numberLast4}
                        {exp ? ` · Exp ${exp}` : ''}
                      </Text>
                    ) : (
                      <Text style={[styles.docDesc, { color: themeColors.textTertiary }]}>{meta.description}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.docActions}>
                  {meta.digilockerOnly ? (
                    <Button
                      title={stored ? 'Re-link' : 'Link with DigiLocker'}
                      onPress={linkAadhaar}
                      variant="outline"
                      size="sm"
                    />
                  ) : (
                    <Button
                      title={stored ? 'Update' : 'Add'}
                      onPress={() => openEditor(type)}
                      variant="outline"
                      size="sm"
                    />
                  )}
                  {stored ? (
                    <Button title="Remove" onPress={() => removeDoc(type)} variant="ghost" size="sm" />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}

        <TouchableOpacity onPress={requestErasure} style={styles.erasureLink} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={styles.erasureText}>Erase all stored identity documents</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Editor — manual-entry docs only (passport / pan / drivingLicence) */}
      <Modal
        visible={!!editing && editing !== 'aadhaar'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {editing ? DOC_META[editing].label : ''}
            </Text>
            <TouchableOpacity onPress={closeEditor} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {editing && editing !== 'aadhaar' ? (
                <>
                  <Text style={[styles.helperText, { color: themeColors.textSecondary }]}>
                    {DOC_META[editing].description}
                  </Text>
                  <TextInput
                    label="Document number"
                    value={docNumber}
                    onChangeText={setDocNumber}
                    placeholder={DOC_META[editing].placeholder}
                    autoCapitalize="characters"
                  />
                  {editing === 'passport' ? (
                    <TextInput
                      label="Full name (as on passport)"
                      value={holderName}
                      onChangeText={setHolderName}
                      placeholder="Full legal name"
                    />
                  ) : editing === 'pan' ? (
                    <TextInput
                      label="Name on PAN"
                      value={holderName}
                      onChangeText={setHolderName}
                      placeholder="Full legal name"
                    />
                  ) : null}
                  {DOC_META[editing].hasExpiry ? (
                    <TextInput
                      label="Expiry (YYYY-MM-DD)"
                      value={expiry}
                      onChangeText={setExpiry}
                      placeholder="2034-08-15"
                    />
                  ) : null}
                  <Text style={[styles.consentNote, { color: themeColors.textTertiary }]}>
                    By saving, you consent to Prayana securely storing this document for your bookings.
                  </Text>
                </>
              ) : null}
            </ScrollView>
            <View style={[styles.modalFooter, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
              <Button
                title="Save securely"
                onPress={saveDoc}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting}
                icon={<Ionicons name="lock-closed" size={18} color="#fff" />}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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

  banner: { padding: spacing.lg, backgroundColor: colors.primary[50] },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bannerTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[700] },
  bannerBody: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  docCard: { padding: spacing.lg, gap: spacing.md, marginBottom: spacing.sm },
  docHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  docNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  docLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  docMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  docDesc: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2, lineHeight: 16 },
  docActions: { flexDirection: 'row', gap: spacing.sm },

  erasureLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  erasureText: { fontSize: fontSize.sm, color: colors.error, fontWeight: fontWeight.medium },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  modalScroll: { padding: spacing.lg, gap: spacing.md },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  helperText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  consentNote: { fontSize: fontSize.xs, lineHeight: 16, marginTop: spacing.sm },
});
