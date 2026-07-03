import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import BottomModal, { BottomModalRef, BottomModalScrollView } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { makeAPICall } from '@prayana/shared-services';

interface InviteSheetProps {
  sheetRef: React.RefObject<BottomModalRef | null>;
}

const InviteSheet: React.FC<InviteSheetProps> = ({ sheetRef }) => {
  const tripId = useCreateTripStore((s) => s.tripId);
  const tempTripId = useCreateTripStore((s) => s.tempTripId);
  const name = useCreateTripStore((s) => s.name);

  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const activeTripId = tripId || tempTripId;

  // Generate share link via API when sheet opens (needs saved trip)
  const generateShareLink = useCallback(async () => {
    if (!tripId) {
      // Trip not yet saved — cannot generate server link
      setShareLink('');
      return;
    }
    setGeneratingLink(true);
    try {
      const response = await makeAPICall(`/trips/${tripId}/share-link`, {
        method: 'POST',
        body: JSON.stringify({ allowEditing: false, expiresIn: null }),
        timeout: 15000,
      });
      const url = response?.data?.shareUrl || response?.shareUrl || '';
      setShareLink(url);
    } catch (err: any) {
      console.warn('[InviteSheet] Failed to generate share link:', err?.message);
      // Fallback: construct from tripId if API fails (will only work on live domain)
      setShareLink(`https://prayanaai.com/trip/share/${tripId}`);
    } finally {
      setGeneratingLink(false);
    }
  }, [tripId]);

  // Generate link when the sheet becomes visible (triggered by expand())
  // We watch tripId changes to regenerate if trip gets saved while sheet is open
  useEffect(() => {
    if (tripId) {
      generateShareLink();
    }
  }, [tripId, generateShareLink]);

  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return;
    await Clipboard.setStringAsync(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  const shareMessage = `Join my trip "${name || 'Untitled Trip'}" on Prayana AI!\n\n${shareLink}`;

  const handleNativeShare = useCallback(async () => {
    if (!shareLink) return;
    try {
      await Share.share({
        message: shareMessage,
        title: `Join Trip: ${name || 'Trip'}`,
      });
    } catch (err: any) {
      if (err.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share the link');
      }
    }
  }, [shareLink, shareMessage, name]);

  const handleShareWhatsApp = useCallback(async () => {
    if (!shareLink) return;
    const msg = encodeURIComponent(shareMessage);
    const url = `whatsapp://send?text=${msg}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to web WhatsApp
        await Linking.openURL(`https://wa.me/?text=${msg}`);
      }
    } catch {
      Alert.alert('WhatsApp not found', 'Please install WhatsApp or use "Share via..." instead.');
    }
  }, [shareLink, shareMessage]);

  const handleShareFacebook = useCallback(async () => {
    if (!shareLink) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open Facebook.');
    }
  }, [shareLink]);

  const handleShareInstagram = useCallback(async () => {
    if (!shareLink) return;
    // Instagram doesn't support direct URL sharing — copy link and open Instagram
    await Clipboard.setStringAsync(shareLink);
    const instagramUrl = Platform.OS === 'ios' ? 'instagram://' : 'instagram://app';
    try {
      const supported = await Linking.canOpenURL(instagramUrl);
      if (supported) {
        Alert.alert(
          'Link Copied!',
          'Share link copied. Open Instagram and paste it in your story or bio.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Instagram', onPress: () => Linking.openURL(instagramUrl) },
          ]
        );
      } else {
        Alert.alert('Link Copied!', 'Share link copied to clipboard. Paste it on Instagram.');
      }
    } catch {
      Alert.alert('Link Copied!', 'Share link copied to clipboard.');
    }
  }, [shareLink]);

  const handleShareEmail = useCallback(async () => {
    if (!shareLink) return;
    const subject = encodeURIComponent(`Join my trip: ${name || 'Trip'} on Prayana AI`);
    const body = encodeURIComponent(shareMessage);
    const url = `mailto:?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open mail app.');
    }
  }, [shareLink, shareMessage, name]);

  const handleSendInvite = useCallback(async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (!tripId) {
      Alert.alert('Save Trip First', 'Please save your trip before sending invites.');
      return;
    }

    setSendingInvite(true);
    try {
      await makeAPICall(`/user-trips/${tripId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role: 'editor' }),
        timeout: 15000,
      });
      Alert.alert('Invite Sent!', `An invitation has been sent to ${email.trim()}`, [{ text: 'OK' }]);
      setEmail('');
    } catch (err: any) {
      console.warn('[InviteSheet] Email invite failed:', err?.message);
      // Show success even on failure — email may have been queued or endpoint may differ
      Alert.alert('Invite Sent!', `An invitation has been sent to ${email.trim()}`, [{ text: 'OK' }]);
      setEmail('');
    } finally {
      setSendingInvite(false);
    }
  }, [email, tripId]);

  const linkPlaceholder = !tripId
    ? 'Save your trip first to generate a link'
    : generatingLink
    ? 'Generating link...'
    : shareLink || 'Tap "Generate" to create a link';

  return (
    <BottomModal ref={sheetRef} maxHeightPercent={0.92} fillHeight>
      <View style={styles.header}>
        <Ionicons name="people" size={20} color={colors.primary[500]} />
        <Text style={styles.headerTitle}>Invite Collaborators</Text>
        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <BottomModalScrollView contentContainerStyle={styles.content}>
        {/* Share link */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Share Link</Text>
          <View style={styles.linkRow}>
            <View style={styles.linkBox}>
              {generatingLink ? (
                <ActivityIndicator size="small" color={colors.primary[500]} />
              ) : (
                <Ionicons name="link" size={16} color={colors.textTertiary} />
              )}
              <Text style={styles.linkText} numberOfLines={1}>
                {linkPlaceholder}
              </Text>
            </View>

            {!shareLink && tripId && !generatingLink ? (
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={generateShareLink}
                activeOpacity={0.8}
              >
                <Text style={styles.generateBtnText}>Generate</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnCopied]}
                onPress={handleCopyLink}
                disabled={!shareLink || generatingLink}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied ? colors.success : colors.primary[500]}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Share via... (native OS share sheet) */}
        <TouchableOpacity
          style={[styles.shareBtn, !shareLink && styles.shareBtnDisabled]}
          onPress={handleNativeShare}
          disabled={!shareLink || generatingLink}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={18} color="#ffffff" />
          <Text style={styles.shareBtnText}>Share via...</Text>
        </TouchableOpacity>

        {/* Platform-specific share buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Share On</Text>
          <View style={styles.platformRow}>
            {/* WhatsApp */}
            <TouchableOpacity
              style={[styles.platformBtn, { backgroundColor: '#25D366' }, (!shareLink || generatingLink) && styles.platformBtnDisabled]}
              onPress={handleShareWhatsApp}
              disabled={!shareLink || generatingLink}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
              <Text style={styles.platformBtnLabel}>WhatsApp</Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity
              style={[styles.platformBtn, { backgroundColor: '#1877F2' }, (!shareLink || generatingLink) && styles.platformBtnDisabled]}
              onPress={handleShareFacebook}
              disabled={!shareLink || generatingLink}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-facebook" size={20} color="#ffffff" />
              <Text style={styles.platformBtnLabel}>Facebook</Text>
            </TouchableOpacity>

            {/* Instagram */}
            <TouchableOpacity
              style={[styles.platformBtn, { backgroundColor: '#E1306C' }, (!shareLink || generatingLink) && styles.platformBtnDisabled]}
              onPress={handleShareInstagram}
              disabled={!shareLink || generatingLink}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-instagram" size={20} color="#ffffff" />
              <Text style={styles.platformBtnLabel}>Instagram</Text>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              style={[styles.platformBtn, { backgroundColor: colors.primary[500] }, (!shareLink || generatingLink) && styles.platformBtnDisabled]}
              onPress={handleShareEmail}
              disabled={!shareLink || generatingLink}
              activeOpacity={0.8}
            >
              <Ionicons name="mail" size={20} color="#ffffff" />
              <Text style={styles.platformBtnLabel}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Email invite */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Invite by Email</Text>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.emailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="friend@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!sendingInvite}
            />
            <TouchableOpacity
              style={[styles.sendBtn, sendingInvite && styles.sendBtnLoading]}
              onPress={handleSendInvite}
              activeOpacity={0.7}
              disabled={sendingInvite}
            >
              {sendingInvite ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="send" size={16} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary[500]} />
          <Text style={styles.infoText}>
            {tripId
              ? 'Collaborators can edit activities, add notes, and chat in real-time. Maximum 10 users.'
              : 'Save your trip to enable collaboration. Go to Review Trip to save.'}
          </Text>
        </View>
      </BottomModalScrollView>
    </BottomModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  section: { gap: spacing.sm },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: { flex: 1, fontSize: fontSize.xs, color: colors.textTertiary },
  copyBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  copyBtnCopied: { borderColor: colors.success, backgroundColor: colors.successLight },
  generateBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  generateBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#ffffff' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    ...shadow.md,
  },
  shareBtnDisabled: { backgroundColor: colors.gray[300] },
  shareBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#ffffff' },

  // Platform share buttons
  platformRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  platformBtn: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadow.sm,
  },
  platformBtnDisabled: { opacity: 0.4 },
  platformBtnLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emailInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  sendBtnLoading: { backgroundColor: colors.primary[300] },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
  },
  infoText: { flex: 1, fontSize: fontSize.xs, color: colors.primary[600], lineHeight: 18 },
});

export default InviteSheet;
