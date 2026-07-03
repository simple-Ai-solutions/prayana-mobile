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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
} from '@prayana/shared-ui';
import { variantAPI } from '@prayana/shared-services';

type Variant = {
  _id: string;
  name: string;
  tier?: 'standard' | 'vip' | 'private';
  pricePerPerson?: number;
  pricePerGroup?: number;
  minParticipants?: number;
  maxParticipants?: number;
  inclusions?: string[];
  excludes?: string[];
  isAvailable?: boolean;
};

const TIER_BADGE: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  standard: { label: 'Standard', variant: 'default' },
  vip: { label: 'VIP', variant: 'primary' },
  private: { label: 'Private', variant: 'info' },
};

export default function VariantsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [tier, setTier] = useState<'standard' | 'vip' | 'private'>('standard');
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [minP, setMinP] = useState('1');
  const [maxP, setMaxP] = useState('20');
  const [inclusions, setInclusions] = useState('');

  const fetchVariants = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await variantAPI.getActivityVariants(id, true);
      setVariants(res?.data || res?.variants || []);
    } catch (err: any) {
      console.warn('[Variants] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  const openEditor = (v?: Variant) => {
    if (v) {
      setEditing(v);
      setName(v.name);
      setTier((v.tier as any) || 'standard');
      setPricePerPerson(String(v.pricePerPerson || ''));
      setMinP(String(v.minParticipants || 1));
      setMaxP(String(v.maxParticipants || 20));
      setInclusions((v.inclusions || []).join('\n'));
    } else {
      setEditing({ _id: '', name: '' });
      setName('');
      setTier('standard');
      setPricePerPerson('');
      setMinP('1');
      setMaxP('20');
      setInclusions('');
    }
    Haptics.selectionAsync();
  };

  const closeEditor = () => {
    setEditing(null);
    setName('');
    setPricePerPerson('');
    setInclusions('');
  };

  const seedTemplates = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await variantAPI.bulkCreateVariants(id, 'standard_vip_private');
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Templates created' });
        await fetchVariants();
      } else {
        Toast.show({ type: 'error', text1: 'Could not create', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const saveVariant = async () => {
    if (!id) return;
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name required' });
      return;
    }
    const price = Number(pricePerPerson);
    if (Number.isNaN(price) || price <= 0) {
      Toast.show({ type: 'error', text1: 'Valid price required' });
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      tier,
      pricePerPerson: price,
      minParticipants: Number(minP) || 1,
      maxParticipants: Number(maxP) || 20,
      inclusions: inclusions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const res = editing && editing._id
        ? await variantAPI.updateVariant(editing._id, payload)
        : await variantAPI.createVariant(id, payload);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: editing && editing._id ? 'Variant updated' : 'Variant created',
        });
        closeEditor();
        await fetchVariants();
      } else {
        Toast.show({ type: 'error', text1: 'Save failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteVariant = async (variant: Variant) => {
    setSubmitting(true);
    try {
      const res = await variantAPI.deleteVariant(variant._id);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Variant removed' });
        await fetchVariants();
      } else {
        Toast.show({ type: 'error', text1: 'Could not delete', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Variants & pricing tiers</Text>
        <TouchableOpacity onPress={() => openEditor()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add" size={26} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : variants.length === 0 ? (
          <View style={{ paddingTop: spacing.xl }}>
            <EmptyState
              icon={<Ionicons name="layers-outline" size={56} color={colors.gray[300]} />}
              title="No variants yet"
              description="Offer Standard, VIP, and Private tiers to capture different price points."
              actionLabel="Use template (Std + VIP + Private)"
              onAction={seedTemplates}
            />
            <View style={{ height: spacing.lg }} />
            <Button title="Create custom variant" onPress={() => openEditor()} variant="outline" size="md" fullWidth />
          </View>
        ) : (
          variants.map((v) => {
            const tierCfg = TIER_BADGE[v.tier || 'standard'] || TIER_BADGE.standard;
            return (
              <Card key={v._id} style={styles.variantCard}>
                <View style={styles.variantHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantName}>{v.name}</Text>
                    <View style={styles.metaRow}>
                      <Badge label={tierCfg.label} variant={tierCfg.variant} size="sm" />
                      {!v.isAvailable ? (
                        <Badge label="Unavailable" variant="error" size="sm" />
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.variantPrice}>
                    ₹{(v.pricePerPerson || 0).toLocaleString('en-IN')}
                    <Text style={styles.variantPriceMeta}>/pax</Text>
                  </Text>
                </View>
                {v.inclusions && v.inclusions.length > 0 ? (
                  <Text style={styles.variantIncl} numberOfLines={3}>
                    {v.inclusions.slice(0, 5).join(' · ')}
                  </Text>
                ) : null}
                <View style={styles.variantActions}>
                  <Button title="Edit" onPress={() => openEditor(v)} variant="outline" size="sm" />
                  <Button title="Delete" onPress={() => deleteVariant(v)} variant="ghost" size="sm" />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Editor modal */}
      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editing && editing._id ? 'Edit variant' : 'New variant'}
            </Text>
            <TouchableOpacity onPress={closeEditor} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <TextInput label="Name" value={name} onChangeText={setName} placeholder="e.g. VIP Sunset Tour" />

              <Text style={styles.fieldLabel}>Tier</Text>
              <View style={styles.chipRow}>
                {(['standard', 'vip', 'private'] as const).map((t) => {
                  const active = tier === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setTier(t)}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                label="Price per person (₹)"
                value={pricePerPerson}
                onChangeText={setPricePerPerson}
                placeholder="2999"
                keyboardType="number-pad"
              />

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <TextInput label="Min participants" value={minP} onChangeText={setMinP} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput label="Max participants" value={maxP} onChangeText={setMaxP} keyboardType="number-pad" />
                </View>
              </View>

              <TextInput
                label="Inclusions (one per line)"
                value={inclusions}
                onChangeText={setInclusions}
                placeholder={'Welcome drink\nProfessional guide\nLight refreshments'}
                multiline
                numberOfLines={5}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button
                title={editing && editing._id ? 'Update variant' : 'Create variant'}
                onPress={saveVariant}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
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
  topBarTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },

  variantCard: { padding: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  variantHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  variantName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  metaRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 4 },
  variantPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[600] },
  variantPriceMeta: { fontSize: fontSize.xs, fontWeight: fontWeight.normal, color: colors.textTertiary },
  variantIncl: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: spacing.xs },
  variantActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

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
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  chipTextActive: { color: '#fff' },
});
