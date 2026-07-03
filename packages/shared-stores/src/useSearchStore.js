// stores/useSearchStore.js - FIXED: Removed infinite loop imageUrlCache
// NOTE: Browser-specific dynamic imports (../services/api) have been removed.
// In React Native, inject the API service or import from shared-services.
import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useSearchStore = create()(
  devtools(
    (set, get) => ({
      // ===== SEARCH STATE =====

      // Search results
      aiSearchResults: [],
      searchLocation: "",
      showAIResults: false,

      // Search ID for race condition prevention
      currentSearchId: null,

      // Pagination
      currentPage: 1,
      totalPages: 0,
      hasMore: false,
      totalPlaces: 0,
      isInitialLoad: true,

      // Search metadata
      searchMetadata: {
        lastSearchTime: null,
        searchDuration: 0,
        imageEnhancementStats: null,
        correctedQuery: null,
        wasCorrected: false,
      },

      // Active filters
      activeFilters: {
        radius: 300,
        category: "all",
        tripType: "all",
        budget: "all",
        duration: "all",
        accessibility: "all",
        season: "all",
        crowdLevel: "all",
        safetyRating: "all",
      },

      // Search history (for suggestions and analytics)
      searchHistory: [],

      // Recent searches (for quick access)
      recentSearches: [],

      // ===== SEARCH ACTIONS =====

      // Search ID management
      setCurrentSearchId: (searchId) =>
        set({ currentSearchId: searchId }, false, "setCurrentSearchId"),

      // Results management
      setAiSearchResults: (results) =>
        set({ aiSearchResults: results }, false, "setAiSearchResults"),

      // Add search ID validation to prevent stale updates
      addToAiSearchResults: (newResults, searchId = null) =>
        set(
          (state) => {
            // If searchId provided, validate it's still current
            if (
              searchId &&
              state.currentSearchId &&
              searchId !== state.currentSearchId
            ) {
              console.log(
                `Ignoring stale results for search ID: ${searchId}, current: ${state.currentSearchId}`
              );
              return state; // No update for stale results
            }

            return {
              aiSearchResults: [...state.aiSearchResults, ...newResults],
            };
          },
          false,
          "addToAiSearchResults"
        ),

      // Clear search results with search ID reset
      clearSearchResults: () =>
        set(
          {
            aiSearchResults: [],
            showAIResults: false,
            searchLocation: "",
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
            totalPlaces: 0,
            isInitialLoad: true,
            currentSearchId: null,
          },
          false,
          "clearSearchResults"
        ),

      // Search location management
      setSearchLocation: (location) =>
        set({ searchLocation: location }, false, "setSearchLocation"),

      // Search visibility
      setShowAIResults: (show) =>
        set({ showAIResults: show }, false, "setShowAIResults"),

      // Pagination management
      setCurrentPage: (page) =>
        set({ currentPage: page }, false, "setCurrentPage"),

      setTotalPages: (total) =>
        set({ totalPages: total }, false, "setTotalPages"),

      setHasMore: (hasMore) => set({ hasMore }, false, "setHasMore"),

      setTotalPlaces: (total) =>
        set({ totalPlaces: total }, false, "setTotalPlaces"),

      setIsInitialLoad: (isInitial) =>
        set({ isInitialLoad: isInitial }, false, "setIsInitialLoad"),

      // Pagination utilities
      incrementPage: () =>
        set(
          (state) => ({ currentPage: state.currentPage + 1 }),
          false,
          "incrementPage"
        ),

      resetPagination: () =>
        set(
          {
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
            totalPlaces: 0,
            isInitialLoad: true,
          },
          false,
          "resetPagination"
        ),

      // Filter management
      setActiveFilters: (filters) =>
        set({ activeFilters: filters }, false, "setActiveFilters"),

      updateFilter: (filterKey, value) =>
        set(
          (state) => ({
            activeFilters: {
              ...state.activeFilters,
              [filterKey]: value,
            },
          }),
          false,
          "updateFilter"
        ),

      resetFilters: () =>
        set(
          {
            activeFilters: {
              radius: 300,
              category: "all",
              tripType: "all",
              budget: "all",
              duration: "all",
              accessibility: "all",
              season: "all",
              crowdLevel: "all",
              safetyRating: "all",
            },
          },
          false,
          "resetFilters"
        ),

      // Search metadata management
      setSearchMetadata: (metadata) =>
        set({ searchMetadata: metadata }, false, "setSearchMetadata"),

      updateSearchMetadata: (updates) =>
        set(
          (state) => ({
            searchMetadata: {
              ...state.searchMetadata,
              ...updates,
            },
          }),
          false,
          "updateSearchMetadata"
        ),

      // Search history management
      addToSearchHistory: (searchTerm, results, metadata = {}) =>
        set(
          (state) => {
            const historyEntry = {
              id: Date.now(),
              searchTerm,
              resultsCount: results.length,
              timestamp: new Date().toISOString(),
              metadata,
            };

            // Keep only last 50 searches
            const updatedHistory = [historyEntry, ...state.searchHistory].slice(
              0,
              50
            );

            return { searchHistory: updatedHistory };
          },
          false,
          "addToSearchHistory"
        ),

      clearSearchHistory: () =>
        set({ searchHistory: [] }, false, "clearSearchHistory"),

      // Recent searches management (for quick access)
      addToRecentSearches: (searchTerm) =>
        set(
          (state) => {
            // Remove duplicate if exists
            const filtered = state.recentSearches.filter(
              (term) => term !== searchTerm
            );

            // Add to beginning and keep only last 10
            const updatedRecent = [searchTerm, ...filtered].slice(0, 10);

            return { recentSearches: updatedRecent };
          },
          false,
          "addToRecentSearches"
        ),

      removeFromRecentSearches: (searchTerm) =>
        set(
          (state) => ({
            recentSearches: state.recentSearches.filter(
              (term) => term !== searchTerm
            ),
          }),
          false,
          "removeFromRecentSearches"
        ),

      clearRecentSearches: () =>
        set({ recentSearches: [] }, false, "clearRecentSearches"),

      // ===== COMPUTED/DERIVED STATE =====

      // Get search statistics
      getSearchStats: () => {
        const state = get();
        return {
          totalSearches: state.searchHistory.length,
          currentResultsCount: state.aiSearchResults.length,
          totalAvailableResults: state.totalPlaces,
          loadingProgress:
            state.totalPlaces > 0
              ? (state.aiSearchResults.length / state.totalPlaces) * 100
              : 0,
          hasActiveFilters: Object.values(state.activeFilters).some(
            (value) => value !== "all" && value !== 300
          ),
          currentQuery: state.searchLocation,
          paginationInfo: {
            currentPage: state.currentPage,
            totalPages: state.totalPages,
            hasMore: state.hasMore,
            isInitial: state.isInitialLoad,
          },
          currentSearchId: state.currentSearchId,
        };
      },

      // Get active filter count
      getActiveFilterCount: () => {
        const state = get();
        return Object.values(state.activeFilters).filter(
          (value) => value !== "all" && value !== 300
        ).length;
      },

      // Check if search is in progress
      isSearchInProgress: () => {
        const state = get();
        return (
          state.searchLocation &&
          !state.showAIResults &&
          state.aiSearchResults.length === 0
        );
      },

      // Get search suggestions based on history
      getSearchSuggestions: (query) => {
        const state = get();
        if (!query || query.length < 2) return [];

        const queryLower = query.toLowerCase();

        // Get suggestions from search history
        const historySuggestions = state.searchHistory
          .filter(
            (entry) =>
              entry.searchTerm.toLowerCase().includes(queryLower) &&
              entry.searchTerm.toLowerCase() !== queryLower
          )
          .map((entry) => ({
            text: entry.searchTerm,
            type: "history",
            resultsCount: entry.resultsCount,
            lastSearched: entry.timestamp,
          }))
          .slice(0, 5);

        // Get suggestions from recent searches
        const recentSuggestions = state.recentSearches
          .filter(
            (term) =>
              term.toLowerCase().includes(queryLower) &&
              term.toLowerCase() !== queryLower
          )
          .map((term) => ({
            text: term,
            type: "recent",
          }))
          .slice(0, 3);

        // Combine and deduplicate
        const allSuggestions = [...recentSuggestions, ...historySuggestions];
        const uniqueSuggestions = allSuggestions.filter(
          (suggestion, index, self) =>
            index === self.findIndex((s) => s.text === suggestion.text)
        );

        return uniqueSuggestions.slice(0, 8);
      },

      // ===== UTILITY ACTIONS =====

      // Complete search workflow
      // NOTE: In React Native, the API import (../services/api) must be replaced.
      // Inject the destinationAPI or import from shared-services.
      performSearch: async (
        searchTerm,
        filters = null,
        resetResults = true
      ) => {
        const state = get();
        const searchFilters = filters || state.activeFilters;

        try {
          // Generate search ID for this request
          const searchId = `search-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          state.setCurrentSearchId(searchId);

          // Update search state
          if (resetResults) {
            state.setSearchLocation(searchTerm);
            state.resetPagination();
            state.setAiSearchResults([]);
            state.setShowAIResults(false);
          }

          // Add to recent searches
          state.addToRecentSearches(searchTerm);

          // Record search start time
          const searchStartTime = Date.now();

          // TODO: Import API from React Native services layer
          // const { destinationAPI } = await import("@prayana/shared-services");
          console.warn("performSearch: API import not configured for React Native yet");
          throw new Error("API not configured for React Native");
        } catch (error) {
          console.error("Search error:", error);

          // Add failed search to history for analytics
          state.addToSearchHistory(searchTerm, [], {
            error: error.message,
            duration:
              Date.now() -
              (state.searchMetadata.lastSearchTime
                ? new Date(state.searchMetadata.lastSearchTime).getTime()
                : Date.now()),
          });

          throw error;
        }
      },

      // Reset entire search state with search ID
      resetSearchState: () =>
        set(
          {
            aiSearchResults: [],
            searchLocation: "",
            showAIResults: false,
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
            totalPlaces: 0,
            isInitialLoad: true,
            currentSearchId: null,
            searchMetadata: {
              lastSearchTime: null,
              searchDuration: 0,
              imageEnhancementStats: null,
              correctedQuery: null,
              wasCorrected: false,
            },
          },
          false,
          "resetSearchState"
        ),
    }),
    {
      name: "SearchStore",
    }
  )
);

export { useSearchStore };
