import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { Button } from '../../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';
import { packageAPI } from '@prayana/shared-services';

import {
  PackageFormValues,
  buildPackagePayload as buildPayload,
} from './packageTypes';
import PackageBasicInfoStep from './PackageBasicInfoStep';
import ItineraryBuilder from './ItineraryBuilder';
import VariantPricingStep from './VariantPricingStep';
import InclusionsMediaStep from './InclusionsMediaStep';
import DeparturesStep from './DeparturesStep';
import PackagePreview from './PackagePreview';

// Re-exports so the thin route wrappers (new.tsx / [id].tsx) can import the
// contract from here without reaching into packageTypes directly.
export { packageToFormValues, buildPackagePayload, EMPTY_PACKAGE } from './packageTypes';
export type { PackageFormValues } from './packageTypes';

// ─── Wizard steps ────────────────────────────────────────────────────────────────

const STEPS = ['Basics', 'Itinerary', 'Variants', 'Media', 'Departures', 'Review'];

// ─── Main form ────────────────────────────────────────────────────────────────────

export default function PackageForm({
  mode,
  initialValues,
  headerTitle,
  packageId,
}: {
  mode: 'create' | 'edit';
  initialValues: PackageFormValues;
  headerTitle: string;
  packageId?: string;
}) {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [values, setValues] = useState<PackageFormValues>(initialValues);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const isLastStep = step === STEPS.length - 1;

  // Exact StepProps.onChange contract — a shallow merge of partial updates.
  const onChange = useCallback((updates: Partial<PackageFormValues>) => {
    setValues((v) => ({ ...v, ...updates }));
  }, []);

  // Per-step "can advance" gate — mirrors the web PackageWizard canGoNext exactly.
  const canGoNext = (s: number): boolean => {
    switch (s) {
      case 0:
        return (
          !!values.title &&
          !!values.description &&
          values.category.length > 0 &&
          values.nights > 0 &&
          values.destinations.some((d) => d.name || d.city)
        );
      case 1:
        return values.itinerary.length > 0;
      case 2:
        return values.variants.length > 0 && values.variants.some((v) => v.pricing.basePrice > 0);
      case 3:
        return true; // Inclusions & media are optional
      case 4:
        return true; // Departures can be added later
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!canGoNext(step)) {
      Toast.show({ type: 'error', text1: 'Please fill in all required fields for this step' });
      return;
    }
    if (!isLastStep) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const jumpToStep = (s: number) => setStep(Math.max(0, Math.min(s, STEPS.length - 1)));

  // ── Save / submit ──
  const handleSave = useCallback(
    async (submitAfter: boolean) => {
      const setLoading = submitAfter ? setSubmitting : setSavingDraft;
      setLoading(true);
      try {
        const payload = buildPayload(values);

        let res: any;
        if (mode === 'edit' && packageId) {
          res = await packageAPI.updatePackage(packageId, payload);
        } else {
          res = await packageAPI.createPackage(payload);
        }

        const savedId: string | undefined = res?.data?._id || res?.data?.id || packageId;

        if (submitAfter && savedId) {
          await packageAPI.submitForApproval(savedId);
        }

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Toast.show({
          type: 'success',
          text1:
            mode === 'edit'
              ? submitAfter
                ? 'Updated & submitted for review'
                : 'Package updated'
              : submitAfter
              ? 'Submitted for review'
              : 'Draft saved',
          text2: submitAfter
            ? 'Our team will review your package shortly.'
            : 'You can edit and submit it later.',
        });
        router.back();
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: mode === 'edit' ? 'Failed to update package' : 'Failed to create package',
          text2: err?.body?.message || err?.message || 'Please try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [values, mode, packageId, router],
  );

  // ── Render the active step ──
  const renderStep = () => {
    switch (step) {
      case 0:
        return <PackageBasicInfoStep values={values} onChange={onChange} />;
      case 1:
        return <ItineraryBuilder values={values} onChange={onChange} />;
      case 2:
        return <VariantPricingStep values={values} onChange={onChange} />;
      case 3:
        return <InclusionsMediaStep values={values} onChange={onChange} />;
      case 4:
        return <DeparturesStep values={values} onChange={onChange} />;
      case 5:
        return <PackagePreview values={values} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}

          {/* Navigation / actions */}
          {isLastStep ? (
            <View style={styles.actionsStacked}>
              <Button
                title="Submit for Review"
                onPress={() => handleSave(true)}
                size="lg"
                loading={submitting}
                disabled={savingDraft}
                fullWidth
              />
              <Button
                title={mode === 'edit' ? 'Save Changes' : 'Save as Draft'}
                onPress={() => handleSave(false)}
                variant="outline"
                size="lg"
                loading={savingDraft}
                disabled={submitting}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button title="Back" onPress={goBack} variant="outline" size="lg" style={styles.actionBtn} />
              <Button title="Next" onPress={goNext} size="lg" style={styles.actionBtn} />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 36 },
  stepperWrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepTapRow: { flexDirection: 'row', flex: 1 },
  stepTapTarget: { flex: 1 },
  scrollContent: { padding: spacing.xl },

  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  actionBtn: { flex: 1 },
  actionsStacked: { gap: spacing.sm, marginTop: spacing.xl },
  bottomSpacer: { height: spacing['3xl'] },
});
