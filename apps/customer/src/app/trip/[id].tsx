// /trip/<id> — open one of the user's saved trips.
//
// My Trips, the create-trip drafts list and My Expenses all push here with a
// trip id, but the route never existed, so every one of those taps landed on
// "Unmatched route". This loads the trip (GET /user-trips/:id), puts it in the
// trip store and hands over to the planner — the same way a joined share link
// opens (components/trip/TripJoinScreen).
//
// Static siblings (plan, setup, planner, live/, share/ …) win over this
// dynamic segment, so none of those routes are affected.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTheme } from '@prayana/shared-ui';
import { createTripAPI } from '@prayana/shared-services';
import { useCreateTripStore } from '@prayana/shared-stores';
import { useGoBack } from '../../lib/goBack';

export default function OpenTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/trips');
  const { themeColors } = useTheme();
  const loadTrip = useCreateTripStore((s: any) => s.loadTrip);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res: any = await createTripAPI.getTripById(String(id));
      const trip = res?.data || res?.trip || (res?._id || res?.tripId ? res : null);
      if (!trip) {
        setError('This trip could not be found. It may have been deleted.');
        return;
      }
      loadTrip({ ...trip, tripId: trip.tripId || trip._id });
      router.replace('/trip/planner' as any);
    } catch (err: any) {
      const msg = String(err?.message || '');
      setError(
        /404|not found/i.test(msg)
          ? 'This trip could not be found. It may have been deleted.'
          : /403|401|access|permission/i.test(msg)
            ? "You don't have access to this trip."
            : 'Could not open this trip. Check your connection and try again.',
      );
    }
  }, [id, loadTrip, router]);

  useEffect(() => { open(); }, [open]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <TouchableOpacity style={styles.back} onPress={goBack} hitSlop={10} accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={24} color={themeColors.text} />
      </TouchableOpacity>
      <View style={styles.center}>
        {error ? (
          <>
            <Ionicons name="map-outline" size={44} color={themeColors.textTertiary} />
            <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={open}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Opening your trip…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { padding: 16, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retry: { marginTop: 4, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary[500] },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
