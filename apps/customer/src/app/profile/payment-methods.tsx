import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  EmptyState,
  TextInput,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { paymentMethodsAPI } from '@prayana/shared-services';

type SavedMethod = {
  _id: string;
  type: 'card' | 'upi' | 'netbanking';
  card?: {
    brand?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    holderName?: string;
  };
  upi?: { vpa?: string };
  netbanking?: { bankName?: string };
  isDefault?: boolean;
  nickname?: string;
};

const BRAND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  visa: 'card-outline',
  mastercard: 'card-outline',
  amex: 'card-outline',
  rupay: 'card-outline',
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Add UPI modal
  const [showAddUpi, setShowAddUpi] = useState(false);
  const [vpa, setVpa] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await paymentMethodsAPI.list();
      setMethods(res?.data || res?.methods || []);
    } catch (err: any) {
      console.warn('[PaymentMethods] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setDefault = async (m: SavedMethod) => {
    try {
      const res = await paymentMethodsAPI.update(m._id, { isDefault: true });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Default updated' });
        await fetch();
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Failed' });
    }
  };

  const remove = (m: SavedMethod) => {
    Alert.alert(
      'Remove method',
      'You can re-save it from any future checkout.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await paymentMethodsAPI.remove(m._id);
              if (res?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Toast.show({ type: 'success', text1: 'Removed' });
                await fetch();
              }
            } catch {
              Toast.show({ type: 'error', text1: 'Failed' });
            }
          },
        },
      ],
    );
  };

  const saveUpi = async () => {
    const trimmed = vpa.trim();
    if (!/^[\w.\-]+@[\w]+$/.test(trimmed)) {
      Toast.show({ type: 'error', text1: 'Invalid VPA', text2: 'Format: name@upi' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await paymentMethodsAPI.saveUpi({ vpa: trimmed });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'UPI saved' });
        setShowAddUpi(false);
        setVpa('');
        await fetch();
      } else {
        Toast.show({ type: 'error', text1: 'Could not save', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Saved methods</Text>
        <TouchableOpacity onPress={() => setShowAddUpi(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add" size={26} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={[styles.banner, isDarkMode && { backgroundColor: themeColors.card }]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary[600]} />
          <Text style={[styles.bannerText, { color: themeColors.textSecondary }]}>
            Cards are tokenized by Razorpay — we never store your full card number. UPI and bank
            references are encrypted at rest.
          </Text>
        </Card>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : methods.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="card-outline" size={56} color={colors.gray[300]} />}
            title="No saved methods"
            description="Save a card or UPI ID once during checkout to enable one-tap payments."
            actionLabel="Add UPI"
            onAction={() => setShowAddUpi(true)}
          />
        ) : (
          methods.map((m) => (
            <Card key={m._id} style={[styles.methodCard, { backgroundColor: themeColors.card }]}>
              <View style={styles.methodHead}>
                <View style={styles.iconBubble}>
                  <Ionicons
                    name={
                      m.type === 'card'
                        ? (BRAND_ICON[m.card?.brand?.toLowerCase() || ''] || 'card-outline')
                        : m.type === 'upi'
                          ? 'phone-portrait-outline'
                          : 'business-outline'
                    }
                    size={20}
                    color={colors.primary[600]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.methodLabel, { color: themeColors.text }]}>
                    {m.type === 'card'
                      ? `${m.card?.brand?.toUpperCase() || 'Card'} ····${m.card?.last4 || '••••'}`
                      : m.type === 'upi'
                        ? m.upi?.vpa || 'UPI'
                        : m.netbanking?.bankName || 'Net banking'}
                  </Text>
                  <Text style={[styles.methodMeta, { color: themeColors.textSecondary }]}>
                    {m.type === 'card' && m.card?.expiryMonth && m.card?.expiryYear
                      ? `Exp ${String(m.card.expiryMonth).padStart(2, '0')}/${String(m.card.expiryYear).slice(-2)}`
                      : m.nickname || ''}
                  </Text>
                </View>
                {m.isDefault ? <Badge label="Default" variant="primary" size="sm" /> : null}
              </View>
              <View style={styles.methodActions}>
                {!m.isDefault ? (
                  <Button title="Set default" onPress={() => setDefault(m)} variant="outline" size="sm" />
                ) : null}
                <Button title="Remove" onPress={() => remove(m)} variant="ghost" size="sm" />
              </View>
            </Card>
          ))
        )}

        {methods.length > 0 ? (
          <Button
            title="Add UPI ID"
            onPress={() => setShowAddUpi(true)}
            variant="outline"
            size="md"
            fullWidth
            icon={<Ionicons name="add" size={18} color={colors.primary[500]} />}
          />
        ) : null}
      </ScrollView>

      {/* Add UPI modal */}
      <Modal
        visible={showAddUpi}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddUpi(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Add UPI ID</Text>
            <TouchableOpacity onPress={() => setShowAddUpi(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.helperText, { color: themeColors.textSecondary }]}>
                One-tap UPI payments at checkout. We'll send a collect request to this VPA.
              </Text>
              <TextInput
                label="UPI VPA"
                value={vpa}
                onChangeText={setVpa}
                placeholder="yourname@okhdfcbank"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </ScrollView>
            <View style={[styles.modalFooter, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
              <Button
                title="Save UPI"
                onPress={saveUpi}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting || !vpa.trim()}
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

  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
  },
  bannerText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  methodCard: { padding: spacing.lg, gap: spacing.md, marginBottom: spacing.sm },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  methodMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  methodActions: { flexDirection: 'row', gap: spacing.sm },

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
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  helperText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
});
