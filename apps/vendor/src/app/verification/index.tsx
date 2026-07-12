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
  Linking,
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
  Badge,
  LoadingSpinner,
  useTheme,
} from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
import { businessAPI } from '@prayana/shared-services';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerifyStatus = 'verified' | 'pending' | 'failed' | 'invalid' | 'not_provided' | 'not_submitted' | string;

interface VerificationDetail {
  status?: VerifyStatus;
  verificationStatus?: VerifyStatus;
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

// uploadStatus may arrive as an object (backend/PWA shape) or, defensively,
// as a plain status string. normalizeUpload() collapses both.
interface UploadStatusObj {
  uploaded?: boolean;
  status?: string;
  documentNumber?: string | null;
  expiryDate?: string | null;
}

interface DocRequirement {
  docType: string;
  label: string;
  description?: string | null;
  isMandatory?: boolean;
  autoVerifiable?: boolean;
  regulatoryUrl?: string | null;
  regulatoryBody?: string | null;
  uploadStatus?: UploadStatusObj | string;
}

interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

// Doc types the dedicated GSTIN/PAN rows already cover — filtered out of the
// document list so we don't re-ask for the same identifiers (mirrors PWA).
const TAX_ID_COVERED_DOCS = new Set(['pan', 'gst']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function taxStatusOf(detail?: VerificationDetail): VerifyStatus {
  if (!detail) return 'not_provided';
  if (detail.verificationStatus) return detail.verificationStatus;
  if (detail.status) return detail.status;
  if (detail.verified === true) return 'verified';
  if (detail.gstin || detail.panNumber || detail.number) return 'pending';
  return 'not_provided';
}

function isTaxVerified(detail?: VerificationDetail): boolean {
  return taxStatusOf(detail) === 'verified' || detail?.verified === true;
}

function normalizeUpload(u?: UploadStatusObj | string): UploadStatusObj {
  if (!u) return { uploaded: false };
  if (typeof u === 'string') {
    const uploaded = u === 'verified' || u === 'uploaded' || u === 'pending_review' || u === 'pending' || u === 'rejected';
    return { uploaded, status: u };
  }
  return u;
}

function isDocVerified(req: DocRequirement): boolean {
  const u = normalizeUpload(req.uploadStatus);
  return !!u.uploaded && (u.status === 'auto_verified' || u.status === 'manually_verified' || u.status === 'verified');
}

function isDocSubmitted(req: DocRequirement): boolean {
  return !!normalizeUpload(req.uploadStatus).uploaded;
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

// Tax-ID pill meta (mirrors PWA StatusBadge map: verified / pending / invalid / not_provided).
function taxBadgeMeta(status: VerifyStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'verified':
      return { label: 'Verified', variant: 'success' };
    case 'pending':
      return { label: 'Pending', variant: 'warning' };
    case 'invalid':
    case 'failed':
      return { label: 'Invalid', variant: 'error' };
    default:
      return { label: 'Not yet', variant: 'default' };
  }
}

// Document pill meta (mirrors PWA DOC_STATUS_META).
function docBadgeMeta(req: DocRequirement): { label: string; variant: BadgeVariant } {
  const u = normalizeUpload(req.uploadStatus);
  if (!u.uploaded) {
    return req.isMandatory
      ? { label: 'Not provided', variant: 'default' }
      : { label: 'Optional', variant: 'default' };
  }
  switch (u.status) {
    case 'auto_verified':
    case 'manually_verified':
    case 'verified':
      return { label: 'Verified', variant: 'success' };
    case 'rejected':
      return { label: 'Rejected', variant: 'error' };
    case 'expired':
      return { label: 'Expired', variant: 'error' };
    default:
      return { label: 'In review', variant: 'warning' };
  }
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
  const [showOptional, setShowOptional] = useState(false);

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

  // ---- Derived state (mirrors PWA) ----

  const gstStatus = taxStatusOf(business?.gstDetails);
  const panStatus = taxStatusOf(business?.panDetails);
  const gstVerified = isTaxVerified(business?.gstDetails);
  const panVerified = isTaxVerified(business?.panDetails);

  // Strip PAN/GST doctypes — the tax-ID rows above already verify them.
  const docs = useMemo(
    () => requirements.filter((r) => !TAX_ID_COVERED_DOCS.has(r.docType)),
    [requirements],
  );
  const requiredDocs = useMemo(() => docs.filter((r) => r.isMandatory), [docs]);
  const optionalDocs = useMemo(() => docs.filter((r) => !r.isMandatory), [docs]);

  const requiredVerified = requiredDocs.filter(isDocVerified).length;
  const taxVerifiedCount = (gstVerified ? 1 : 0) + (panVerified ? 1 : 0);

  // Progress: GSTIN + PAN + required docs (matches PWA's required-only bar).
  const totalRequired = 2 + requiredDocs.length;
  const totalRequiredVerified = taxVerifiedCount + requiredVerified;
  const pct = totalRequired > 0 ? Math.round((totalRequiredVerified / totalRequired) * 100) : 0;

  // ---- GSTIN verify ----

  const handleVerifyGstin = useCallback(async () => {
    const value = gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) {
      Toast.show({ type: 'error', text1: 'Invalid GSTIN', text2: 'Expected format: 22AAAAA0000A1Z5' });
      return;
    }
    setVerifyingGstin(true);
    try {
      const res = await businessAPI.verifyGSTIN(value);
      const ok = res?.success !== false && (res?.data?.valid ?? res?.data?.verified ?? res?.verified ?? true);
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
      Toast.show({ type: 'error', text1: 'Invalid PAN', text2: 'Expected format: ABCDE1234F' });
      return;
    }
    setVerifyingPan(true);
    try {
      const res = await businessAPI.verifyPAN(value);
      const ok = res?.success !== false && (res?.data?.valid ?? res?.data?.verified ?? res?.verified ?? true);
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
      // Match PWA: raw Aadhaar uploads are blocked (UIDAI Section 33B).
      if (req.docType === 'aadhaar') {
        Toast.show({
          type: 'error',
          text1: 'Aadhaar upload not allowed',
          text2: 'Aadhaar must be verified via DigiLocker or OTP.',
        });
        return;
      }
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
        Toast.show({ type: 'success', text1: `${req.label} uploaded`, text2: 'In review' });
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

  // ---- Render helpers ----

  const renderTaxRow = (opts: {
    label: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    placeholder: string;
    value: string;
    status: VerifyStatus;
    verified: boolean;
    verifying: boolean;
    onChangeText: (v: string) => void;
    onVerify: () => void;
    maxLength: number;
    hint: string;
  }) => {
    const badge = taxBadgeMeta(opts.status);
    return (
      <Card style={styles.taxCard}>
        <View style={styles.taxHeader}>
          <View style={styles.taxIconTile}>
            <Ionicons name={opts.icon} size={20} color={colors.primary[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.taxTitleRow}>
              <Text style={[styles.taxTitle, { color: themeColors.text }]}>{opts.label}</Text>
              <View style={styles.instantTag}>
                <Ionicons name="flash" size={10} color={colors.primary[600]} />
                <Text style={styles.instantTagText}>Instant</Text>
              </View>
            </View>
            <Text style={[styles.taxSubtitle, { color: themeColors.textSecondary }]}>{opts.subtitle}</Text>
          </View>
          <Badge label={badge.label} variant={badge.variant} />
        </View>

        {!opts.verified ? (
          <View style={styles.taxInputBlock}>
            <TextInput
              placeholder={opts.placeholder}
              value={opts.value}
              onChangeText={opts.onChangeText}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={opts.maxLength}
              hint={opts.hint}
            />
            <Button
              title="Verify"
              onPress={opts.onVerify}
              variant="primary"
              size="md"
              fullWidth
              loading={opts.verifying}
              disabled={opts.verifying || opts.value.trim().length !== opts.maxLength}
            />
          </View>
        ) : (
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.verifiedBannerText}>Verified</Text>
          </View>
        )}
      </Card>
    );
  };

  const renderDocCard = (req: DocRequirement) => {
    const u = normalizeUpload(req.uploadStatus);
    const uploaded = !!u.uploaded;
    const rejected = u.status === 'rejected' || u.status === 'expired';
    const busy = uploadingDoc === req.docType;
    return (
      <Card key={req.docType} style={styles.docCard}>
        <View style={styles.docHeader}>
          <View style={styles.docIconTile}>
            <Ionicons
              name={uploaded ? 'document-text' : 'document-outline'}
              size={20}
              color={uploaded ? colors.success : themeColors.textSecondary}
            />
          </View>
          <View style={styles.docInfo}>
            <View style={styles.docTitleRow}>
              <Text style={[styles.docTitle, { color: themeColors.text }]}>{req.label}</Text>
              {req.autoVerifiable ? (
                <View style={styles.instantTag}>
                  <Ionicons name="flash" size={10} color={colors.primary[600]} />
                  <Text style={styles.instantTagText}>Instant</Text>
                </View>
              ) : null}
            </View>
            {req.description ? (
              <Text style={[styles.docDescription, { color: themeColors.textSecondary }]}>{req.description}</Text>
            ) : null}
            {uploaded && u.documentNumber ? (
              <Text style={[styles.docMeta, { color: themeColors.textSecondary }]}>{u.documentNumber}</Text>
            ) : null}
            {uploaded && u.expiryDate ? (
              <Text style={[styles.docMeta, { color: themeColors.textSecondary }]}>
                Expires {new Date(u.expiryDate).toLocaleDateString()}
              </Text>
            ) : null}
            {req.regulatoryUrl && !uploaded ? (
              <TouchableOpacity
                style={styles.regulatoryLink}
                onPress={() => Linking.openURL(req.regulatoryUrl as string)}
                activeOpacity={0.7}
              >
                <Text style={styles.regulatoryLinkText}>{req.regulatoryBody || 'Apply here'}</Text>
                <Ionicons name="open-outline" size={12} color={colors.primary[600]} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Badge label={docBadgeMeta(req).label} variant={docBadgeMeta(req).variant} />
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
              name={uploaded ? 'refresh-outline' : 'cloud-upload-outline'}
              size={18}
              color={colors.primary[500]}
            />
          )}
          <Text style={styles.uploadRowText}>
            {busy ? 'Uploading...' : uploaded ? 'Replace' : 'Upload'}
          </Text>
        </TouchableOpacity>

        {rejected ? (
          <View style={styles.rejectedBanner}>
            <Ionicons name="warning-outline" size={14} color={colors.error} />
            <Text style={styles.rejectedText}>
              This document was {u.status === 'expired' ? 'expired' : 'rejected'}. Please re-upload a clear, valid copy.
            </Text>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderSectionHeader = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    counter?: string,
    action?: React.ReactNode,
  ) => (
    <View style={styles.sectionHeaderRow}>
      <Ionicons name={icon} size={16} color={themeColors.textSecondary} />
      <Text style={[styles.sectionHeaderTitle, { color: themeColors.text }]}>{title}</Text>
      {counter ? (
        <Text style={[styles.sectionHeaderCounter, { color: themeColors.textSecondary }]}>{counter}</Text>
      ) : null}
      {action ? <View style={{ marginLeft: 'auto' }}>{action}</View> : null}
    </View>
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
        {/* Hero — gradient-style progress banner (mirrors PWA hero) */}
        <View style={styles.hero}>
          <View style={styles.heroRing}>
            <Text style={styles.heroRingPct}>{pct}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Business verification</Text>
            <Text style={styles.heroSub}>
              {totalRequiredVerified} of {totalRequired} required complete
              {optionalDocs.length > 0 ? `  ·  ${optionalDocs.length} optional` : ''}
            </Text>
            <Text style={styles.heroBody}>
              Verify your tax IDs and upload required KYC documents. Listings go live and payouts unlock once required
              items are approved.
            </Text>
          </View>
        </View>

        {/* Tax identifiers */}
        {renderSectionHeader('shield-checkmark-outline', 'Tax identifiers', `${taxVerifiedCount} of 2 verified`)}
        {renderTaxRow({
          label: 'GSTIN',
          subtitle: 'Goods and Services Tax ID',
          icon: 'receipt-outline',
          placeholder: '22AAAAA0000A1Z5',
          value: gstin,
          status: gstStatus,
          verified: gstVerified,
          verifying: verifyingGstin,
          onChangeText: (val: string) => setGstin(val.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)),
          onVerify: handleVerifyGstin,
          maxLength: 15,
          hint: gstVerified ? 'GSTIN verified successfully' : '15-character GST number',
        })}
        {renderTaxRow({
          label: 'PAN',
          subtitle: 'Permanent Account Number',
          icon: 'card-outline',
          placeholder: 'ABCDE1234F',
          value: pan,
          status: panStatus,
          verified: panVerified,
          verifying: verifyingPan,
          onChangeText: (val: string) => setPan(val.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10)),
          onVerify: handleVerifyPan,
          maxLength: 10,
          hint: panVerified ? 'PAN verified successfully' : '10-character PAN',
        })}

        {/* Required documents */}
        {renderSectionHeader(
          'document-text-outline',
          'Required documents',
          requiredDocs.length === 0 ? 'None' : `${requiredVerified} of ${requiredDocs.length} verified`,
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.refreshText, { color: themeColors.textSecondary }]}>Refresh</Text>
          </TouchableOpacity>,
        )}
        {requiredDocs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-circle" size={26} color={colors.success} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No additional documents required for your business type — your tax IDs cover the basics.
            </Text>
          </Card>
        ) : (
          requiredDocs.map(renderDocCard)
        )}

        {/* Optional documents — collapsible */}
        {optionalDocs.length > 0 ? (
          <>
            <TouchableOpacity
              style={styles.optionalToggle}
              onPress={() => setShowOptional((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.sectionHeaderTitle, { color: themeColors.text }]}>Optional documents</Text>
              <Text style={[styles.sectionHeaderCounter, { color: themeColors.textSecondary }]}>
                {optionalDocs.filter(isDocSubmitted).length} of {optionalDocs.length} submitted
              </Text>
              <Ionicons
                name={showOptional ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={themeColors.textSecondary}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>
            {showOptional ? optionalDocs.map(renderDocCard) : null}
          </>
        ) : null}

        {/* Footer help */}
        <View style={styles.helpCard}>
          <Ionicons name="information-circle" size={18} color={colors.primary[600]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>How verification works</Text>
            <Text style={styles.helpBody}>
              Tax IDs verify instantly via government APIs. Document uploads are reviewed within 1-2 business days. You
              only need to complete the required items to go live.
            </Text>
          </View>
        </View>

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

  // ---- Hero ----
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[600],
    marginBottom: spacing.xl,
  },
  heroRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroRingPct: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#ffffff' },
  heroTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: '#ffffff' },
  heroSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  heroBody: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.82)', marginTop: spacing.sm, lineHeight: 17 },

  // ---- Section headers ----
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sectionHeaderTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  sectionHeaderCounter: { fontSize: fontSize.xs, color: colors.textSecondary, flexShrink: 1 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary },

  // ---- Tax identifier cards ----
  taxCard: { padding: spacing.lg, marginBottom: spacing.md },
  taxHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  taxIconTile: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  taxTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  taxSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  taxInputBlock: { marginTop: spacing.md, gap: spacing.sm },

  instantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  instantTagText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[600] },

  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.successLight,
  },
  verifiedBannerText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.success },

  // ---- Document cards ----
  docCard: { padding: spacing.lg, marginBottom: spacing.md },
  docHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  docIconTile: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: { flex: 1 },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  docTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, flexShrink: 1 },
  docDescription: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  docMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  regulatoryLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  regulatoryLinkText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.primary[600] },

  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  uploadRowBusy: { opacity: 0.7 },
  uploadRowText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[600] },

  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
  },
  rejectedText: { flex: 1, fontSize: fontSize.xs, color: colors.error, lineHeight: 17 },

  // ---- Empty + optional + help ----
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },

  helpCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  helpTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[700] },
  helpBody: { fontSize: fontSize.xs, color: colors.primary[600], marginTop: 2, lineHeight: 17 },
});
