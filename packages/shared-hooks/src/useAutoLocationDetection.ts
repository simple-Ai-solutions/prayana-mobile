// hooks/useAutoLocationDetection.ts - Auto-detect user location on first visit

import { useEffect, useRef } from 'react';
import { useAppStore } from '@prayana/shared-stores';
import { locationDetectionService } from '@prayana/shared-services';

export function useAutoLocationDetection() {
  const userPreferences = useAppStore((state) => state.userPreferences);
  const initializeLocationPreferences = useAppStore(
    (state) => state.initializeLocationPreferences
  );
  const detectionAttempted = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (detectionAttempted.current) {
      return;
    }

    // Don't auto-detect if user has manually set their country
    if (userPreferences.manuallySet) {
      console.log('Skipping auto-detection: User manually set country');
      return;
    }

    const detectAndUpdate = async () => {
      try {
        detectionAttempted.current = true;

        console.log('Starting automatic location detection...');

        const locationData = await locationDetectionService.detectUserCountry();

        if (!locationData || !locationData.country) {
          console.warn('Location detection failed or returned no data');
          return;
        }

        // Don't update if already set to detected country
        if (
          userPreferences.country === locationData.country &&
          userPreferences.locationDetected
        ) {
          console.log('Country already set to detected location');
          return;
        }

        console.log(`Auto-setting country to: ${locationData.country}`);

        // Initialize preferences with detected location
        await initializeLocationPreferences(locationData);
      } catch (error) {
        console.error('Auto location detection error:', error);
      }
    };

    // Run detection after a small delay to avoid blocking initial render
    const timeoutId = setTimeout(detectAndUpdate, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  return {
    isDetected: userPreferences.locationDetected,
    country: userPreferences.country,
    countryName: userPreferences.countryName,
    region: userPreferences.region,
    isEuropean: userPreferences.isEuropean,
    manuallySet: userPreferences.manuallySet,
  };
}

export default useAutoLocationDetection;
