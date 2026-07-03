import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadow } from '@prayana/shared-ui';
import { optimizeRoute } from '@prayana/shared-services';
import { useCreateTripStore } from '@prayana/shared-stores';

interface OptimizeRouteButtonProps {
  dayIndex: number;
}

const hasRealCoords = (a: any): boolean =>
  a.coordinates &&
  typeof a.coordinates.lat === 'number' &&
  typeof a.coordinates.lng === 'number' &&
  (a.coordinates.lat !== 0 || a.coordinates.lng !== 0);

const OptimizeRouteButton: React.FC<OptimizeRouteButtonProps> = ({ dayIndex }) => {
  const days = useCreateTripStore((s) => s.days);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const activities = days[dayIndex]?.activities || [];
  const withCoords = useMemo(() => activities.filter(hasRealCoords), [activities]);
  const coordsLoading = activities.length > 0 && withCoords.length < activities.length;

  const handleOptimize = useCallback(async () => {
    if (activities.length < 3) {
      Alert.alert(
        'Not Enough Activities',
        `Need at least 3 activities to optimize the route (currently have ${activities.length}).`
      );
      return;
    }

    if (withCoords.length < 3) {
      Alert.alert(
        'Coordinates Still Loading',
        `Only ${withCoords.length} of ${activities.length} activities have location coordinates.\n\nCoordinates are fetched automatically — please wait a moment and try again.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsOptimizing(true);

    try {
      // Pass only activities with valid coordinates to avoid internal filter issues
      const result = await optimizeRoute(withCoords, {
        strategy: 'hybrid',
        considerTimeSlots: true,
      });

      if (result.success && result.data) {
        const { optimizedRoute, improvement } = result.data;
        const distSaved = Number(improvement?.distanceSaved) || 0;
        const pctImproved = Number(improvement?.percentageImprovement) || 0;

        if (distSaved > 0.1) {
          Alert.alert(
            'Route Optimized!',
            `Saved ${distSaved.toFixed(1)} km (${pctImproved.toFixed(0)}% shorter route).\n\nApply optimized order?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Apply',
                onPress: () => {
                  // Merge optimized order back with any activities that lacked coords
                  const optimizedNames = new Set(optimizedRoute.map((a: any) => a.name));
                  const unoptimized = activities.filter((a: any) => !optimizedNames.has(a.name));

                  const finalActivities = [
                    ...optimizedRoute.map((a: any, i: number) => ({ ...a, order: i })),
                    ...unoptimized.map((a: any, i: number) => ({ ...a, order: optimizedRoute.length + i })),
                  ];

                  const state = useCreateTripStore.getState();
                  const newDays = [...state.days];
                  newDays[dayIndex] = {
                    ...newDays[dayIndex],
                    activities: finalActivities,
                  };
                  useCreateTripStore.setState({
                    days: newDays,
                    hasUnsavedChanges: true,
                  });

                  Alert.alert('Route Applied', `Saved ${distSaved.toFixed(1)} km`);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Already Optimal',
            'Your current route is already well-optimized!'
          );
        }
      } else {
        Alert.alert('Optimization Failed', 'Could not optimize route. Please try again.');
      }
    } catch (err: any) {
      console.error('[Optimize] Failed:', err);
      Alert.alert(
        'Optimization Failed',
        err.message || 'Could not optimize route. Please try again.'
      );
    } finally {
      setIsOptimizing(false);
    }
  }, [dayIndex, activities, withCoords]);

  return (
    <View>
      <TouchableOpacity
        style={[styles.button, coordsLoading && styles.buttonLoading]}
        onPress={handleOptimize}
        disabled={isOptimizing}
        activeOpacity={0.7}
      >
        {isOptimizing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons name="navigate-outline" size={16} color="#ffffff" />
        )}
      </TouchableOpacity>
      {coordsLoading && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsBadgeText}>{withCoords.length}/{activities.length}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: '#10b981',
    ...shadow.sm,
  },
  buttonLoading: {
    backgroundColor: '#6ee7b7',
  },
  coordsBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  coordsBadgeText: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
});

export default OptimizeRouteButton;
