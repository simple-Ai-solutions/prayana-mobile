import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  TextInput,
  StatusBadge,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { businessAPI } from '@prayana/shared-services';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerifyStatus = 'verified' | 'pending' | 'failed' | 'not_submitted' | string;

interface VerificationDetail {
  status?: VerifyStatus;
  verified?: boolean;
  number?: string;
  gstin?: string;
  panNumber?: string;
  legalName?: string;
  tradeName?: string;
  name?: string;
}

interface BusinessRecord {
  _id?: string;
  gstDetails?: VerificationDetail;
  panDetails?: VerificationDetail;
}

interface DocRequirement {
  docType: string;
  label: string;
  isMandatory?: boolean;
  autoVerifiable?: boolean;
  uploadStatus?: string;
}

interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

const RUPEE = '₹';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusOf(detail?: VerificationDetail): VerifyStatus {
  if (!detail) return 'not_submitted';
  if (detail.status) return detail.status;
  if (detail.verified === true) return 'verified';
  return 'not_submitted';
}

function isVerified(detail?: VerificationDetail): boolean {
  return statusOf(detail) === 'verified' || detail?.verified === true;
}

function fileNameFromUri(uri: string, fallback = 'document'): string {
  const last = uri.split('/').pop();
  return last && last.length ? last : fallback;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VerificationScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [business, setBusiness] = useState<BusinessRecord | null>(null);
  const [requirements, setRequirements] = useState<DocRequirement[]>([]);

  // GSTIN / PAN inputs
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [verifyingGstin, setVerifyingGstin] = useState(false);
  const [verifyingPan, setVerifyingPan] = useState(false);

  // Per-document upload progress
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // ---- Load ----

  const load = useCallback(async () => {
    try {
      const [bizRes, reqRes] = await Promise.all([
        businessAPI.getMyBusiness().catch(() => null),
        businessAPI.getDocumentRequirements().catch(() => null),
      ]);

      const biz: BusinessRecord = bizRes?.data ?? bizRes ?? {};
      setBusiness(biz);
      setGstin((prev) => prev || biz?.gstDetails?.gstin || biz?.gstDetails?.number || '');
      setPan((prev) => prev || biz?.panDetails?.panNumber || biz?.panDetails?.number || '');

      const reqList: DocRequirement[] =
        reqRes?.data?.requirements ?? reqRes?.requirements ?? reqRes?.data ?? reqRes ?? [];
      setRequirements(Array.isArray(reqList) ? reqList : []);
    } catch (err: any) {
      console.warn('[Verification] load failed:', err?.message);
      Toast.show({ type: 'error', text1: 'Could not load verification', text2: err?.message });
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ---- Progress calculation ----

  const progress = useMemo(() => {
    const gstDone = isVerified(business?.gstDetails);
    const panDone = isVerified(business?.panDetails);
    const mandatory = requirements.filter((r) => r.isMandatory);
    const mandatoryDone = mandatory.filter(
      (r) => r.uploadStatus === 'verified' || r.uploadStatus === 'uploaded' || r.uploadStatus === 'pending_review',
    ).length;

    const total = 2 + mandatory.length; // GSTIN + PAN + mandatory docs
    const done = (gstDone ? 1 : 0) + (panDone ? 1 : 0) + mandatoryDone;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { pct, done, total, gstDone, panDone };
  }, [business, requirements]);

  // ---- GSTIN verify ----

  const handleVerifyGstin = useCallback(async () => {
    const value = gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) {
      Toast.show({ type: 'error', text1: 'Invalid GSTIN', text2: 'Enter a valid 15-character GSTIN.' });
      return;
    }
    setVerifyingGstin(true);
    try {
      const res = await businessAPI.verifyGSTIN(value);
      const ok = res?.success !== false && (res?.data?.verified ?? res?.verified ?? true);
      if (ok) {
        Toast.show({ type: 'success', text1: 'GSTIN verified' });
        await load();
      } else {
        Toast.show({
          type: 'error',
          text1: 'GSTIN verification failed',
          text2: res?.message || 'Could not verify this GSTIN.',
        });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: err?.message });
    } finally {
      setVerifyingGstin(false);
    }
  }, [gstin, load]);

  // ---- PAN verify ----

  const handleVerifyPan = useCallback(async () => {
    const value = pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
      Toast.show({ type: 'error', text1: 'Invalid PAN', text2: 'Enter a valid 10-character PAN.' });
      return;
    }
    setVerifyingPan(true);
    try {
      const res = await businessAPI.verifyPAN(value);
      const ok = res?.success !== false && (res?.data?.verified ?? res?.verified ?? true);
      if (ok) {
        Toast.show({ type: 'success', text1: 'PAN verified' });
        await load();
      } else {
        Toast.show({
          type: 'error',
          text1: 'PAN verification failed',
          text2: res?.message || 'Could not verify this PAN.',
        });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: err?.message });
    } finally {
      setVerifyingPan(false);
    }
  }, [pan, load]);

  // ---- File pickers ----

  const pickImageFile = useCallback(async (): Promise<PickedFile | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to upload documents.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.fileName || fileNameFromUri(asset.uri, 'document.jpg'),
      type: asset.mimeType || 'image/jpeg',
    };
  }, []);

  const pickDocFile = useCallback(async (): Promise<PickedFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name || fileNameFromUri(asset.uri, 'document.pdf'),
      type: asset.mimeType || 'application/pdf',
    };
  }, []);

  // ---- Upload a document ----

  const doUpload = useCallback(
    async (req: DocRequirement, file: PickedFile) => {
      setUploadingDoc(req.docType);
      try {
        const formData = new FormData();
        formData.append('document', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
        formData.append('docType', req.docType);

        await businessAPI.uploadDocument(formData);
        Toast.show({ type: 'success', text1: `${req.label} uploaded` });
        await load();
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Upload failed', text2: err?.message || 'Please try again.' });
      } finally {
        setUploadingDoc(null);
      }
    },
    [load],
  );

  const handleUploadPress = useCallback(
    (req: DocRequirement) => {
      Alert.alert(
        req.label,
        'Choose how to upload your document.',
        [
          {
            text: 'Photo Library',
            onPress: async () => {
              const file = await pickImageFile();
              if (file) await doUpload(req, file);
            },
          },
          {
            text: 'Browse Files',
            onPress: async () => {
              const file = await pickDocFile();
              if (file) await doUpload(req, file);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [pickImageFile, pickDocFile, doUpload],
  );

  // ---- Render ----

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={26} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Verification</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.center}>
          <LoadingSpinner size="large" message="Loading verification..." />
        </View>
      </SafeAreaView>
    );
  }

  const gstStatus = statusOf(business?.gstDetails);
  const panStatus = statusOf(business?.panDetails);
  const gstVerified = isVerified(business?.gstDetails);
  const panVerified = isVerified(business?.panDetails);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Verification</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress card */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.progressTitle, { color: themeColors.text }]}>KYC Progress</Text>
              <Text style={[styles.progressSub, { color: themeColors.textSecondary }]}>
                {progress.done} of {progress.total} steps complete
              </Text>
            </View>
            <View style={styles.progressRing}>
              <Text style={styles.progressPct}>{progress.pct}%</Text>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: themeColors.inputBackground }]}>
            <View style={[styles.progressFill, { width: `${progress.pct}%` }]} />
          </View>
        </Card>

        {/* GSTIN */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="receipt-outline" size={18} color={colors.primary[500]} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>GSTIN</Text>
            </View>
            <StatusBadge status={gstStatus === 'not_submitted' ? 'pending' : gstStatus} />
          </View>

          <TextInput
            label="GST Identification Number"
            placeholder="e.g. 27AAACA1234A1Z5"
            value={gstin}
            onChangeText={(val: string) => setGstin(val.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!gstVerified}
            maxLength={15}
            hint={gstVerified ? 'GSTIN verified successfully' : '15-character GST number'}
          />
          {!gstVerified ? (
            <Button
              title="Verify GSTIN"
              onPress={handleVerifyGstin}
              variant="primary"
              size="md"
              fullWidth
              loading={verifyingGstin}
              disabled={verifyingGstin || gstin.trim().length !== 15}
            />
          ) : (
            <View style={styles.verifiedBanner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.verifiedBannerText}>Verified</Text>
            </View>
          )}
        </Card>

        {/* PAN */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="card-outline" size={18} color={colors.primary[500]} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>PAN</Text>
            </View>
            <StatusBadge status={panStatus === 'not_submitted' ? 'pending' : panStatus} />
          </View>

          <TextInput
            label="Permanent Account Number"
            placeholder="e.g. ABCDE1234F"
            value={pan}
            onChangeText={(val: string) => setPan(val.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10))}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!panVerified}
            maxLength={10}
            hint={panVerified ? 'PAN verified successfully' : '10-character PAN'}
          />
          {!panVerified ? (
            <Button
              title="Verify PAN"
              onPress={handleVerifyPan}
              variant="primary"
              size="md"
              fullWidth
              loading={verifyingPan}
              disabled={verifyingPan || pan.trim().length !== 10}
            />
          ) : (
            <View style={styles.verifiedBanner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.verifiedBannerText}>Verified</Text>
            </View>
          )}
        </Card>

        {/* Documents */}
        <Text style={[styles.docsHeading, { color: themeColors.text }]}>Documents</Text>
        {requirements.length === 0 ? (
          <Card style={styles.sectionCard}>
            <Text style={[styles.emptyDocsText, { color: themeColors.textSecondary }]}>
              No additional documents are required for your business type right now.
            </Text>
          </Card>
        ) : (
          requirements.map((req) => {
            const uploaded =
              req.uploadStatus === 'verified' ||
              req.uploadStatus === 'uploaded' ||
              req.uploadStatus === 'pending_review';
            const busy = uploadingDoc === req.docType;
            return (
              <Card key={req.docType} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={styles.docInfo}>
                    <View style={styles.docTitleRow}>
                      <Ionicons
                        name={uploaded ? 'document-text' : 'cloud-upload-outline'}
                        size={18}
                        color={uploaded ? colors.success : themeColors.textSecondary}
                      />
                      <Text style={[styles.docTitle, { color: themeColors.text }]}>
                        {req.label}
                        {req.isMandatory ? ' *' : ' (optional)'}
                      </Text>
                    </View>
                    <View style={styles.docTags}>
                      {req.autoVerifiable ? (
                        <View style={styles.autoTag}>
                          <Ionicons name="flash-outline" size={11} color={colors.primary[600]} />
                          <Text style={styles.autoTagText}>Auto-verifiable</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <StatusBadge status={req.uploadStatus || 'pending'} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.uploadRow,
                    { borderColor: uploaded ? colors.success : colors.primary[200] },
                    busy && styles.uploadRowBusy,
                  ]}
                  onPress={() => handleUploadPress(req)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                  ) : (
                    <Ionicons
                      name={uploaded ? 'refresh-outline' : 'add-circle-outline'}
                      size={18}
                      color={colors.primary[500]}
                    />
                  )}
                  <Text style={styles.uploadRowText}>
                    {busy ? 'Uploading...' : uploaded ? 'Replace document' : 'Upload document'}
                  </Text>
                </TouchableOpacity>
              </Card>
            );
          })
        )}

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

  scrollContent: { padding: spacing.lg },

  // ---- Progress ----
  progressCard: { padding: spacing.lg, marginBottom: spacing.lg },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  progressTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  progressSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  progressRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPct: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[600] },
  progressTrack: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
  },

  // ---- Section cards ----
  sectionCard: { padding: spacing.lg, marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },

  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.successLight,
  },
  verifiedBannerText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.success },

  // ---- Documents ----
  docsHeading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyDocsText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  docCard: { padding: spacing.lg, marginBottom: spacing.md },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  docInfo: { flex: 1, marginRight: spacing.md },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, flexShrink: 1 },
  docTags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, marginLeft: 26 },
  autoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  autoTagText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.primary[600] },

  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  uploadRowBusy: { opacity: 0.7 },
  uploadRowText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[600] },
});
