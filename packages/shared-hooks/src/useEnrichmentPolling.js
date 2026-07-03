// hooks/useEnrichmentPolling.js - ULTIMATE VERSION (stops at any stuck %)

import { useState, useEffect, useRef, useCallback } from 'react';
import { destinationAPI } from '@prayana/shared-services';

export function useEnrichmentPolling(
  searchQuery,
  enabled = true,
  initialData = null,
  onEnrichmentComplete = null
) {
  const [enrichmentStatus, setEnrichmentStatus] = useState({
    isEnriching: false,
    needsEnrichment: false,
    coordinatesPercent: 0,
    imagesPercent: 0,
    overallPercent: 0,
    isComplete: false,
    lastUpdate: null,
  });

  const pollingIntervalRef = useRef(null);
  const pollCountRef = useRef(0);
  const maxPollsRef = useRef(20);
  const hasCheckedInitialDataRef = useRef(false);
  const lastProgressRef = useRef(-1); // Start at -1 so first check doesn't count as stuck
  const stuckCountRef = useRef(0);

  // Check if enrichment is needed
  const checkIfEnrichmentNeeded = useCallback((data) => {
    if (!data || !Array.isArray(data)) return false;

    const placesNeedingCoords = data.filter(place =>
      !place.locationData?.coordinates?.lat ||
      place.locationData?.coordinates?.lat === 0
    ).length;

    const placesNeedingImages = data.filter(place =>
      !place.imageUrls ||
      place.imageUrls.length === 0
    ).length;

    const needsEnrichment = placesNeedingCoords > 0 || placesNeedingImages > 0;

    console.log(`Enrichment check for "${searchQuery}":`, {
      totalPlaces: data.length,
      needingCoords: placesNeedingCoords,
      needingImages: placesNeedingImages,
      needsEnrichment,
    });

    return needsEnrichment;
  }, [searchQuery]);

  // Stop polling
  const stopPolling = useCallback((reason = 'unknown') => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      pollCountRef.current = 0;
      stuckCountRef.current = 0;
      lastProgressRef.current = -1;
      console.log(`Stopped polling for "${searchQuery}" - Reason: ${reason}`);
    }
  }, [searchQuery]);

  // Poll for enrichment status
  const pollEnrichmentStatus = useCallback(async () => {
    if (!searchQuery) return;

    try {
      pollCountRef.current += 1;
      console.log(`Poll #${pollCountRef.current}/${maxPollsRef.current}: "${searchQuery}"`);

      const status = await destinationAPI.getEnrichmentStatus(searchQuery);

      if (status.success && status.found) {
        const enrichment = status.enrichment;
        const currentProgress = enrichment.overall.percent;

        // Check if progress is stuck
        if (lastProgressRef.current >= 0 && currentProgress === lastProgressRef.current) {
          stuckCountRef.current += 1;
          console.log(`STUCK at ${currentProgress}% (${stuckCountRef.current} consecutive checks)`);

          // Stop if stuck for 8 consecutive checks (24 seconds) at ANY percentage
          if (stuckCountRef.current >= 8) {
            console.log(`STOPPING: No progress for ${stuckCountRef.current} checks at ${currentProgress}%`);
            stopPolling(`stuck_at_${currentProgress}_percent`);

            setEnrichmentStatus(prev => ({
              ...prev,
              isEnriching: false,
              isComplete: true, // Mark as complete to hide UI
              lastUpdate: new Date().toISOString(),
            }));
            return;
          }
        } else if (currentProgress > lastProgressRef.current) {
          // Progress made!
          if (lastProgressRef.current >= 0) {
            console.log(`Progress: ${lastProgressRef.current}% -> ${currentProgress}%`);
          }
          stuckCountRef.current = 0;
          lastProgressRef.current = currentProgress;
        }

        setEnrichmentStatus({
          isEnriching: !enrichment.overall.isComplete,
          needsEnrichment: true,
          coordinatesPercent: enrichment.coordinates.percent,
          imagesPercent: enrichment.images.percent,
          overallPercent: enrichment.overall.percent,
          isComplete: enrichment.overall.isComplete,
          lastUpdate: new Date().toISOString(),
          total: enrichment.total,
          coordinatesComplete: enrichment.coordinates.complete,
          imagesComplete: enrichment.images.complete,
        });

        // Stop if 100% complete
        if (enrichment.overall.isComplete) {
          console.log(`100% COMPLETE for "${searchQuery}"`);
          stopPolling('complete');

          if (onEnrichmentComplete) {
            onEnrichmentComplete(status);
          }
        }
      } else {
        console.warn(`No enrichment data for "${searchQuery}"`);
        stuckCountRef.current += 1;

        if (stuckCountRef.current >= 3) {
          console.log(`STOPPING: No data for 3 checks`);
          stopPolling('no_data');
        }
      }

      // Stop after max attempts
      if (pollCountRef.current >= maxPollsRef.current) {
        console.log(`STOPPING: Max ${maxPollsRef.current} polls reached`);
        stopPolling('max_attempts');
      }
    } catch (error) {
      console.error('Polling error:', error);
      stuckCountRef.current += 1;

      if (stuckCountRef.current >= 3) {
        stopPolling('error');
      }
    }
  }, [searchQuery, stopPolling, onEnrichmentComplete]);

  // Check initial data first
  useEffect(() => {
    if (initialData && !hasCheckedInitialDataRef.current) {
      hasCheckedInitialDataRef.current = true;

      const needsEnrichment = checkIfEnrichmentNeeded(initialData);

      if (!needsEnrichment) {
        console.log(`No enrichment needed for "${searchQuery}"`);
        setEnrichmentStatus({
          isEnriching: false,
          needsEnrichment: false,
          coordinatesPercent: 100,
          imagesPercent: 100,
          overallPercent: 100,
          isComplete: true,
          lastUpdate: new Date().toISOString(),
        });
        return;
      } else {
        console.log(`Enrichment needed for "${searchQuery}"`);
        setEnrichmentStatus(prev => ({
          ...prev,
          needsEnrichment: true,
          isEnriching: true,
        }));
      }
    }
  }, [initialData, searchQuery, checkIfEnrichmentNeeded]);

  // Start polling
  useEffect(() => {
    if (enabled && searchQuery && enrichmentStatus.needsEnrichment && !enrichmentStatus.isComplete) {
      console.log(`START POLLING: "${searchQuery}"`);

      // Initial check immediately
      pollEnrichmentStatus();

      // Then poll every 3 seconds
      pollingIntervalRef.current = setInterval(() => {
        pollEnrichmentStatus();
      }, 3000);

      return () => {
        stopPolling('cleanup');
      };
    } else {
      stopPolling('disabled_or_complete');
    }
  }, [enabled, searchQuery, enrichmentStatus.needsEnrichment, enrichmentStatus.isComplete, pollEnrichmentStatus, stopPolling]);

  // Reset when search query changes
  useEffect(() => {
    setEnrichmentStatus({
      isEnriching: false,
      needsEnrichment: false,
      coordinatesPercent: 0,
      imagesPercent: 0,
      overallPercent: 0,
      isComplete: false,
      lastUpdate: null,
    });
    pollCountRef.current = 0;
    hasCheckedInitialDataRef.current = false;
    stuckCountRef.current = 0;
    lastProgressRef.current = -1;
  }, [searchQuery]);

  return {
    enrichmentStatus,
    stopPolling: () => stopPolling('manual'),
    isPolling: pollingIntervalRef.current !== null,
    shouldShowProgress: enrichmentStatus.needsEnrichment && enrichmentStatus.isEnriching,
  };
}
