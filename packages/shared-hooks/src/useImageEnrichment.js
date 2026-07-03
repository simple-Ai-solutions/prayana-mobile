/**
 * useImageEnrichment - Batch-fetches missing images for activities
 *
 * Follows the web's DayPlannerStep image enrichment pattern:
 * - Batches 5 activities at a time
 * - 250ms between batches
 * - Updates store activities with resolved image URLs
 * - Dedup key prevents re-fetching on re-renders
 */
import { useEffect, useRef } from 'react';
import { makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl, getPlaceImageUrl } from '@prayana/shared-utils';
import { useCreateTripStore } from '@prayana/shared-stores';

const BATCH_SIZE = 5;
const BATCH_DELAY = 250;

/**
 * @param {number} dayIndex - Index of the current day
 * @param {Array} activities - Activities array for the current day
 * @param {string} destinationName - Name of the destination (for API context)
 */
export function useImageEnrichment(dayIndex, activities, destinationName) {
  const lastEnrichKey = useRef('');

  useEffect(() => {
    if (!activities || activities.length === 0 || !destinationName) return;

    // Build a dedup key from activity names that are missing images
    const missingNames = activities
      .filter((a) => !a.image && !getPlaceImageUrl(a))
      .map((a) => a.name);

    if (missingNames.length === 0) return;

    const enrichKey = `${dayIndex}-${missingNames.sort().join(',')}`;
    if (enrichKey === lastEnrichKey.current) return;
    lastEnrichKey.current = enrichKey;

    let cancelled = false;

    const enrichBatch = async (batch) => {
      const results = [];
      for (const activity of batch) {
        if (cancelled) break;
        try {
          const res = await makeAPICall('/destinations/place-images', {
            method: 'POST',
            body: JSON.stringify({
              placeName: activity.name,
              location: destinationName,
              count: 1,
            }),
            timeout: 15000,
          });

          const data = res?.data || res;
          const imgArr = Array.isArray(data) ? data : [];
          if (imgArr.length > 0) {
            const imgData = imgArr[0];
            const rawUrl =
              typeof imgData === 'string'
                ? imgData
                : imgData?.url ||
                  imgData?.mediumUrl ||
                  imgData?.smallUrl ||
                  imgData?.s3Url ||
                  imgData?.originalUrl ||
                  null;
            if (rawUrl) {
              results.push({
                name: activity.name,
                image: resolveImageUrl(rawUrl) || rawUrl,
              });
            }
          }
        } catch {
          // Silently skip failed fetches
        }
      }
      return results;
    };

    const enrichAll = async () => {
      const missing = activities.filter((a) => !a.image && !getPlaceImageUrl(a));

      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        if (cancelled) break;

        const batch = missing.slice(i, i + BATCH_SIZE);
        const results = await enrichBatch(batch);

        if (cancelled || results.length === 0) continue;

        // Update store with resolved images
        const state = useCreateTripStore.getState();
        const newDays = [...state.days];
        if (!newDays[dayIndex]) continue;

        const updatedActivities = [...newDays[dayIndex].activities];
        let changed = false;

        for (const result of results) {
          const actIdx = updatedActivities.findIndex(
            (a) => a.name === result.name && !a.image
          );
          if (actIdx >= 0) {
            updatedActivities[actIdx] = {
              ...updatedActivities[actIdx],
              image: result.image,
            };
            changed = true;
          }
        }

        if (changed) {
          newDays[dayIndex] = {
            ...newDays[dayIndex],
            activities: updatedActivities,
          };
          useCreateTripStore.setState({ days: newDays });
        }

        // Delay between batches
        if (i + BATCH_SIZE < missing.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      }
    };

    enrichAll();

    return () => {
      cancelled = true;
    };
  }, [dayIndex, activities, destinationName]);
}
