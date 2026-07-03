// hooks/useItinerary.js
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
// TODO: Migrate itineraryService to shared-services
const itineraryService = { getItinerary: async () => null };

export const useItinerary = (itineraryId) => {
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Memoized error handler
  const handleError = useCallback((err) => {
    console.error("Itinerary fetch error:", err);
    setError(err.message || "Failed to load itinerary");
  }, []);

  // Memoized success handler
  const handleSuccess = useCallback((data) => {
    setItinerary(data);
    setError(null);
  }, []);

  // Fetch function with abort controller
  const fetchItinerary = useCallback(
    async (id) => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Cancel previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        const response = await itineraryService.getItinerary(id, {
          signal: abortControllerRef.current.signal,
        });

        if (response?.data) {
          handleSuccess(response.data);
        } else {
          throw new Error("No itinerary data received");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          handleError(err);
        }
      } finally {
        setLoading(false);
      }
    },
    [handleError, handleSuccess]
  );

  // Effect to fetch itinerary
  useEffect(() => {
    fetchItinerary(itineraryId);

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [itineraryId, fetchItinerary]);

  // Memoized return value
  const result = useMemo(
    () => ({
      itinerary,
      loading,
      error,
      refetch: () => fetchItinerary(itineraryId),
    }),
    [itinerary, loading, error, fetchItinerary, itineraryId]
  );

  return result;
};
