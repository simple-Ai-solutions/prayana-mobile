// hooks/useTripPlannerSearch.js - Search hook for trip planner with Google Maps + OSM fallback
import { useState, useRef, useCallback, useEffect } from "react";
// TODO: Migrate googleMapsUtils, osmUtils to shared-services
const cachedSearchGoogleMaps = async () => [];
const cachedSearchOSM = async () => [];
const SEARCH_CONFIG = { DEBOUNCE_DELAY: 300, MIN_QUERY_LENGTH: 2 };
const API_ENDPOINTS = {};

export const useTripPlannerSearch = (enableAutoCorrection = false) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [correctedQuery, setCorrectedQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [activeProvider, setActiveProvider] = useState(SEARCH_CONFIG.provider);

  const debounceRef = useRef(null);

  // Google Maps search function
  const performGoogleMapsSearch = useCallback(async (input) => {
    if (!input || input.length < SEARCH_CONFIG.minQueryLength) {
      return { success: false, results: [] };
    }

    setSearchError("");

    try {
      const searchOptions = {
        types: "(regions)", // Focus on geographic regions for travel
      };

      const response = await cachedSearchGoogleMaps(input, searchOptions);

      if (response.success) {
        console.log(`Google Maps: ${response.results.length} results`);
        setActiveProvider("google");
      }

      return response;
    } catch (error) {
      console.error("Google Maps search failed:", error);
      return { success: false, results: [], error: error.message };
    }
  }, []);

  // OSM search function (fallback)
  const performOSMSearch = useCallback(async (input) => {
    if (!input || input.length < SEARCH_CONFIG.minQueryLength) {
      return [];
    }

    setSearchError("");

    try {
      const searchOptions = {
        limit: SEARCH_CONFIG.maxSuggestions,
      };

      const results = await cachedSearchOSM(input, searchOptions);

      if (results.length > 0) {
        console.log(`OSM fallback: ${results.length} results`);
        setActiveProvider("openstreetmap");
      }

      return results;
    } catch (error) {
      console.error("OSM search failed:", error);
      setSearchError(error.message || "Search temporarily unavailable");
      return [];
    }
  }, []);

  // Combined search with fallback logic
  const performSearch = useCallback(async (input) => {
    if (!input || input.length < SEARCH_CONFIG.minQueryLength) {
      return [];
    }

    let results = [];
    let provider = SEARCH_CONFIG.provider;

    // Try Google Maps first if configured as primary provider
    if (provider === "google") {
      const googleResponse = await performGoogleMapsSearch(input);

      if (googleResponse.success && googleResponse.results.length > 0) {
        console.log("Using Google Maps results");
        return googleResponse.results;
      } else {
        console.log("Google Maps failed or returned no results, falling back to OSM");
      }
    }

    // Fallback to OSM if Google fails or if OSM is primary
    const osmResults = await performOSMSearch(input);

    if (osmResults.length > 0) {
      console.log("Using OpenStreetMap results");
      return osmResults;
    }

    // If both fail, set error
    if (results.length === 0) {
      setSearchError("No locations found. Try a different search term.");
    }

    return results;
  }, [performGoogleMapsSearch, performOSMSearch]);

  // Auto-correction check
  const checkAutoCorrection = useCallback(
    async (input) => {
      if (!enableAutoCorrection || input.length < 3) {
        setCorrectedQuery("");
        return;
      }

      try {
        const response = await fetch(API_ENDPOINTS.destinations.autoCorrect, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.corrected && data.corrected !== input) {
            setCorrectedQuery(data.corrected);
          } else {
            setCorrectedQuery("");
          }
        }
      } catch (error) {
        setCorrectedQuery("");
      }
    },
    [enableAutoCorrection]
  );

  // Debounced search with Google Maps + OSM fallback
  const debouncedSearch = useCallback(
    (query) => {
      console.log("debouncedSearch called:", { query, queryLength: query.length, minLength: SEARCH_CONFIG.minQueryLength, hasSearched });

      if (query.length >= SEARCH_CONFIG.minQueryLength) {
        setIsLoading(true);
        setSearchError("");

        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
          try {
            console.log("Performing search for:", query);
            const [suggestionResults] = await Promise.all([
              performSearch(query),
              enableAutoCorrection
                ? checkAutoCorrection(query)
                : Promise.resolve(),
            ]);

            console.log("Search results:", suggestionResults);
            setSuggestions(suggestionResults);
            setShowSuggestions(suggestionResults.length > 0);
          } catch (error) {
            console.error("Search failed:", error);
            setSuggestions([]);
            setSearchError("Search temporarily unavailable");
          } finally {
            setIsLoading(false);
          }
        }, SEARCH_CONFIG.debounceDelay);
      } else {
        console.log("Query too short or already searched");
        setSuggestions([]);
        setShowSuggestions(false);
        setCorrectedQuery("");
        setSearchError("");
        setIsLoading(false);
      }

      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    },
    [performSearch, checkAutoCorrection, hasSearched, enableAutoCorrection]
  );

  // Reset search state
  const resetSearchState = useCallback(() => {
    setHasSearched(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setCorrectedQuery("");
    setSearchError("");
    setSelectedIndex(-1);
    setIsLoading(false);
  }, []);

  // Mark as searched
  const markAsSearched = useCallback(() => {
    setHasSearched(true);
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e, onSearch, query) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === "Enter") {
          e.preventDefault();
          markAsSearched();
          onSearch(query);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            const suggestion = suggestions[selectedIndex];
            const selectedText = suggestion.shortName || suggestion.text;
            markAsSearched();
            onSearch(selectedText, suggestion);
          } else {
            markAsSearched();
            onSearch(query);
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
        default:
          break;
      }
    },
    [showSuggestions, suggestions, selectedIndex, markAsSearched]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion, onSearch) => {
      const selectedText = suggestion.shortName || suggestion.text;
      markAsSearched();
      onSearch(selectedText, suggestion);
    },
    [markAsSearched]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (value) => {
      setSelectedIndex(-1);
      setSearchError("");
      setHasSearched(false);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Use corrected query
  const useCorrectedQuery = useCallback(
    (onSearch) => {
      setCorrectedQuery("");
      markAsSearched();
      onSearch(correctedQuery);
    },
    [correctedQuery, markAsSearched]
  );

  // Hide suggestions
  const hideSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, []);

  // Show suggestions if available and not searched
  const showSuggestionsIfAvailable = useCallback(() => {
    if (suggestions.length > 0 && !hasSearched) {
      setShowSuggestions(true);
    }
  }, [suggestions.length, hasSearched]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // State
    suggestions,
    showSuggestions,
    isLoading,
    selectedIndex,
    correctedQuery,
    searchError,
    hasSearched,
    activeProvider,

    // Actions
    handleInputChange,
    handleKeyDown,
    handleSuggestionClick,
    useCorrectedQuery,
    resetSearchState,
    markAsSearched,
    hideSuggestions,
    showSuggestionsIfAvailable,
  };
};
