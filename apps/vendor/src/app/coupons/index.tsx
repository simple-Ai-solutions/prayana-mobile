import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
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
  EmptyState,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { businessAPI, activityMarketplaceAPI } from '@prayana/shared-services';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DiscountType = 'percent' | 'fixed';

interface Coupon {
  _id: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  validFrom?: string;
  validUntil?: string;
  maxUses?: number;
  maxUsesPerUser?: number;
  usedCount?: number;
  isActive?: boolean;
  applicableActivities?: string[];
}

interface ActivityOption {
  _id: string;
  title: string;
}

interface CouponFormState {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderAmount: string;
  validFrom: string;
  validUntil: string;
  maxUses: string;
  maxUsesPerUser: string;
  applicableActivities: string[];
}

interface FormErrors {
  [key: string]: string;
}

const RUPEE = '₹';

const EMPTY_FORM: CouponFormState = {
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  maxDiscount: '',
  minOrderAmount: '',
  validFrom: '',
  validUntil: '',
  maxUses: '',
  maxUsesPerUser: '1',
  applicableActivities: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function discountLabel(coupon: Coupon): string {
  if (coupon.discountType === 'percent') {
    return `${coupon.discountValue}% off`;
  }
  return `${RUPEE}${coupon.discountValue} off`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CouponsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal / form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ---- Data loading ----

  const loadCoupons = useCallback(async () => {
    try {
      const res = await businessAPI.listMyCoupons();
      const list: Coupon[] = res?.data?.coupons ?? res?.coupons ?? res?.data ?? res ?? [];
      setCoupons(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('[Coupons] list failed:', err?.message);
      Toast.show({ type: 'error', text1: 'Could not load coupons', text2: err?.message });
    }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      const res = await activityMarketplaceAPI.getMyListings();
      const list = res?.data?.activities ?? res?.activities ?? res?.data ?? res ?? [];
      const mapped: ActivityOption[] = (Array.isArray(list) ? list : [])
        .map((a: any) => ({ _id: a?._id || a?.id, title: a?.title || a?.name || 'Untitled activity' }))
        .filter((a: ActivityOption) => !!a._id);
      setActivities(mapped);
    } catch (err: any) {
      console.warn('[Coupons] activities failed:', err?.message);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadCoupons(), loadActivities()]);
  }, [loadCoupons, loadActivities]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ---- Form helpers ----

  const openCreate = useCallback(() => {
    setEditingCoupon(null);
    setForm({ ...EMPTY_FORM, validFrom: todayISO() });
    setErrors({});
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((coupon: Coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'percent',
      discountValue: coupon.discountValue != null ? String(coupon.discountValue) : '',
      maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
      minOrderAmount: coupon.minOrderAmount != null ? String(coupon.minOrderAmount) : '',
      validFrom: coupon.validFrom ? coupon.validFrom.slice(0, 10) : todayISO(),
      validUntil: coupon.validUntil ? coupon.validUntil.slice(0, 10) : '',
      maxUses: coupon.maxUses != null ? String(coupon.maxUses) : '',
      maxUsesPerUser: coupon.maxUsesPerUser != null ? String(coupon.maxUsesPerUser) : '1',
      applicableActivities: Array.isArray(coupon.applicableActivities)
        ? coupon.applicableActivities.map((a: any) => (typeof a === 'string' ? a : a?._id)).filter(Boolean)
        : [],
    });
    setErrors({});
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingCoupon(null);
    setErrors({});
  }, []);

  const updateField = useCallback(
    (field: keyof CouponFormState, value: string | string[]) => {
      setForm((prev) => ({ ...prev, [field]: value } as CouponFormState));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const toggleActivity = useCallback((id: string) => {
    setForm((prev) => {
      const exists = prev.applicableActivities.includes(id);
      return {
        ...prev,
        applicableActivities: exists
          ? prev.applicableActivities.filter((a) => a !== id)
          : [...prev.applicableActivities, id],
      };
    });
  }, []);

  // ---- Validation ----

  const validate = useCallback((): boolean => {
    const next: FormErrors = {};

    if (!form.code.trim()) {
      next.code = 'Coupon code is required';
    } else if (!/^[A-Z0-9_-]{3,20}$/.test(form.code.trim().toUpperCase())) {
      next.code = 'Use 3-20 letters/numbers (no spaces)';
    }

    const value = Number(form.discountValue);
    if (!form.discountValue.trim()) {
      next.discountValue = 'Discount value is required';
    } else if (Number.isNaN(value) || value <= 0) {
      next.discountValue = 'Enter a valid amount';
    } else if (form.discountType === 'percent' && value > 100) {
      next.discountValue = 'Percentage cannot exceed 100';
    }

    if (form.maxDiscount.trim() && (Number.isNaN(Number(form.maxDiscount)) || Number(form.maxDiscount) < 0)) {
      next.maxDiscount = 'Enter a valid cap amount';
    }

    if (form.minOrderAmount.trim() && (Number.isNaN(Number(form.minOrderAmount)) || Number(form.minOrderAmount) < 0)) {
      next.minOrderAmount = 'Enter a valid minimum';
    }

    if (!form.validFrom.trim()) {
      next.validFrom = 'Start date is required (YYYY-MM-DD)';
    } else if (!isValidDate(form.validFrom)) {
      next.validFrom = 'Use format YYYY-MM-DD';
    }

    if (!form.validUntil.trim()) {
      next.validUntil = 'End date is required (YYYY-MM-DD)';
    } else if (!isValidDate(form.validUntil)) {
      next.validUntil = 'Use format YYYY-MM-DD';
    } else if (
      isValidDate(form.validFrom) &&
      new Date(form.validUntil) < new Date(form.validFrom)
    ) {
      next.validUntil = 'End date must be after start date';
    }

    if (form.maxUses.trim() && (Number.isNaN(Number(form.maxUses)) || Number(form.maxUses) < 1)) {
      next.maxUses = 'Enter a valid total uses';
    }

    if (!form.maxUsesPerUser.trim()) {
      next.maxUsesPerUser = 'Required';
    } else if (Number.isNaN(Number(form.maxUsesPerUser)) || Number(form.maxUsesPerUser) < 1) {
      next.maxUsesPerUser = 'Enter a valid number';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  // ---- Submit ----

  const buildPayload = useCallback(() => {
    const payload: Record<string, any> = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderAmount: form.minOrderAmount.trim() ? Number(form.minOrderAmount) : 0,
      validFrom: new Date(form.validFrom).toISOString(),
      validUntil: new Date(form.validUntil).toISOString(),
      maxUsesPerUser: Number(form.maxUsesPerUser),
      applicableActivities: form.applicableActivities,
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.maxDiscount.trim()) payload.maxDiscount = Number(form.maxDiscount);
    if (form.maxUses.trim()) payload.maxUses = Number(form.maxUses);
    return payload;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editingCoupon) {
        await businessAPI.updateCoupon(editingCoupon._id, payload);
        Toast.show({ type: 'success', text1: 'Coupon updated' });
      } else {
        await businessAPI.createCoupon(payload);
        Toast.show({ type: 'success', text1: 'Coupon created' });
      }
      closeModal();
      await loadCoupons();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: editingCoupon ? 'Update failed' : 'Create failed',
        text2: err?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [validate, buildPayload, editingCoupon, closeModal, loadCoupons]);

  // ---- Activate / deactivate ----

  const handleToggleActive = useCallback(
    async (coupon: Coupon) => {
      setTogglingId(coupon._id);
      const nextActive = !coupon.isActive;
      try {
        await businessAPI.updateCoupon(coupon._id, { isActive: nextActive });
        setCoupons((prev) =>
          prev.map((c) => (c._id === coupon._id ? { ...c, isActive: nextActive } : c)),
        );
        Toast.show({
          type: 'success',
          text1: nextActive ? 'Coupon activated' : 'Coupon deactivated',
        });
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Update failed', text2: err?.message });
      } finally {
        setTogglingId(null);
      }
    },
    [],
  );

  // ---- Delete ----

  const handleDelete = useCallback(
    (coupon: Coupon) => {
      Alert.alert(
        'Delete coupon',
        `Remove coupon "${coupon.code}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await businessAPI.deleteCoupon(coupon._id);
                setCoupons((prev) => prev.filter((c) => c._id !== coupon._id));
                Toast.show({ type: 'success', text1: 'Coupon deleted' });
              } catch (err: any) {
                Toast.show({ type: 'error', text1: 'Delete failed', text2: err?.message });
              }
            },
          },
        ],
      );
    },
    [],
  );

  // ---- Derived activity title lookup ----

  const activityTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    activities.forEach((a) => {
      map[a._id] = a.title;
    });
    return map;
  }, [activities]);

  // ---- Render ----

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Coupons</Text>
        <TouchableOpacity onPress={openCreate} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add" size={28} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : coupons.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <EmptyState
            icon={<Ionicons name="pricetags-outline" size={56} color={colors.gray[300]} />}
            title="No coupons yet"
            description="Create discount codes to attract more bookings for your activities."
          />
          <View style={styles.emptyButtonWrap}>
            <Button title="New Coupon" onPress={openCreate} variant="primary" size="lg" />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {coupons.map((coupon) => {
            const applicableTitles = (coupon.applicableActivities || [])
              .map((a: any) => activityTitleById[typeof a === 'string' ? a : a?._id])
              .filter(Boolean);
            return (
              <Card key={coupon._id} style={styles.couponCard}>
                <View style={styles.couponHeader}>
                  <View style={styles.couponCodeWrap}>
                    <Ionicons name="pricetag" size={16} color={colors.primary[500]} />
                    <Text style={[styles.couponCode, { color: themeColors.text }]}>{coupon.code}</Text>
                  </View>
                  <StatusBadge status={coupon.isActive ? 'active' : 'inactive'} />
                </View>

                {coupon.description ? (
                  <Text style={[styles.couponDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    {coupon.description}
                  </Text>
                ) : null}

                <View style={styles.couponMetaRow}>
                  <View style={styles.metaPill}>
                    <Ionicons name="cash-outline" size={14} color={colors.primary[600]} />
                    <Text style={styles.metaPillText}>{discountLabel(coupon)}</Text>
                  </View>
                  {coupon.minOrderAmount ? (
                    <View style={[styles.metaPill, { backgroundColor: themeColors.inputBackground }]}>
                      <Text style={[styles.metaPillTextMuted, { color: themeColors.textSecondary }]}>
                        Min {RUPEE}
                        {coupon.minOrderAmount}
                      </Text>
                    </View>
                  ) : null}
                  {coupon.maxDiscount ? (
                    <View style={[styles.metaPill, { backgroundColor: themeColors.inputBackground }]}>
                      <Text style={[styles.metaPillTextMuted, { color: themeColors.textSecondary }]}>
                        Up to {RUPEE}
                        {coupon.maxDiscount}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.couponInfoGrid}>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>Valid</Text>
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>
                      {formatDateLabel(coupon.validFrom)} – {formatDateLabel(coupon.validUntil)}
                    </Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>Used</Text>
                    <Text style={[styles.infoValue, { color: themeColors.text }]}>
                      {coupon.usedCount ?? 0}
                      {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
                    </Text>
                  </View>
                </View>

                {applicableTitles.length > 0 ? (
                  <Text style={[styles.applicableText, { color: themeColors.textTertiary }]} numberOfLines={1}>
                    Applies to: {applicableTitles.join(', ')}
                  </Text>
                ) : (
                  <Text style={[styles.applicableText, { color: themeColors.textTertiary }]}>
                    Applies to all activities
                  </Text>
                )}

                <View style={styles.couponActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: themeColors.border }]}
                    onPress={() => openEdit(coupon)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primary[500]} />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: themeColors.border }]}
                    onPress={() => handleToggleActive(coupon)}
                    activeOpacity={0.7}
                    disabled={togglingId === coupon._id}
                  >
                    {togglingId === coupon._id ? (
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                    ) : (
                      <>
                        <Ionicons
                          name={coupon.isActive ? 'pause-outline' : 'play-outline'}
                          size={16}
                          color={colors.primary[500]}
                        />
                        <Text style={styles.actionBtnText}>
                          {coupon.isActive ? 'Pause' : 'Activate'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(coupon)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
          <View style={{ height: spacing['3xl'] }} />
        </ScrollView>
      )}

      {/* Floating add button */}
      {coupons.length > 0 ? (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      ) : null}

      {/* Create / edit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {editingCoupon ? 'Edit coupon' : 'New coupon'}
            </Text>
            <TouchableOpacity onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                label="Coupon Code *"
                placeholder="e.g. SUMMER25"
                value={form.code}
                onChangeText={(val: string) =>
                  updateField('code', val.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20))
                }
                error={errors.code}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!editingCoupon}
                hint={editingCoupon ? 'Code cannot be changed after creation' : undefined}
              />

              <TextInput
                label="Description (optional)"
                placeholder="Shown to customers at checkout"
                value={form.description}
                onChangeText={(val: string) => updateField('description', val)}
                multiline
                numberOfLines={2}
                maxLength={200}
              />

              {/* Discount type segmented control */}
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Discount Type *</Text>
              <View style={[styles.segmented, { borderColor: themeColors.border }]}>
                {(['percent', 'fixed'] as DiscountType[]).map((type) => {
                  const active = form.discountType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.segment,
                        active && { backgroundColor: colors.primary[500] },
                      ]}
                      onPress={() => updateField('discountType', type)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: active ? '#ffffff' : themeColors.textSecondary },
                        ]}
                      >
                        {type === 'percent' ? 'Percentage (%)' : `Fixed (${RUPEE})`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                label={form.discountType === 'percent' ? 'Discount Value (%) *' : `Discount Value (${RUPEE}) *`}
                placeholder={form.discountType === 'percent' ? 'e.g. 25' : 'e.g. 500'}
                value={form.discountValue}
                onChangeText={(val: string) => updateField('discountValue', val.replace(/[^0-9.]/g, ''))}
                error={errors.discountValue}
                keyboardType="decimal-pad"
              />

              {form.discountType === 'percent' ? (
                <TextInput
                  label={`Max Discount Cap (${RUPEE}, optional)`}
                  placeholder="e.g. 1000"
                  value={form.maxDiscount}
                  onChangeText={(val: string) => updateField('maxDiscount', val.replace(/[^0-9.]/g, ''))}
                  error={errors.maxDiscount}
                  keyboardType="decimal-pad"
                  hint="Maximum rupee value a percentage coupon can discount"
                />
              ) : null}

              <TextInput
                label={`Minimum Order Amount (${RUPEE}, optional)`}
                placeholder="e.g. 2000"
                value={form.minOrderAmount}
                onChangeText={(val: string) => updateField('minOrderAmount', val.replace(/[^0-9.]/g, ''))}
                error={errors.minOrderAmount}
                keyboardType="decimal-pad"
              />

              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <TextInput
                    label="Valid From *"
                    placeholder="YYYY-MM-DD"
                    value={form.validFrom}
                    onChangeText={(val: string) => updateField('validFrom', val.replace(/[^0-9-]/g, '').slice(0, 10))}
                    error={errors.validFrom}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.rowHalf}>
                  <TextInput
                    label="Valid Until *"
                    placeholder="YYYY-MM-DD"
                    value={form.validUntil}
                    onChangeText={(val: string) => updateField('validUntil', val.replace(/[^0-9-]/g, '').slice(0, 10))}
                    error={errors.validUntil}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <TextInput
                    label="Total Uses (optional)"
                    placeholder="Unlimited"
                    value={form.maxUses}
                    onChangeText={(val: string) => updateField('maxUses', val.replace(/\D/g, ''))}
                    error={errors.maxUses}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.rowHalf}>
                  <TextInput
                    label="Uses Per User *"
                    placeholder="e.g. 1"
                    value={form.maxUsesPerUser}
                    onChangeText={(val: string) => updateField('maxUsesPerUser', val.replace(/\D/g, ''))}
                    error={errors.maxUsesPerUser}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Applicable activities multiselect */}
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                Applicable Activities
              </Text>
              <Text style={[styles.fieldHint, { color: themeColors.textTertiary }]}>
                Leave empty to apply to all of your activities.
              </Text>
              {activities.length === 0 ? (
                <Text style={[styles.noActivities, { color: themeColors.textTertiary }]}>
                  No activities found.
                </Text>
              ) : (
                <View style={styles.activityChips}>
                  {activities.map((activity) => {
                    const selected = form.applicableActivities.includes(activity._id);
                    return (
                      <TouchableOpacity
                        key={activity._id}
                        style={[
                          styles.activityChip,
                          { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                          selected && styles.activityChipSelected,
                        ]}
                        onPress={() => toggleActivity(activity._id)}
                        activeOpacity={0.7}
                      >
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={15} color={colors.primary[500]} />
                        ) : null}
                        <Text
                          style={[
                            styles.activityChipText,
                            { color: selected ? colors.primary[700] : themeColors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {activity.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.modalActions}>
                <Button
                  title={editingCoupon ? 'Save changes' : 'Create coupon'}
                  onPress={handleSubmit}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  disabled={submitting}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  flex: { flex: 1 },
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

  emptyScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  emptyButtonWrap: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },

  listContent: { padding: spacing.lg, gap: spacing.md },

  couponCard: { padding: spacing.lg, marginBottom: spacing.md },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  couponCodeWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  couponCode: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  couponDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },

  couponMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  metaPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[700] },
  metaPillTextMuted: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary },

  couponInfoGrid: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.sm },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: fontSize.xs, color: colors.textTertiary, marginBottom: 2 },
  infoValue: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },

  applicableText: { fontSize: fontSize.xs, color: colors.textTertiary, marginBottom: spacing.md, fontStyle: 'italic' },

  couponActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteBtn: { borderColor: colors.error },
  actionBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.primary[600] },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },

  // ---- Modal ----
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
  modalScroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },

  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  fieldHint: { fontSize: fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm },

  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  segment: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  row: { flexDirection: 'row', gap: spacing.md },
  rowHalf: { flex: 1 },

  activityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activityChipSelected: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  activityChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flexShrink: 1 },
  noActivities: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs },

  modalActions: { marginTop: spacing.xl },
});
