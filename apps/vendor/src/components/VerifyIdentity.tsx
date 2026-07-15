import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';

// Branded (blue) components come from the vendor barrel; non-branded ones are
// re-exported through it too, so a single import keeps the whole screen on-brand.
import { Card, Button, TextInput, Badge, LoadingSpinner, useTheme } from './ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../theme/vendorColors';
import { businessAPI, identityAPI } from '@prayana/shared-services';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KycTier = 'basic' | 'standard' | 'premium';

export interface VerifyIdentityHandle {
  /** Re-fetch the business + document requirements. Wired to pull-to-refresh. */
  reload: () => Promise<void>;
}

interface VerifyIdentityProps {
  /**
   * `onboarding` renders as a plain (host-scrolled) block with its own heading,
   * and lets the intro "skip" card call `onSkip`. `standalone` renders the same
   * body without the heading (the route supplies a top bar instead).
   */
  variant: 'onboarding' | 'standalone';
  /** Called when the user taps the "complete later" affordance (onboarding). */
  onSkip?: () => void;
}

// Server verification statuses collapse to one of these UI states.
type DocState = 'verified' | 'in_review' | 'rejected' | 'expired' | 'not_provided';

interface TaxDetail {
  verificationStatus?: string;
  status?: string;
  verified?: boolean;
  panNumber?: string | null;
  gstin?: string | null;
  number?: string | null;
  maskedNumber?: string | null;
  verificationMethod?: string | null;
}

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
  /** Some backends tag which KYC tier a document unlocks. */
  tier?: string | null;
  regulatoryUrl?: string | null;
  regulatoryBody?: string | null;
  uploadStatus?: UploadStatusObj | string;
}

interface BusinessDoc {
  docType?: string;
  status?: string;
  documentNumber?: string | null;
  expiryDate?: string | null;
}

interface BusinessRecord {
  kycTier?: KycTier;
  kycCompletionPercent?: number;
  panDetails?: TaxDetail;
  aadhaarDetails?: TaxDetail;
  gstDetails?: TaxDetail;
  documents?: BusinessDoc[];
  payout?: { bankDetails?: { accountNumber?: string | null; ifscCode?: string | null } };
}

interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The three always-required identity documents. Rendered as fixed cards so the
// "Required Documents" section is stable even before the requirements API
// answers (and in dev-bypass mode where authed fetches 401 to empty).
const CORE_PAN = 'pan';
const CORE_AADHAAR = 'aadhaar';
const CORE_BANK = 'bank_proof';
const CORE_TYPES = new Set([CORE_PAN, CORE_AADHAAR, CORE_BANK]);

const TIERS: KycTier[] = ['basic', 'standard', 'premium'];
const TIER_LABEL: Record<KycTier, string> = {
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // "Max 10MB" per the design
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// A deeper green than the semantic success token so white label text stays
// legible on the DigiLocker call-to-action.
const DIGILOCKER_GREEN = '#16a34a';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUpload(u?: UploadStatusObj | string): UploadStatusObj {
  if (!u) return { uploaded: false };
  if (typeof u === 'string') {
    const uploaded = ['verified', 'uploaded', 'pending_review', 'pending', 'rejected'].includes(u);
    return { uploaded, status: u };
  }
  return u;
}

function stateFromStatus(status?: string): DocState {
  switch (status) {
    case 'verified':
    case 'auto_verified':
    case 'manually_verified':
      return 'verified';
    case 'rejected':
    case 'invalid':
      return 'rejected';
    case 'expired':
      return 'expired';
    case 'pending':
    case 'pending_review':
    case 'under_review':
    case 'uploaded':
    case 'renewal_pending':
      return 'in_review';
    default:
      return 'not_provided';
  }
}

function taxState(detail?: TaxDetail): DocState {
  if (!detail) return 'not_provided';
  if (detail.verified === true) return 'verified';
  const s = stateFromStatus(detail.verificationStatus || detail.status);
  if (s !== 'not_provided') return s;
  if (detail.panNumber || detail.gstin || detail.number || detail.maskedNumber) return 'in_review';
  return 'not_provided';
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

function statusBadge(state: DocState): { label: string; variant: BadgeVariant } | null {
  switch (state) {
    case 'verified':
      return { label: 'Verified', variant: 'success' };
    case 'in_review':
      return { label: 'In review', variant: 'warning' };
    case 'rejected':
      return { label: 'Rejected', variant: 'error' };
    case 'expired':
      return { label: 'Expired', variant: 'error' };
    default:
      return null; // not_provided → no status pill (the design shows tags instead)
  }
}

function fileNameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.length ? last : fallback;
}

// ---------------------------------------------------------------------------
// Small presentational pills
// ---------------------------------------------------------------------------

function AutoVerifiablePill() {
  return (
    <View style={styles.autoPill}>
      <Ionicons name="flash" size={10} color={colors.primary[600]} />
      <Text style={styles.autoPillText}>Auto-Verifiable</Text>
    </View>
  );
}

function TierPill({ tier }: { tier: string }) {
  return (
    <View style={styles.tierPill}>
      <Ionicons name="ribbon-outline" size={10} color={colors.warning} />
      <Text style={styles.tierPillText}>{tier} tier</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function VerifyIdentityInner(
  { variant, onSkip }: VerifyIdentityProps,
  ref: React.Ref<VerifyIdentityHandle>,
) {
  const { themeColors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessRecord | null>(null);
  const [requirements, setRequirements] = useState<DocRequirement[]>([]);
  const [showOptional, setShowOptional] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [aadhaarBusy, setAadhaarBusy] = useState(false);

  // Bank account proof — inline IFSC + account number (₹1 name-check is copy only).
  const [ifsc, setIfsc] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [ifscError, setIfscError] = useState('');
  const [ifscLoading, setIfscLoading] = useState(false);

  // ---- Load ----

  const load = useCallback(async () => {
    try {
      const [bizRes, reqRes] = await Promise.all([
        businessAPI.getMyBusiness().catch(() => null),
        businessAPI.getDocumentRequirements().catch(() => null),
      ]);
      const biz: BusinessRecord = (bizRes as any)?.data ?? bizRes ?? {};
      setBusiness(biz);
      setIfsc((prev) => prev || biz?.payout?.bankDetails?.ifscCode || '');
      setAccountNumber((prev) => prev || biz?.payout?.bankDetails?.accountNumber || '');

      const reqList: DocRequirement[] =
        (reqRes as any)?.data?.requirements ??
        (reqRes as any)?.requirements ??
        (reqRes as any)?.data ??
        reqRes ??
        [];
      setRequirements(Array.isArray(reqList) ? reqList : []);
    } catch (err: any) {
      // Stay quiet — a transient/401 (dev-bypass) failure shouldn't nag mid-onboarding.
      console.warn('[VerifyIdentity] load failed:', err?.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useImperativeHandle(ref, () => ({ reload: load }), [load]);

  // ---- IFSC auto-lookup (debounced, mirrors the onboarding payout step) ----

  useEffect(() => {
    const value = ifsc.trim();
    const timer = setTimeout(async () => {
      if (value.length === 11 && IFSC_RE.test(value)) {
        setIfscLoading(true);
        setIfscError('');
        try {
          const res = await fetch(`https://ifsc.razorpay.com/${value}`);
          if (res.ok) {
            const data = await res.json();
            setBankName(data.BANK || '');
            setBranchName(data.BRANCH || '');
          } else {
            setIfscError('Invalid IFSC code');
            setBankName('');
            setBranchName('');
          }
        } catch {
          setIfscError('Could not validate IFSC code');
        } finally {
          setIfscLoading(false);
        }
      } else if (value.length > 0 && value.length < 11) {
        setIfscError('IFSC code must be 11 characters');
        setBankName('');
        setBranchName('');
      } else {
        setIfscError('');
        setBankName('');
        setBranchName('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [ifsc]);

  // ---- Derived state ----

  const docByType = useMemo(() => {
    const map: Record<string, BusinessDoc> = {};
    (business?.documents ?? []).forEach((d) => {
      if (d?.docType) map[d.docType] = d;
    });
    return map;
  }, [business]);

  const reqByType = useMemo(() => {
    const map: Record<string, DocRequirement> = {};
    requirements.forEach((r) => {
      if (r?.docType) map[r.docType] = r;
    });
    return map;
  }, [requirements]);

  // Resolve a document's UI state from every signal we have: dedicated tax
  // details first (they carry the authoritative "verified"), then the
  // requirements' uploadStatus, then any raw uploaded document.
  const stateForType = useCallback(
    (type: string): DocState => {
      if (type === CORE_PAN) {
        const s = taxState(business?.panDetails);
        if (s !== 'not_provided') return s;
      }
      if (type === CORE_AADHAAR) {
        const s = taxState(business?.aadhaarDetails);
        if (s !== 'not_provided') return s;
      }
      if (type === 'gst') {
        const s = taxState(business?.gstDetails);
        if (s !== 'not_provided') return s;
      }
      const up = reqByType[type]?.uploadStatus;
      if (up != null) {
        const u = normalizeUpload(up);
        if (u.uploaded) return stateFromStatus(u.status) === 'not_provided' ? 'in_review' : stateFromStatus(u.status);
      }
      const doc = docByType[type];
      if (doc) return stateFromStatus(doc.status);
      return 'not_provided';
    },
    [business, reqByType, docByType],
  );

  const isDone = useCallback((type: string) => stateForType(type) === 'verified', [stateForType]);

  // Non-core requirements split into the design's two extra groups.
  const activitySpecific = useMemo(
    () => requirements.filter((r) => !CORE_TYPES.has(r.docType) && r.isMandatory),
    [requirements],
  );
  const optional = useMemo(
    () => requirements.filter((r) => !CORE_TYPES.has(r.docType) && !r.isMandatory),
    [requirements],
  );

  const coreDoneCount = [CORE_PAN, CORE_AADHAAR, CORE_BANK].filter(isDone).length;
  const activityDoneCount = activitySpecific.filter((r) => isDone(r.docType)).length;
  const optionalDoneCount = optional.filter((r) => isDone(r.docType)).length;

  const tier: KycTier = business?.kycTier ?? 'basic';
  const totalRequired = 3 + activitySpecific.length;
  const requiredDone = coreDoneCount + activityDoneCount;
  const percent =
    typeof business?.kycCompletionPercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(business.kycCompletionPercent)))
      : totalRequired > 0
        ? Math.round((requiredDone / totalRequired) * 100)
        : 0;

  // ---- File pickers ----

  const pickImage = useCallback(async (): Promise<PickedFile | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to upload documents.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    return {
      uri: a.uri,
      name: a.fileName || fileNameFromUri(a.uri, 'document.jpg'),
      type: a.mimeType || 'image/jpeg',
      size: a.fileSize,
    };
  }, []);

  const pickDoc = useCallback(async (): Promise<PickedFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    return {
      uri: a.uri,
      name: a.name || fileNameFromUri(a.uri, 'document.pdf'),
      type: a.mimeType || 'application/pdf',
      size: a.size,
    };
  }, []);

  const doUpload = useCallback(
    async (docType: string, label: string, file: PickedFile) => {
      // UIDAI Section 33B forbids storing raw Aadhaar — it must go through
      // DigiLocker/OTP, never a file upload.
      if (docType === CORE_AADHAAR) {
        Toast.show({
          type: 'error',
          text1: 'Aadhaar upload not allowed',
          text2: 'Verify Aadhaar via DigiLocker or OTP instead.',
        });
        return;
      }
      if (file.size != null && file.size > MAX_UPLOAD_BYTES) {
        Toast.show({ type: 'error', text1: 'File too large', text2: 'Maximum size is 10MB.' });
        return;
      }
      setUploadingType(docType);
      try {
        const formData = new FormData();
        formData.append('document', { uri: file.uri, name: file.name, type: file.type } as any);
        formData.append('docType', docType);
        await businessAPI.uploadDocument(formData);
        Toast.show({ type: 'success', text1: `${label} uploaded`, text2: 'In review' });
        await load();
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Upload failed', text2: err?.message || 'Please try again.' });
      } finally {
        setUploadingType(null);
      }
    },
    [load],
  );

  const handleUpload = useCallback(
    (docType: string, label: string) => {
      Alert.alert(
        label,
        'Choose how to upload your document.',
        [
          {
            text: 'Photo Library',
            onPress: async () => {
              const f = await pickImage();
              if (f) await doUpload(docType, label, f);
            },
          },
          {
            text: 'Browse Files',
            onPress: async () => {
              const f = await pickDoc();
              if (f) await doUpload(docType, label, f);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [pickImage, pickDoc, doUpload],
  );

  // ---- Aadhaar via DigiLocker / OTP ----

  const handleAadhaar = useCallback(async () => {
    setAadhaarBusy(true);
    try {
      const res: any = await identityAPI.digilockerInitiate('aadhaar');
      const url =
        res?.data?.url ?? res?.url ?? res?.data?.redirectUrl ?? res?.redirectUrl ?? res?.data?.consentUrl;
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        // The DigiLocker callback is async on the server; refresh to pick up
        // the new status when the user returns.
        await load();
      } else {
        Toast.show({
          type: 'info',
          text1: 'Aadhaar verification coming soon',
          text2: 'You can complete this from the web dashboard for now.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not start Aadhaar verification',
        text2: err?.message || 'Please try again later.',
      });
    } finally {
      setAadhaarBusy(false);
    }
  }, [load]);

  // ---- Render helpers ----

  const renderSectionHeader = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    done: number,
    total: number,
    tone: 'danger' | 'brand' | 'muted',
  ) => {
    const complete = total > 0 && done >= total;
    const color =
      complete ? colors.success : tone === 'danger' ? colors.error : tone === 'brand' ? colors.primary[600] : themeColors.textSecondary;
    const bg =
      complete ? colors.successLight : tone === 'danger' ? colors.errorLight : tone === 'brand' ? colors.primary[50] : themeColors.backgroundSecondary;
    return (
      <View style={[styles.sectionHeader, { backgroundColor: bg }]}>
        <Ionicons
          name={complete ? 'checkmark-circle' : icon}
          size={15}
          color={color}
        />
        <Text style={[styles.sectionHeaderTitle, { color }]}>{title}</Text>
        <Text style={[styles.sectionHeaderCount, { color }]}>
          ({done}/{total})
        </Text>
      </View>
    );
  };

  // A single document card. `mode` picks the right action affordance.
  const renderDocCard = (opts: {
    docType: string;
    label: string;
    description?: string | null;
    mode: 'upload' | 'aadhaar' | 'bank';
    autoVerifiable?: boolean;
    tier?: string | null;
    required?: boolean;
    /** Stack the header vertically with the upload target centered (used for the bank card). */
    stacked?: boolean;
  }) => {
    const state = stateForType(opts.docType);
    const badge = statusBadge(state);
    const busy = uploadingType === opts.docType;
    const done = state === 'verified';
    const rejected = state === 'rejected' || state === 'expired';

    // Upload target (decorative shield for Aadhaar).
    const uploadTarget =
      opts.mode === 'aadhaar' ? (
        <View style={[styles.dropZone, styles.dropZoneStatic]}>
          <Ionicons name="finger-print-outline" size={22} color={colors.primary[500]} />
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.dropZone, done && styles.dropZoneDone]}
          onPress={() => handleUpload(opts.docType, opts.label)}
          disabled={busy}
          activeOpacity={0.7}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <Ionicons
              name={done ? 'checkmark-circle' : 'cloud-upload-outline'}
              size={22}
              color={done ? colors.success : colors.primary[500]}
            />
          )}
          <Text style={styles.dropZoneText}>{done ? 'Uploaded' : 'Upload'}</Text>
        </TouchableOpacity>
      );

    // Title, tags, hint.
    const infoBlock = (
      <View style={[styles.docInfo, opts.stacked && styles.docInfoStacked]}>
        <View style={[styles.docTitleRow, opts.stacked && styles.docTitleRowStacked]}>
          <Text style={[styles.docTitle, opts.stacked && styles.textCenter, { color: themeColors.text }]}>
            {opts.label}
            {opts.required ? <Text style={styles.reqMark}> *</Text> : null}
          </Text>
          {badge ? <Badge label={badge.label} variant={badge.variant} /> : null}
        </View>
        {(opts.autoVerifiable || opts.tier) && (
          <View style={[styles.tagRow, opts.stacked && styles.tagRowStacked]}>
            {opts.autoVerifiable ? <AutoVerifiablePill /> : null}
            {opts.tier ? <TierPill tier={opts.tier} /> : null}
          </View>
        )}
        {opts.description ? (
          <Text style={[styles.docHint, opts.stacked && styles.textCenter, { color: themeColors.textSecondary }]}>
            {opts.description}
          </Text>
        ) : (
          <Text style={[styles.docHint, opts.stacked && styles.textCenter, { color: themeColors.textTertiary }]}>
            Max 10MB • PDF or Image
          </Text>
        )}
      </View>
    );

    return (
      <Card key={opts.docType} style={styles.docCard}>
        <View style={[styles.docRow, opts.stacked && styles.docRowStacked]}>
          {opts.stacked ? (
            <>
              {infoBlock}
              {uploadTarget}
            </>
          ) : (
            <>
              {uploadTarget}
              {infoBlock}
            </>
          )}
        </View>

        {/* Action / extra fields */}
        {opts.mode === 'aadhaar' ? (
          done ? null : (
            <TouchableOpacity
              style={[styles.aadhaarBtn, aadhaarBusy && styles.btnBusy]}
              onPress={handleAadhaar}
              disabled={aadhaarBusy}
              activeOpacity={0.85}
            >
              {aadhaarBusy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="flash" size={16} color="#ffffff" />
              )}
              <Text style={styles.aadhaarBtnText}>Verify with DigiLocker / OTP</Text>
            </TouchableOpacity>
          )
        ) : opts.mode === 'bank' ? (
          <View style={styles.bankBlock}>
            <View style={styles.bankFields}>
              <View style={styles.bankField}>
                <Text style={[styles.bankFieldLabel, { color: themeColors.textSecondary }]}>IFSC Code</Text>
                <TextInput
                  placeholder="ABCD0123456"
                  value={ifsc}
                  onChangeText={(v: string) => setIfsc(v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 11))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={11}
                  error={ifscError || undefined}
                  rightIcon={
                    ifscLoading ? (
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                    ) : bankName ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    ) : undefined
                  }
                />
              </View>
              <View style={styles.bankField}>
                <Text style={[styles.bankFieldLabel, { color: themeColors.textSecondary }]}>Account Number</Text>
                <TextInput
                  placeholder="9–18 digits"
                  value={accountNumber}
                  onChangeText={(v: string) => setAccountNumber(v.replace(/\D/g, '').slice(0, 18))}
                  keyboardType="number-pad"
                  maxLength={18}
                />
              </View>
            </View>
            {!!bankName && (
              <View style={styles.bankConfirm}>
                <Ionicons name="business" size={14} color={colors.success} />
                <Text style={styles.bankConfirmText} numberOfLines={1}>
                  {bankName}
                  {branchName ? ` · ${branchName}` : ''}
                </Text>
              </View>
            )}
            <Text style={[styles.bankNote, { color: themeColors.textTertiary }]}>
              We send ₹1 to verify the account holder name (live Razorpay only). Test mode does IFSC
              validation only.
            </Text>
          </View>
        ) : null}

        {rejected ? (
          <View style={styles.rejectedBanner}>
            <Ionicons name="warning-outline" size={14} color={colors.error} />
            <Text style={styles.rejectedText}>
              This document was {state === 'expired' ? 'expired' : 'rejected'}. Please re-upload a clear,
              valid copy.
            </Text>
          </View>
        ) : null}
      </Card>
    );
  };

  // ---- Loading ----

  if (loading) {
    return (
      <View style={[styles.body, styles.loadingBox]}>
        <LoadingSpinner size="large" message="Loading verification..." />
      </View>
    );
  }

  // ---- Render ----

  return (
    <View style={styles.body}>
      {variant === 'onboarding' ? (
        <View style={styles.heading}>
          <Text style={[styles.headingTitle, { color: themeColors.text }]}>Verify your identity</Text>
          <Text style={[styles.headingSub, { color: themeColors.textSecondary }]}>
            Upload documents to get a verified badge and unlock features.
          </Text>
        </View>
      ) : null}

      {/* KYC tier progress */}
      <Card style={styles.kycCard}>
        <View style={styles.kycTopRow}>
          <View style={styles.kycLevelRow}>
            <Ionicons name="ribbon" size={16} color={colors.primary[600]} />
            <Text style={styles.kycLevelText}>KYC Level: {TIER_LABEL[tier]}</Text>
          </View>
          <Text style={styles.kycPercent}>{percent}% complete</Text>
        </View>
        <View style={styles.kycTrack}>
          <View style={[styles.kycFill, { width: `${percent}%` }]} />
        </View>
        <View style={styles.kycMarkers}>
          {TIERS.map((t) => (
            <Text
              key={t}
              style={[
                styles.kycMarker,
                { color: t === tier ? colors.primary[600] : themeColors.textTertiary },
                t === tier && styles.kycMarkerActive,
              ]}
            >
              {TIER_LABEL[t]}
            </Text>
          ))}
        </View>
      </Card>

      {/* Reassurance cards */}
      <View style={styles.infoRow}>
        <TouchableOpacity
          style={[styles.infoCard, styles.infoCardBrand]}
          activeOpacity={onSkip ? 0.7 : 1}
          onPress={onSkip}
          disabled={!onSkip}
        >
          <Ionicons name="time-outline" size={16} color={colors.primary[600]} />
          <Text style={styles.infoCardTitle}>Continue while we verify</Text>
          <Text style={styles.infoCardBody}>Skip this step and complete later from dashboard</Text>
        </TouchableOpacity>
        <View style={[styles.infoCard, styles.infoCardMuted]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary[600]} />
          <Text style={styles.infoCardTitle}>Bank-level encryption</Text>
          <Text style={styles.infoCardBody}>Your documents are stored securely</Text>
        </View>
      </View>

      {/* Required documents */}
      {renderSectionHeader('alert-circle-outline', 'Required Documents', coreDoneCount, 3, 'danger')}
      {renderDocCard({ docType: CORE_PAN, label: 'PAN Card', mode: 'upload', autoVerifiable: true, required: true })}
      {renderDocCard({ docType: CORE_AADHAAR, label: 'Aadhaar Card', mode: 'aadhaar', autoVerifiable: true, required: true })}
      {renderDocCard({ docType: CORE_BANK, label: 'Bank Account Proof', mode: 'bank', required: true, stacked: true })}

      {/* Activity-specific */}
      {activitySpecific.length > 0 ? (
        <>
          {renderSectionHeader('document-text-outline', 'Activity-Specific', activityDoneCount, activitySpecific.length, 'brand')}
          {activitySpecific.map((r) =>
            renderDocCard({
              docType: r.docType,
              label: r.label,
              description: r.description,
              mode: 'upload',
              autoVerifiable: r.autoVerifiable,
              tier: r.tier,
            }),
          )}
        </>
      ) : null}

      {/* Optional — boost tier (collapsible) */}
      {optional.length > 0 ? (
        <>
          <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: themeColors.backgroundSecondary }]}
            onPress={() => setShowOptional((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons name="ribbon-outline" size={15} color={themeColors.textSecondary} />
            <Text style={[styles.sectionHeaderTitle, { color: themeColors.textSecondary }]}>
              Optional — Boost your tier
            </Text>
            <Text style={[styles.sectionHeaderCount, { color: themeColors.textSecondary }]}>
              ({optionalDoneCount}/{optional.length})
            </Text>
            <Ionicons
              name={showOptional ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={themeColors.textSecondary}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
          {showOptional
            ? optional.map((r) =>
                renderDocCard({
                  docType: r.docType,
                  label: r.label,
                  description: r.description,
                  mode: 'upload',
                  autoVerifiable: r.autoVerifiable,
                  tier: r.tier,
                }),
              )
            : null}
        </>
      ) : null}

      {/* Privacy */}
      <View style={[styles.privacyCard, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Ionicons name="lock-closed" size={16} color={themeColors.textSecondary} />
        <Text style={[styles.privacyText, { color: themeColors.textSecondary }]}>
          <Text style={styles.privacyBold}>Privacy Protected: </Text>
          Your documents are encrypted and only visible to our verification team. We never share your
          information with third parties.
        </Text>
      </View>
    </View>
  );
}

export const VerifyIdentity = forwardRef(VerifyIdentityInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'] },

  heading: { marginBottom: spacing.xs },
  headingTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, textAlign: 'center' },
  headingSub: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },

  // KYC card
  kycCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  kycTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kycLevelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kycLevelText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[700] },
  kycPercent: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[600] },
  kycTrack: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  kycFill: { height: '100%', borderRadius: borderRadius.full, backgroundColor: colors.primary[500] },
  kycMarkers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  kycMarker: { fontSize: fontSize.xs },
  kycMarkerActive: { fontWeight: fontWeight.bold },

  // Info cards
  infoRow: { flexDirection: 'row', gap: spacing.md },
  infoCard: { flex: 1, borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md, gap: 2 },
  infoCardBrand: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  infoCardMuted: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  infoCardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[700], marginTop: 2 },
  infoCardBody: { fontSize: fontSize.xs, color: colors.primary[600], lineHeight: 16 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  sectionHeaderTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  sectionHeaderCount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Doc card
  docCard: { padding: spacing.lg },
  docRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dropZone: {
    width: 76,
    height: 76,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dropZoneStatic: { borderStyle: 'solid' },
  dropZoneDone: { borderColor: colors.success, backgroundColor: colors.successLight },
  dropZoneText: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.primary[600] },
  docInfo: { flex: 1, gap: spacing.xs },
  docInfoStacked: { flex: 0, width: '100%', alignItems: 'center' },
  docRowStacked: { flexDirection: 'column', alignItems: 'center', gap: spacing.md },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  docTitleRowStacked: { justifyContent: 'center' },
  docTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  reqMark: { color: colors.error, fontWeight: fontWeight.bold },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  tagRowStacked: { justifyContent: 'center' },
  docHint: { fontSize: fontSize.xs, lineHeight: 16 },
  textCenter: { textAlign: 'center' },

  autoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  autoPillText: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.primary[700] },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  tierPillText: { fontSize: 10, fontWeight: fontWeight.semibold, color: '#a16207', textTransform: 'capitalize' },

  // Aadhaar CTA
  aadhaarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: DIGILOCKER_GREEN,
  },
  aadhaarBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#ffffff' },
  btnBusy: { opacity: 0.7 },

  // Bank fields
  bankBlock: { marginTop: spacing.md, gap: spacing.sm },
  bankFields: { flexDirection: 'column', gap: spacing.sm },
  bankField: { width: '100%' },
  bankFieldLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  bankConfirm: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bankConfirmText: { flex: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.success },
  bankNote: { fontSize: fontSize.xs, lineHeight: 16 },

  // Rejected
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
  },
  rejectedText: { flex: 1, fontSize: fontSize.xs, color: colors.error, lineHeight: 16 },

  // Privacy
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
  },
  privacyText: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
  privacyBold: { fontWeight: fontWeight.bold },
});
