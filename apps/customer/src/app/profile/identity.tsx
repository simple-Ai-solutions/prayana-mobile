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

type DocType = 'passport' | 'aadhaar' | 'pan' | 'drivers_license' | 'visa';

type StoredDoc = {
  type: DocType;
  numberMasked?: string;
  status?: 'verified' | 'pending' | 'expired' | 'unverified';
  expiry?: string;
  updatedAt?: string;
};

const DOC_META: Record<DocType, { label: string; icon: keyof typeof Ionicons.glyphMap; description: string; placeholder: string }> = {
  passport: {
    label: 'Passport',
    icon: 'airplane-outline',
    description: 'Used for international travel + eSIM activation.',
    placeholder: 'A12345678',
  },
  aadhaar: {
    label: 'Aadhaar',
    icon: 'finger-print-outline',
    description: 'Used for Indian booking KYC. Last 4 digits stored masked.',
    placeholder: '1234 5678 9012',
  },
  pan: {
    label: 'PAN',
    icon: 'card-outline',
    description: 'Used for tax invoices on high-value bookings.',
    placeholder: 'ABCDE1234F',
  },
  drivers_license: {
    label: "Driver's licence",
    icon: 'car-outline',
    description: 'Required for self-drive vehicle rentals.',
    placeholder: 'KA01 20240000123',
  },
  visa: {
    label: 'Visa',
    icon: 'document-text-outline',
    description: 'Optional — speeds up international booking forms.',
    placeholder: 'V12345678',
  },
};

const DOC_ORDER: DocType[] = ['passport', 'aadhaar', 'pan', 'drivers_license', 'visa'];

export default function IdentityVaultScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const [docs, setDocs] = useState<Record<string, StoredDoc>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<DocType | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holderName, setHolderName] = useState('');

  const fetchDocs = useCallback(async () => {
    try {
      const res = await identityAPI.get();
      const list: StoredDoc[] = res?.data?.documents || res?.documents || [];
      const map: Record<string, StoredDoc> = {};
      list.forEach((d) => {
        map[d.type] = d;
      });
      setDocs(map);
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
    setEditing(type);
    setDocNumber('');
    setExpiry(docs[type]?.expiry || '');
    setHolderName('');
  };

  const closeEditor = () => {
    setEditing(null);
    setDocNumber('');
    setExpiry('');
    setHolderName('');
  };

  const saveDoc = async () => {
    if (!editing) return;
    if (!docNumber.trim()) {
      Toast.show({ type: 'error', text1: 'Document number required' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await identityAPI.saveDoc(editing, {
        number: docNumber.trim(),
        expiry: expiry || undefined,
        holderName: holderName.trim() || undefined,
      });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Saved securely' });
        closeEditor();
        await fetchDocs();
      } else {
        Toast.show({ type: 'error', text1: 'Save failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err?.message });
    } finally {
      setSubmitting(false);
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
              const res = await identityAPI.removeDoc(type);
              if (res?.success) {
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
        {/* Privacy banner */}
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
            const doc = docs[type];
            const stored = !!doc;
            return (
              <Card key={type} style={[styles.docCard, { backgroundColor: themeColors.card }]}>
                <View style={styles.docHead}>
                  <View style={styles.docIcon}>
                    <Ionicons name={meta.icon} size={20} color={colors.primary[600]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.docNameRow}>
                      <Text style={[styles.docLabel, { color: themeColors.text }]}>{meta.label}</Text>
                      {stored ? (
                        <Badge
                          label={
                            doc.status === 'verified'
                              ? 'Verified'
                              : doc.status === 'expired'
                                ? 'Expired'
                                : doc.status === 'pending'
                                  ? 'Pending'
                                  : 'Stored'
                          }
                          variant={
                            doc.status === 'verified'
                              ? 'success'
                              : doc.status === 'expired'
                                ? 'error'
                                : doc.status === 'pending'
                                  ? 'warning'
                                  : 'default'
                          }
                          size="sm"
                        />
                      ) : null}
                    </View>
                    {stored ? (
                      <Text style={[styles.docMeta, { color: themeColors.textSecondary }]}>
                        {doc.numberMasked || '••••'}
                        {doc.expiry ? ` · Exp ${doc.expiry}` : ''}
                      </Text>
                    ) : (
                      <Text style={[styles.docDesc, { color: themeColors.textTertiary }]}>{meta.description}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.docActions}>
                  <Button
                    title={stored ? 'Update' : 'Add'}
                    onPress={() => openEditor(type)}
                    variant="outline"
                    size="sm"
                  />
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

      {/* Editor */}
      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {editing ? `${DOC_META[editing].label}` : ''}
            </Text>
            <TouchableOpacity onPress={closeEditor} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {editing ? (
                <>
                  <Text style={[styles.helperText, { color: themeColors.textSecondary }]}>{DOC_META[editing].description}</Text>
                  <TextInput
                    label="Document number"
                    value={docNumber}
                    onChangeText={setDocNumber}
                    placeholder={DOC_META[editing].placeholder}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    label="Holder name (as on document)"
                    value={holderName}
                    onChangeText={setHolderName}
                    placeholder="Full legal name"
                  />
                  {(editing === 'passport' || editing === 'visa' || editing === 'drivers_license') ? (
                    <TextInput
                      label="Expiry (YYYY-MM-DD)"
                      value={expiry}
                      onChangeText={setExpiry}
                      placeholder="2034-08-15"
                    />
                  ) : null}
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
  docNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
});
