// One property's onboarding wizard (also how a live property is edited).
// Loads the stay, then hands it to the wizard, which owns autosave.
//
// A draft being filled from another site (Airbnb, Booking.com …) shows the
// import's progress instead, and the wizard only opens once it's finished,
// on what the import filled in: the wizard is never on screen (so never
// autosaving) while an import writes to the draft. A failed import shows its
// retry options first.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, LoadingSpinner } from '../../../components/ui';
import { fontSize, fontWeight, spacing } from '../../../theme/vendorColors';
import { staysAPI } from '../_components/api';
import { usePalette, ScreenHeader } from '../_components/controls';
import StayWizard from '../_components/StayWizard';
import { ImportFailed, ImportProgress, importSession } from '../_components/ImportListing';
import { Stay, StepId, apiError } from '../_components/stayConfig';

export default function StayWizardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = usePalette();
  const [stay, setStay] = useState<Stay | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The full-screen retry options for a failed import (vs. the wizard with a banner).
  const [showFailed, setShowFailed] = useState(false);
  // Just finished importing: open the wizard on its first step, to check each one.
  const [startStep, setStartStep] = useState<StepId | undefined>(undefined);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await staysAPI.getMine(String(id));
      if (!res?.data?._id) throw new Error(res?.message || "Couldn't load the property");
      const next: Stay = { ...res.data, _id: String(res.data._id) };
      // Started on this phone, and it finished while the owner was elsewhere.
      if (importSession.isOpen(next._id)) {
        if (next.importJob?.status === 'failed') setShowFailed(true);
        else if (next.importJob?.status === 'done') {
          importSession.settle(next._id);
          setStartStep('property');
        }
      }
      setStay(next);
    } catch (e: any) {
      setError(e?.status === 404 ? "This property doesn't exist or isn't yours." : apiError(e, "Couldn't load the property"));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/stays')), [router]);

  const onImportFinished = useCallback((next: Stay) => {
    if (next.importJob?.status === 'failed') {
      setShowFailed(true);
    } else {
      importSession.settle(next._id);
      setStartStep('property');
    }
    setStay(next);
  }, []);

  const onImportStarted = useCallback((next: Stay) => {
    setShowFailed(false);
    setStay(next);
  }, []);

  const fillMyself = useCallback(() => {
    if (stay) {
      importSession.settle(stay._id);
      importSession.closeBanner(stay);
    }
    setShowFailed(false);
  }, [stay]);

  // From the wizard's "Try the import again": it has saved and stopped autosaving.
  const retryFromWizard = useCallback((latest: Stay) => {
    setStartStep(undefined);
    setStay(latest);
    setShowFailed(true);
  }, []);

  if (stay) {
    const job = stay.importJob;
    if (job?.status === 'running') {
      return <ImportProgress stay={stay} onFinished={onImportFinished} onBack={back} />;
    }
    if (showFailed && job?.status === 'failed') {
      return <ImportFailed stay={stay} onStarted={onImportStarted} onFillMyself={fillMyself} onBack={back} />;
    }
    // Keyed on the import's end, so a finished (re-)import starts the wizard
    // afresh from what it filled in rather than an earlier draft.
    return (
      <StayWizard
        key={`${stay._id}:${job?.finishedAt || ''}`}
        initialStay={stay}
        startStep={startStep}
        onRetryImport={retryFromWizard}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top']}>
      <ScreenHeader title="Property" onBack={back} />
      {error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={p.c.textTertiary} />
          <Text style={[styles.error, { color: p.c.text }]}>{error}</Text>
          <Button title="Try again" onPress={load} />
        </View>
      ) : (
        <LoadingSpinner fullScreen message="Loading your property…" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing['2xl'] },
  error: { fontSize: fontSize.md, fontWeight: fontWeight.medium, textAlign: 'center' },
});
