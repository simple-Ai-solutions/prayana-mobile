// EsimQRCode — RN port of components/esim/EsimQRCode.jsx.
//
// Matrix returns the QR as `fulfillment.base64QRCode`, so it renders as a plain
// <Image> and needs no QR library. When only the SM-DP+ address and activation
// code are available we show those instead, with copy buttons — that is the
// manual install path Apple documents, and it works without any QR at all.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

const ACCENT_RED = '#E61417';

interface Props {
  installUrl?: string | null;
  smdpAddress?: string | null;
  activationCode?: string | null;
  iccid?: string | null;
  base64QRCode?: string | null;
}

export const EsimQRCode: React.FC<Props> = ({
  installUrl,
  smdpAddress,
  activationCode,
  base64QRCode,
}) => {
  const { themeColors } = useTheme();
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Strip any data: prefix — the API sometimes sends the payload bare.
  const clean = base64QRCode?.replace(/^data:image\/\w+;base64,/, '') ?? null;
  const qrUri = clean ? `data:image/png;base64,${clean}` : null;

  const copy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    Toast.show({ type: 'success', text1: `${label} copied` });
  };

  const hasManual = !!smdpAddress || !!activationCode;

  return (
    <View
      style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
    >
      <Text style={[styles.title, { color: themeColors.text }]}>Your eSIM QR code</Text>

      {qrUri ? (
        <>
          <View style={styles.qrFrame}>
            <Image source={{ uri: qrUri }} style={styles.qr} resizeMode="contain" />
          </View>
          <Text style={[styles.caption, { color: themeColors.textSecondary }]}>
            Go to Settings → Cellular → Add eSIM and scan this code.
          </Text>
        </>
      ) : hasManual ? (
        // No QR image, but the manual credentials work just as well — say so
        // rather than leaving the customer staring at a spinner.
        <Text style={[styles.caption, { color: themeColors.textSecondary }]}>
          Install using the details below: Settings → Cellular → Add eSIM → Enter details manually.
        </Text>
      ) : (
        <View style={styles.pending}>
          <ActivityIndicator color={ACCENT_RED} />
          <Text style={[styles.caption, { color: themeColors.textSecondary }]}>
            Your QR code is being generated. This usually takes a few seconds.
          </Text>
        </View>
      )}

      {hasManual && (
        <>
          <TouchableOpacity
            onPress={() => setShowManual((v) => !v)}
            style={styles.manualToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: showManual }}
          >
            <Text style={[styles.manualToggleText, { color: ACCENT_RED }]}>
              Manual installation
            </Text>
            <Ionicons
              name={showManual ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={ACCENT_RED}
            />
          </TouchableOpacity>

          {showManual && (
            <View style={styles.manual}>
              {!!smdpAddress && (
                <Field
                  label="SM-DP+ address"
                  value={smdpAddress}
                  copied={copied === 'SM-DP+ address'}
                  onCopy={() => copy('SM-DP+ address', smdpAddress)}
                />
              )}
              {!!activationCode && (
                <Field
                  label="Activation code"
                  value={activationCode}
                  copied={copied === 'Activation code'}
                  onCopy={() => copy('Activation code', activationCode)}
                />
              )}
              {!!installUrl && (
                <Field
                  label="Install link"
                  value={installUrl}
                  copied={copied === 'Install link'}
                  onCopy={() => copy('Install link', installUrl)}
                />
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}> = ({ label, value, copied, onCopy }) => {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.fieldRow,
          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F3F4F6' },
        ]}
      >
        <Text style={[styles.fieldValue, { color: themeColors.text }]} numberOfLines={2}>
          {value}
        </Text>
        <TouchableOpacity
          onPress={onCopy}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label}`}
        >
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={17}
            color={copied ? '#16A34A' : themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },

  qrFrame: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  qr: { width: 220, height: 220 },

  caption: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  pending: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },

  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  manualToggleText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  manual: { width: '100%', gap: spacing.md, marginTop: spacing.sm },
  field: { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 0.4 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  fieldValue: { flex: 1, fontSize: fontSize.xs, fontFamily: 'Courier' },
});

export default EsimQRCode;
