import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput as RNTextInput,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';
import type { RequiredDocumentConfig } from './TypeSpecificFields';

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface PickedDocFile {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
}

export interface UploadedActivityDoc {
  docKey: string;
  /** Local uri for fresh picks; server URL for docs loaded in edit mode. */
  url: string;
  file?: PickedDocFile | null;
  expiryDate?: string | null;
  status?: string;
}

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB cap, same as the web uploader
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_URL_RE = /\.(jpe?g|png|webp|gif|heic)($|\?)/i;

function isImageDoc(doc: UploadedActivityDoc): boolean {
  if (doc.file?.type?.startsWith('image/')) return true;
  return IMAGE_URL_RE.test(doc.url || '');
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusPill(status?: string): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'auto_verified':
      return { label: 'Auto-Verified', bg: colors.successLight, fg: colors.success };
    case 'manually_verified':
    case 'verified':
      return { label: 'Verified', bg: colors.successLight, fg: colors.success };
    case 'rejected':
      return { label: 'Rejected', bg: colors.errorLight, fg: colors.error };
    case 'expired':
      return { label: 'Expired', bg: colors.errorLight, fg: colors.error };
    case 'pending':
    default:
      return { label: 'Pending Review', bg: colors.warningLight, fg: '#854d0e' };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────────

/**
 * ActivityDocumentUploader — compliance documents driven by
 * ActivityTypeConfig.requiredDocuments. Files stay local ({uri,name,type})
 * until the listing is created; the form ships docKey/url/expiryDate in the
 * payload exactly like the web (which also sent local object URLs — a
 * server-side upload endpoint for activity docs doesn't exist yet).
 */
export default function ActivityDocumentUploader({
  requiredDocuments = [],
  uploadedDocs = [],
  onUpload,
  onRemove,
}: {
  requiredDocuments?: RequiredDocumentConfig[];
  uploadedDocs?: UploadedActivityDoc[];
  onUpload: (docKey: string, file: PickedDocFile, expiryDate: string | null) => void;
  onRemove: (docKey: string) => void;
}) {
  const { themeColors } = useTheme();
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});

  const requiredDocs = requiredDocuments.filter((d) => d.required);
  const optionalDocs = requiredDocuments.filter((d) => !d.required);

  const getUploadedDoc = (docKey: string) => uploadedDocs.find((d) => d.docKey === docKey);

  const acceptFile = useCallback(
    (docKey: string, file: PickedDocFile) => {
      if (file.size != null && file.size > MAX_DOC_BYTES) {
        Toast.show({ type: 'error', text1: 'File too large', text2: 'Documents must be under 10MB.' });
        return;
      }
      const expiry = expiryDates[docKey];
      onUpload(docKey, file, expiry && DATE_RE.test(expiry) ? expiry : null);
    },
    [expiryDates, onUpload],
  );

  const pickImage = useCallback(async (): Promise<PickedDocFile | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need photo library access to upload documents.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    return {
      uri: a.uri,
      name: a.fileName || a.uri.split('/').pop() || 'document.jpg',
      type: a.mimeType || 'image/jpeg',
      size: a.fileSize,
    };
  }, []);

  const pickDoc = useCallback(async (): Promise<PickedDocFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    return {
      uri: a.uri,
      name: a.name || a.uri.split('/').pop() || 'document.pdf',
      type: a.mimeType || 'application/pdf',
      size: a.size,
    };
  }, []);

  const handlePick = useCallback(
    (doc: RequiredDocumentConfig) => {
      Alert.alert(
        doc.label,
        'Choose how to upload this document.',
        [
          {
            text: 'Photo Library',
            onPress: async () => {
              const f = await pickImage();
              if (f) acceptFile(doc.docKey, f);
            },
          },
          {
            text: 'Browse Files',
            onPress: async () => {
              const f = await pickDoc();
              if (f) acceptFile(doc.docKey, f);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [pickImage, pickDoc, acceptFile],
  );

  if (requiredDocuments.length === 0) return null;

  const requiredCount = requiredDocs.filter((d) => getUploadedDoc(d.docKey)).length;
  const totalRequired = requiredDocs.length;

  const renderDocCard = (doc: RequiredDocumentConfig) => {
    const uploaded = getUploadedDoc(doc.docKey);
    const pill = uploaded ? statusPill(uploaded.status) : null;
    const expiry = expiryDates[doc.docKey] || '';
    const expiryInvalid =
      !!expiry && (!DATE_RE.test(expiry) || expiry < todayISO());

    return (
      <View
        key={doc.docKey}
        style={[
          styles.docCard,
          {
            backgroundColor: themeColors.surface,
            borderColor: uploaded ? colors.primary[300] : themeColors.border,
          },
        ]}
      >
        {/* Header: title + required badge */}
        <View style={styles.docHeader}>
          <Ionicons name="document-text-outline" size={16} color={themeColors.textTertiary} />
          <Text style={[styles.docLabel, { color: themeColors.text }]}>{doc.label}</Text>
          <View style={[styles.reqBadge, { backgroundColor: doc.required ? colors.errorLight : themeColors.inputBackground }]}>
            <Text style={[styles.reqBadgeText, { color: doc.required ? colors.error : themeColors.textTertiary }]}>
              {doc.required ? 'REQUIRED' : 'OPTIONAL'}
            </Text>
          </View>
        </View>

        {doc.description ? (
          <Text style={[styles.docDesc, { color: themeColors.textSecondary }]}>{doc.description}</Text>
        ) : null}

        {doc.regulatoryBody ? (
          <View style={styles.regulatoryRow}>
            <Ionicons name="shield-outline" size={13} color={colors.primary[500]} />
            <Text style={styles.regulatoryText}>Issued by: {doc.regulatoryBody}</Text>
          </View>
        ) : null}

        {/* Expiry date input — only before the doc is attached (like the web) */}
        {doc.hasExpiry && !uploaded ? (
          <View style={styles.expiryBlock}>
            <Text style={[styles.expiryLabel, { color: themeColors.textSecondary }]}>
              Expiry date
            </Text>
            <RNTextInput
              value={expiry}
              onChangeText={(t) => setExpiryDates((prev) => ({ ...prev, [doc.docKey]: t }))}
              placeholder={`YYYY-MM-DD (after ${todayISO()})`}
              placeholderTextColor={themeColors.textTertiary}
              style={[
                styles.expiryInput,
                {
                  backgroundColor: themeColors.field,
                  borderColor: expiryInvalid ? colors.error : themeColors.fieldBorder,
                  color: themeColors.text,
                },
              ]}
              maxLength={10}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {expiryInvalid && (
              <Text style={styles.expiryError}>Enter a future date as YYYY-MM-DD</Text>
            )}
          </View>
        ) : null}

        {/* Uploaded state: status pill + expiry + preview */}
        {uploaded ? (
          <View style={styles.uploadedBlock}>
            <View style={styles.pillRow}>
              {pill && (
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                </View>
              )}
              {uploaded.expiryDate ? (
                <Text style={[styles.expiryNote, { color: themeColors.textTertiary }]}>
                  Expires: {uploaded.expiryDate}
                </Text>
              ) : null}
            </View>
            <View style={styles.previewRow}>
              {isImageDoc(uploaded) ? (
                <Image source={{ uri: uploaded.url }} style={styles.previewImage} />
              ) : (
                <View style={styles.pdfTile}>
                  <Ionicons name="document-outline" size={22} color={colors.error} />
                  <Text style={styles.pdfTileText}>PDF</Text>
                </View>
              )}
              <Text
                style={[styles.previewName, { color: themeColors.textSecondary }]}
                numberOfLines={1}
              >
                {uploaded.file?.name || uploaded.url.split('/').pop() || 'Document'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => handlePick(doc)}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={15} color="#ffffff" />
            <Text style={styles.uploadBtnText}>{uploaded ? 'Change' : 'Upload'}</Text>
          </TouchableOpacity>
          {uploaded && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemove(doc.docKey)}
              activeOpacity={0.7}
              accessibilityLabel={`Remove ${doc.label}`}
            >
              <Ionicons name="close" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header + progress */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="document-text-outline" size={16} color={colors.primary[500]} />
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            Activity-Specific Documents
          </Text>
        </View>
        {totalRequired > 0 && (
          <Text
            style={[
              styles.progressText,
              { color: requiredCount === totalRequired ? colors.success : colors.primary[500] },
            ]}
          >
            {requiredCount}/{totalRequired} required uploaded
          </Text>
        )}
      </View>

      {/* Compliance notice */}
      <View style={styles.notice}>
        <Ionicons name="alert-circle-outline" size={15} color={colors.primary[500]} />
        <Text style={styles.noticeText}>
          These documents are specific to your activity type. Required documents must be
          uploaded before your listing can be approved.
        </Text>
      </View>

      {requiredDocs.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.error }]}>REQUIRED FOR APPROVAL</Text>
          {requiredDocs.map(renderDocCard)}
        </View>
      )}

      {optionalDocs.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: themeColors.textTertiary }]}>
            RECOMMENDED (BOOSTS TRUST)
          </Text>
          {optionalDocs.map(renderDocCard)}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: spacing.md },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  progressText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  noticeText: { flex: 1, fontSize: fontSize.xs, color: colors.primary[700], lineHeight: 16 },

  group: { gap: spacing.sm },
  groupTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.8 },

  docCard: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docLabel: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  reqBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  reqBadgeText: { fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  docDesc: { fontSize: fontSize.xs, lineHeight: 16 },

  regulatoryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  regulatoryText: { flex: 1, fontSize: fontSize.xs, color: colors.primary[600] },

  expiryBlock: { gap: spacing.xs },
  expiryLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  expiryInput: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  expiryError: { fontSize: fontSize.xs, color: colors.error },

  uploadedBlock: { gap: spacing.sm },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  pillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  expiryNote: { fontSize: fontSize.xs },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: '#00000010',
  },
  pdfTile: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfTileText: { fontSize: 8, color: colors.error, fontWeight: fontWeight.bold, marginTop: 1 },
  previewName: { flex: 1, fontSize: fontSize.xs },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  uploadBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: '#ffffff' },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
  },
});
