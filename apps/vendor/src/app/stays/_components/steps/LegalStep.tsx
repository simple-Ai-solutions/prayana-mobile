// Step 5 — who runs the property, its GST status and the documents that show
// it may host guests. The business KYC (PAN, bank, ID) is done once for the
// vendor account; this step only asks what's specific to this property.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { staysAPI } from '../api';
import { useBusinessStore } from '@prayana/shared-stores';
import { Button, TextInput } from '../../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../../theme/vendorColors';
import { usePalette, Section, OptionCard, Segmented, SelectField, ChoiceSheet } from '../controls';
import {
  GSTIN_RE,
  LICENCE_TYPES,
  LegalDraft,
  Licence,
  MAX_LICENCE_BYTES,
  OWNERSHIP_TYPES,
  StepProps,
  UploadFile,
  apiError,
  stateByGstin,
  stateByName,
  toUploadFile,
} from '../stayConfig';

const LICENCE_STATUS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'amber' | 'green' | 'red' }> = {
  under_review: { label: 'Under review', icon: 'time-outline', tone: 'amber' },
  verified: { label: 'Verified', icon: 'checkmark-circle', tone: 'green' },
  rejected: { label: 'Not accepted', icon: 'close-circle', tone: 'red' },
};

function LicenceUploader({ stayId, existingTypes, onUploaded }: { stayId: string; existingTypes: string[]; onUploaded: (data: any) => void }) {
  const p = usePalette();
  const [type, setType] = useState(() => LICENCE_TYPES.find((l) => l.proof && !existingTypes.includes(l.id))?.id || 'trade_licence');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [chooser, setChooser] = useState(false);
  const info = LICENCE_TYPES.find((l) => l.id === type);

  const upload = async (file: UploadFile, size?: number | null) => {
    if (size && size > MAX_LICENCE_BYTES) {
      Toast.show({ type: 'error', text1: 'That file is over 10 MB', text2: 'Try a smaller scan or a photo.' });
      return;
    }
    setBusy(true);
    try {
      const res: any = await staysAPI.uploadLicence(stayId, { file, type, number: number.trim() || undefined });
      if (res?.success === false) throw new Error(res.message);
      onUploaded(res?.data);
      setNumber('');
      Toast.show({ type: 'success', text1: 'Document added', text2: 'Our team will check it.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't upload the document", text2: apiError(e, 'Try again.') });
    } finally {
      setBusy(false);
    }
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph the document.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!r.canceled && r.assets?.[0]) upload(toUploadFile(r.assets[0], `${type}.jpg`), r.assets[0].fileSize);
  };
  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photo access needed', 'Allow photo library access in Settings to pick the document.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!r.canceled && r.assets?.[0]) upload(toUploadFile(r.assets[0], `${type}.jpg`), r.assets[0].fileSize);
  };
  const fromFiles = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets?.[0]) upload(toUploadFile(r.assets[0], `${type}.pdf`), r.assets[0].size);
  };

  return (
    <View style={[styles.uploader, { borderColor: p.c.border }]}>
      <SelectField
        label="Document"
        value={type}
        options={LICENCE_TYPES.map((l) => ({
          value: l.id,
          label: `${l.label}${existingTypes.includes(l.id) && l.id !== 'other' ? ' (replace)' : ''}`,
          hint: l.hint,
        }))}
        onChange={setType}
        hint={info?.hint}
      />
      <TextInput label="Number on it (optional)" value={number} onChangeText={setNumber} maxLength={60} placeholder="Registration / licence no." autoCapitalize="characters" />
      <Button
        title="Choose file (PDF or photo)"
        variant="outline"
        onPress={() => setChooser(true)}
        loading={busy}
        icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.primary[500]} />}
        fullWidth
      />
      <ChoiceSheet
        visible={chooser}
        title="Add the document"
        message={info?.label}
        onClose={() => setChooser(false)}
        options={[
          { label: 'Take a photo of it', icon: 'camera-outline', onPress: fromCamera },
          { label: 'Choose a photo', icon: 'images-outline', onPress: fromLibrary },
          { label: 'Choose a PDF or file', icon: 'document-outline', onPress: fromFiles },
        ]}
      />
    </View>
  );
}

export default function LegalStep({ draft, update, stay, applyServer }: StepProps) {
  const p = usePalette();
  const router = useRouter();
  const business = useBusinessStore((s: any) => s.businessAccount);
  const legal = draft.legal;
  const licences: Licence[] = stay.legal?.licences || [];
  const [removing, setRemoving] = useState<string | null>(null);
  const setLegal = (patch: Partial<LegalDraft>) => update((d) => ({ legal: { ...d.legal, ...patch } }));

  const gstin = (legal.gstin || '').toUpperCase();
  const gstinValid = GSTIN_RE.test(gstin);
  const propertyState = stateByName(draft.location?.state);
  const gstinState = gstinValid ? stateByGstin(gstin) : null;
  const stateMismatch = gstinValid && propertyState && gstinState && propertyState.gstCode !== gstinState.gstCode;
  const businessGstin: string | null = business?.gstDetails?.gstin || null;
  const hasProof = licences.some((l) => l.status !== 'rejected' && LICENCE_TYPES.find((t) => t.id === l.type)?.proof);
  const kyc: string | undefined = business?.verificationStatus;

  const applyLicences = (data: any) =>
    applyServer({ legal: { ...(stay.legal || {}), licences: data?.licences || [] }, completeness: data?.completeness });

  const removeLicence = (l: Licence) =>
    Alert.alert('Remove this document?', LICENCE_TYPES.find((t) => t.id === l.type)?.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoving(l._id);
          try {
            const res: any = await staysAPI.deleteLicence(stay._id, l._id);
            applyLicences(res?.data);
          } catch (e) {
            Toast.show({ type: 'error', text1: "Couldn't remove it", text2: apiError(e, 'Try again.') });
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);

  return (
    <View>
      <Section title="Who owns or runs the property?">
        <View style={styles.cards} accessibilityRole="radiogroup">
          {OWNERSHIP_TYPES.map((o) => (
            <OptionCard key={o.id} selected={legal.ownership === o.id} onPress={() => setLegal({ ownership: o.id })} title={o.label} hint={o.hint} />
          ))}
        </View>
      </Section>

      <Section title="Legal name" hint="The name on the property's licence or registration. Often different from the name guests see.">
        <TextInput
          value={legal.legalName || ''}
          onChangeText={(t) => setLegal({ legalName: t })}
          maxLength={120}
          placeholder="e.g. Sri Lakshmi Enterprises"
          accessibilityLabel="Legal name"
          containerStyle={styles.noGap}
        />
      </Section>

      <Section title="GST" hint="Is this property registered for GST?">
        <Segmented
          label="GST registered"
          value={legal.gstRegistered === true ? 'yes' : legal.gstRegistered === false ? 'no' : null}
          onChange={(v) => setLegal({ gstRegistered: v === 'yes', ...(v === 'no' ? { gstin: '' } : {}) })}
          options={[
            { id: 'yes', label: 'Yes, it has a GSTIN' },
            { id: 'no', label: 'No' },
          ]}
        />
        {legal.gstRegistered === true ? (
          <View>
            <TextInput
              label="GSTIN for this property's state"
              value={gstin}
              onChangeText={(t) => setLegal({ gstin: t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15) })}
              maxLength={15}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="29ABCDE1234F1Z5"
              error={gstin.length === 15 && !gstinValid ? "That doesn't look like a GSTIN. Check the 15 characters." : undefined}
              hint={gstinState ? `Registered in ${gstinState.name}` : '15 characters, from your GST certificate.'}
              containerStyle={styles.noGap}
            />
            {businessGstin && businessGstin !== gstin ? (
              <TouchableOpacity onPress={() => setLegal({ gstin: businessGstin })} accessibilityRole="button" style={styles.linkBtn}>
                <Text style={[styles.link, { color: p.brand }]}>Use your business GSTIN ({businessGstin})</Text>
              </TouchableOpacity>
            ) : null}
            {stateMismatch && gstinState && propertyState ? (
              <View style={styles.warnRow}>
                <Ionicons name="warning-outline" size={14} color={p.warning} style={styles.warnIcon} />
                <Text style={[styles.warnText, { color: p.warning }]}>
                  This GSTIN is from {gstinState.name}, but the property is in {propertyState.name}. GST registration is per state; use the GSTIN for {propertyState.name}.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {legal.gstRegistered === false ? (
          <Text style={[styles.muted, { color: p.c.textSecondary }]}>That's fine. Many small properties aren't registered. You can add a GSTIN later.</Text>
        ) : null}
      </Section>

      <Section
        title="Licence or registration"
        hint="Upload at least one: a trade licence, homestay registration, tourism registration, or a property tax receipt / electricity bill for the property. Our team checks it before you go live."
      >
        {licences.map((l) => {
          const t = LICENCE_TYPES.find((x) => x.id === l.type);
          const st = LICENCE_STATUS[l.status] || LICENCE_STATUS.under_review;
          const tone = p.soft[st.tone];
          return (
            <View key={l._id} style={[styles.licence, { borderColor: p.c.border, backgroundColor: p.c.surface }]}>
              <Ionicons name="document-text-outline" size={22} color={p.c.textTertiary} />
              <View style={styles.flex}>
                <Text style={[styles.licenceName, { color: p.c.text }]}>{t?.label || l.type}</Text>
                {[l.number, l.fileName].filter(Boolean).length ? (
                  <Text style={[styles.small, { color: p.c.textTertiary }]} numberOfLines={1}>
                    {[l.number, l.fileName].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                  <Ionicons name={st.icon} size={12} color={tone.fg} />
                  <Text style={[styles.statusText, { color: tone.fg }]}>{st.label}</Text>
                </View>
                {l.status === 'rejected' && l.reviewNote ? <Text style={[styles.small, { color: p.danger }]}>{l.reviewNote}</Text> : null}
              </View>
              {l.status !== 'verified' ? (
                <TouchableOpacity
                  onPress={() => removeLicence(l)}
                  disabled={removing === l._id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${t?.label || 'document'}`}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  {removing === l._id ? <ActivityIndicator size="small" color={p.danger} /> : <Ionicons name="trash-outline" size={20} color={p.danger} />}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
        {!hasProof && licences.length > 0 ? (
          <Text style={[styles.small, { color: p.warning }]}>
            Add one of: trade licence, homestay registration, tourism registration, or property tax receipt / electricity bill.
          </Text>
        ) : null}
        <LicenceUploader stayId={stay._id} existingTypes={licences.map((l) => l.type)} onUploaded={applyLicences} />
        <Text style={[styles.small, { color: p.c.textTertiary }]}>Documents are stored privately. Only Prayana's verification team can open them.</Text>
      </Section>

      <View style={[styles.kyc, { backgroundColor: p.soft.gray.bg }]}>
        <Ionicons name="shield-checkmark-outline" size={22} color={kyc === 'approved' ? p.success : p.c.textTertiary} />
        <View style={styles.flex}>
          <Text style={[styles.kycTitle, { color: p.c.text }]}>
            Business verification: {kyc === 'approved' ? 'done' : kyc ? kyc.replace(/_/g, ' ') : 'not started'}
          </Text>
          <Text style={[styles.muted, { color: p.c.textSecondary }]}>
            Your PAN, bank account and ID are verified once for your whole business, not for each property.
          </Text>
          {kyc !== 'approved' ? (
            <TouchableOpacity onPress={() => router.push('/verification')} accessibilityRole="link" style={styles.linkBtn}>
              <Text style={[styles.link, { color: p.brand }]}>Finish verification</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  noGap: { marginBottom: 0 },
  cards: { gap: spacing.sm },
  muted: { fontSize: fontSize.sm, lineHeight: 19 },
  small: { fontSize: fontSize.xs, lineHeight: 16, marginTop: 2 },
  linkBtn: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  warnRow: { flexDirection: 'row', gap: 6, marginTop: spacing.xs },
  warnIcon: { marginTop: 1 },
  warnText: { flex: 1, fontSize: fontSize.xs, lineHeight: 16 },
  uploader: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: borderRadius.xl, padding: spacing.md },
  licence: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  licenceName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: fontWeight.semibold },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  kyc: { flexDirection: 'row', gap: spacing.md, borderRadius: borderRadius.xl, padding: spacing.lg },
  kycTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: 2 },
});
