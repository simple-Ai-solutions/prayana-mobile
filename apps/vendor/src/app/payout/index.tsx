import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

// ─── Types ──────────────────────────────────────────────────────────────────

type PayoutMethod = 'bank_transfer' | 'upi';

interface PayoutConfig {
  method?: PayoutMethod;
  bankDetails?: {
    accountHolderName?: string;
    accountNumber?: string; // masked when returned from server
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
  };
  upiId?: string;
  razorpayRoute?: {
    status?: string;
    accountId?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// The payout config can come back nested under several keys depending on the
// endpoint version. Normalize defensively into a single PayoutConfig shape.
function parseConfig(raw: any): PayoutConfig {
  const payload = raw?.data ?? raw?.payout ?? raw ?? {};
  const bank =
    payload.bankDetails ?? payload.bankAccount ?? payload.bank ?? undefined;
  return {
    method: payload.method ?? payload.payoutMethod ?? undefined,
    bankDetails: bank
      ? {
          accountHolderName:
            bank.accountHolderName ?? bank.holderName ?? bank.name ?? '',
          accountNumber: bank.accountNumber ?? bank.account ?? '',
          ifscCode: bank.ifscCode ?? bank.ifsc ?? '',
          bankName: bank.bankName ?? bank.bank ?? '',
          branchName: bank.branchName ?? bank.branch ?? '',
        }
      : undefined,
    upiId: payload.upiId ?? payload.upi ?? undefined,
    razorpayRoute: payload.razorpayRoute ?? payload.route ?? undefined,
  };
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function PayoutSettingsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [config, setConfig] = useState<PayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [method, setMethod] = useState<PayoutMethod>('bank_transfer');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');

  const hydrateForm = useCallback((cfg: PayoutConfig) => {
    setMethod(cfg.method ?? 'bank_transfer');
    setAccountHolderName(cfg.bankDetails?.accountHolderName ?? '');
    // Server returns a masked account number — leave the editable field blank
    // so the vendor consciously re-enters it; show the masked value as a hint.
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfscCode(cfg.bankDetails?.ifscCode ?? '');
    setBankName(cfg.bankDetails?.bankName ?? '');
    setBranchName(cfg.bankDetails?.branchName ?? '');
    setUpiId(cfg.upiId ?? '');
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await businessAPI.getPayoutConfig();
      const parsed = parseConfig(res);
      setConfig(parsed);
      hydrateForm(parsed);
    } catch (err: any) {
      console.warn('[Payout] fetch error:', err?.message);
    }
  }, [hydrateForm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchConfig();
    setLoading(false);
  }, [fetchConfig]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConfig();
    setRefreshing(false);
  }, [fetchConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maskedAccount = config?.bankDetails?.accountNumber
    ? `••••${String(config.bankDetails.accountNumber).slice(-4)}`
    : null;

  const handleSave = useCallback(async () => {
    // ── Validate ──────────────────────────────────────────────────────────
    if (method === 'bank_transfer') {
      if (!accountHolderName.trim()) {
        Toast.show({ type: 'error', text1: 'Account holder name is required' });
        return;
      }
      if (!accountNumber.trim()) {
        Toast.show({ type: 'error', text1: 'Account number is required' });
        return;
      }
      if (accountNumber.trim() !== confirmAccountNumber.trim()) {
        Toast.show({ type: 'error', text1: 'Account numbers do not match' });
        return;
      }
      const ifsc = ifscCode.trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        Toast.show({ type: 'error', text1: 'Enter a valid IFSC code' });
        return;
      }
    } else {
      const upi = upiId.trim();
      if (!/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upi)) {
        Toast.show({ type: 'error', text1: 'Enter a valid UPI ID' });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = { method };
      if (method === 'bank_transfer') {
        payload.bankDetails = {
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
          ...(branchName.trim() ? { branchName: branchName.trim() } : {}),
        };
      } else {
        payload.upiId = upiId.trim();
      }

      await businessAPI.configurePayout(payload);
      Toast.show({
        type: 'success',
        text1: 'Payout details saved',
        text2: 'Your payout method has been updated.',
      });
      await fetchConfig();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: err?.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [
    method,
    accountHolderName,
    accountNumber,
    confirmAccountNumber,
    ifscCode,
    bankName,
    branchName,
    upiId,
    fetchConfig,
  ]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Payout Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading payout settings..." />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary[500]}
              />
            }
          >
            {/* Current config summary */}
            {config && (config.method || maskedAccount || config.upiId) ? (
              <Card style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="card-outline" size={20} color={colors.primary[500]} />
                  <Text style={[styles.summaryTitle, { color: themeColors.text }]}>
                    Current Payout Method
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                    Method
                  </Text>
                  <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                    {config.method === 'upi' ? 'UPI' : 'Bank Transfer'}
                  </Text>
                </View>

                {config.method === 'upi' ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                      UPI ID
                    </Text>
                    <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                      {config.upiId || '-'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                        Account
                      </Text>
                      <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                        {maskedAccount || '-'}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                        IFSC
                      </Text>
                      <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                        {config.bankDetails?.ifscCode || '-'}
                      </Text>
                    </View>
                    {config.bankDetails?.bankName ? (
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                          Bank
                        </Text>
                        <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                          {config.bankDetails.bankName}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}

                {config.razorpayRoute?.status ? (
                  <View style={styles.routeRow}>
                    <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                      Razorpay Route
                    </Text>
                    <StatusBadge status={config.razorpayRoute.status} />
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Method selector */}
            <Card style={styles.formCard}>
              <Text style={[styles.formTitle, { color: themeColors.text }]}>
                Update Payout Method
              </Text>

              <View style={styles.segment}>
                {(
                  [
                    { key: 'bank_transfer', label: 'Bank Transfer', icon: 'business-outline' },
                    { key: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
                  ] as { key: PayoutMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[]
                ).map((opt) => {
                  const active = method === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      activeOpacity={0.8}
                      onPress={() => setMethod(opt.key)}
                      style={[
                        styles.segmentItem,
                        {
                          backgroundColor: active ? colors.primary[500] : themeColors.surface,
                          borderColor: active ? colors.primary[500] : themeColors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={active ? '#fff' : themeColors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          { color: active ? '#fff' : themeColors.textSecondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {method === 'bank_transfer' ? (
                <View style={styles.fields}>
                  <TextInput
                    label="Account Holder Name"
                    value={accountHolderName}
                    onChangeText={setAccountHolderName}
                    placeholder="As per bank records"
                    autoCapitalize="words"
                  />
                  <TextInput
                    label="Account Number"
                    value={accountNumber}
                    onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
                    placeholder={maskedAccount ? `Current: ${maskedAccount}` : 'Enter account number'}
                    keyboardType="number-pad"
                    hint={maskedAccount ? `Leave blank to keep ${maskedAccount}` : undefined}
                  />
                  <TextInput
                    label="Confirm Account Number"
                    value={confirmAccountNumber}
                    onChangeText={(t) => setConfirmAccountNumber(t.replace(/[^0-9]/g, ''))}
                    placeholder="Re-enter account number"
                    keyboardType="number-pad"
                  />
                  <TextInput
                    label="IFSC Code"
                    value={ifscCode}
                    onChangeText={(t) => setIfscCode(t.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    autoCapitalize="characters"
                    maxLength={11}
                  />
                  <TextInput
                    label="Bank Name (optional)"
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="e.g. HDFC Bank"
                  />
                  <TextInput
                    label="Branch Name (optional)"
                    value={branchName}
                    onChangeText={setBranchName}
                    placeholder="e.g. MG Road, Bangalore"
                  />
                </View>
              ) : (
                <View style={styles.fields}>
                  <TextInput
                    label="UPI ID"
                    value={upiId}
                    onChangeText={setUpiId}
                    placeholder="yourname@bank"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              <Button
                title="Save Payout Details"
                onPress={handleSave}
                size="lg"
                fullWidth
                loading={saving}
                style={styles.saveBtn}
                icon={<Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />}
              />
            </Card>

            <View style={styles.noteRow}>
              <Ionicons name="lock-closed-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.noteText, { color: themeColors.textTertiary }]}>
                Your bank details are encrypted and used only for verified payouts.
              </Text>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
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
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: spacing.xl,
  },

  // Summary
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },

  // Form
  formCard: {
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  fields: {
    marginBottom: spacing.sm,
  },
  saveBtn: {
    marginTop: spacing.sm,
  },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
