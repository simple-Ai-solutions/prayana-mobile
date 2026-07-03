// stores/useUIStore.js - UI State Management with Zustand
import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useUIStore = create()(
  devtools(
    (set, get) => ({
      // ===== MODAL STATES =====

      // Place details modal
      showPlaceModal: false,
      selectedPlace: null,

      // Filters modal
      showFilters: false,

      // Other modals
      showImageGallery: false,
      showTripPlanningModal: false,
      showUserProfileModal: false,

      // ===== LOADING STATES =====

      // Component-specific loading states
      loadingStates: {
        placeDetails: false,
        imageEnhancement: false,
        aiSearch: false,
        loadMore: false,
        filters: false,
        navigation: false,
      },

      // ===== NOTIFICATION SYSTEM =====

      // Toast notifications
      notifications: [],

      // System messages
      systemMessage: null,

      // ===== UI PREFERENCES =====

      // Layout preferences
      layoutPreferences: {
        sidebarCollapsed: false,
        gridView: "card", // 'card', 'list', 'compact'
        itemsPerPage: 12,
        showImagePreviews: true,
      },

      // Navigation state
      navigationState: {
        activeTab: "home",
        breadcrumbs: [],
        canGoBack: false,
        canGoForward: false,
      },

      // Search UI state
      searchUIState: {
        showSuggestions: false,
        selectedSuggestionIndex: -1,
        showSearchHistory: false,
        searchInputFocused: false,
      },

      // ===== MODAL ACTIONS =====

      // Place modal management
      setShowPlaceModal: (show) =>
        set({ showPlaceModal: show }, false, "setShowPlaceModal"),

      setSelectedPlace: (place) =>
        set({ selectedPlace: place }, false, "setSelectedPlace"),

      openPlaceModal: (place) =>
        set(
          {
            selectedPlace: place,
            showPlaceModal: true,
          },
          false,
          "openPlaceModal"
        ),

      closePlaceModal: () =>
        set(
          {
            selectedPlace: null,
            showPlaceModal: false,
          },
          false,
          "closePlaceModal"
        ),

      // Filters modal management
      setShowFilters: (show) =>
        set({ showFilters: show }, false, "setShowFilters"),

      toggleFilters: () =>
        set(
          (state) => ({ showFilters: !state.showFilters }),
          false,
          "toggleFilters"
        ),

      // Image gallery management
      setShowImageGallery: (show) =>
        set({ showImageGallery: show }, false, "setShowImageGallery"),

      // Trip planning modal
      setShowTripPlanningModal: (show) =>
        set({ showTripPlanningModal: show }, false, "setShowTripPlanningModal"),

      // User profile modal
      setShowUserProfileModal: (show) =>
        set({ showUserProfileModal: show }, false, "setShowUserProfileModal"),

      // Close all modals
      closeAllModals: () =>
        set(
          {
            showPlaceModal: false,
            showFilters: false,
            showImageGallery: false,
            showTripPlanningModal: false,
            showUserProfileModal: false,
            selectedPlace: null,
          },
          false,
          "closeAllModals"
        ),

      // ===== LOADING STATE MANAGEMENT =====

      setLoadingState: (key, loading) =>
        set(
          (state) => ({
            loadingStates: {
              ...state.loadingStates,
              [key]: loading,
            },
          }),
          false,
          "setLoadingState"
        ),

      // Convenience methods for specific loading states
      setPlaceDetailsLoading: (loading) => {
        const { setLoadingState } = get();
        setLoadingState("placeDetails", loading);
      },

      setImageEnhancementLoading: (loading) => {
        const { setLoadingState } = get();
        setLoadingState("imageEnhancement", loading);
      },

      setAiSearchLoading: (loading) => {
        const { setLoadingState } = get();
        setLoadingState("aiSearch", loading);
      },

      setLoadMoreLoading: (loading) => {
        const { setLoadingState } = get();
        setLoadingState("loadMore", loading);
      },

      // Clear all loading states
      clearAllLoadingStates: () =>
        set(
          {
            loadingStates: {
              placeDetails: false,
              imageEnhancement: false,
              aiSearch: false,
              loadMore: false,
              filters: false,
              navigation: false,
            },
          },
          false,
          "clearAllLoadingStates"
        ),

      // ===== NOTIFICATION MANAGEMENT =====

      addNotification: (notification) =>
        set(
          (state) => ({
            notifications: [
              {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                type: "info", // 'info', 'success', 'warning', 'error'
                category: "general", // 'general', 'collaboration'
                read: false,
                duration: 5000,
                ...notification,
              },
              ...state.notifications,
            ].slice(0, 50), // keep at most 50 notifications
          }),
          false,
          "addNotification"
        ),

      markAllRead: () =>
        set(
          (state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
          }),
          false,
          "markAllRead"
        ),

      removeNotification: (id) =>
        set(
          (state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }),
          false,
          "removeNotification"
        ),

      clearNotifications: () =>
        set({ notifications: [] }, false, "clearNotifications"),

      // Convenience methods for different notification types
      showSuccess: (message, options = {}) => {
        const { addNotification } = get();
        addNotification({
          type: "success",
          message,
          ...options,
        });
      },

      showError: (message, options = {}) => {
        const { addNotification } = get();
        addNotification({
          type: "error",
          message,
          duration: 8000, // Longer duration for errors
          ...options,
        });
      },

      showWarning: (message, options = {}) => {
        const { addNotification } = get();
        addNotification({
          type: "warning",
          message,
          ...options,
        });
      },

      showInfo: (message, options = {}) => {
        const { addNotification } = get();
        addNotification({
          type: "info",
          message,
          ...options,
        });
      },

      // System message management
      setSystemMessage: (message) =>
        set({ systemMessage: message }, false, "setSystemMessage"),

      clearSystemMessage: () =>
        set({ systemMessage: null }, false, "clearSystemMessage"),

      // ===== LAYOUT PREFERENCES =====

      setLayoutPreferences: (preferences) =>
        set({ layoutPreferences: preferences }, false, "setLayoutPreferences"),

      updateLayoutPreference: (key, value) =>
        set(
          (state) => ({
            layoutPreferences: {
              ...state.layoutPreferences,
              [key]: value,
            },
          }),
          false,
          "updateLayoutPreference"
        ),

      toggleSidebar: () =>
        set(
          (state) => ({
            layoutPreferences: {
              ...state.layoutPreferences,
              sidebarCollapsed: !state.layoutPreferences.sidebarCollapsed,
            },
          }),
          false,
          "toggleSidebar"
        ),

      setGridView: (view) =>
        set(
          (state) => ({
            layoutPreferences: {
              ...state.layoutPreferences,
              gridView: view,
            },
          }),
          false,
          "setGridView"
        ),

      // ===== NAVIGATION STATE =====

      setNavigationState: (state) =>
        set({ navigationState: state }, false, "setNavigationState"),

      updateNavigationState: (updates) =>
        set(
          (state) => ({
            navigationState: {
              ...state.navigationState,
              ...updates,
            },
          }),
          false,
          "updateNavigationState"
        ),

      setActiveTab: (tab) =>
        set(
          (state) => ({
            navigationState: {
              ...state.navigationState,
              activeTab: tab,
            },
          }),
          false,
          "setActiveTab"
        ),

      setBreadcrumbs: (breadcrumbs) =>
        set(
          (state) => ({
            navigationState: {
              ...state.navigationState,
              breadcrumbs,
            },
          }),
          false,
          "setBreadcrumbs"
        ),

      addBreadcrumb: (crumb) =>
        set(
          (state) => ({
            navigationState: {
              ...state.navigationState,
              breadcrumbs: [...state.navigationState.breadcrumbs, crumb],
            },
          }),
          false,
          "addBreadcrumb"
        ),

      // ===== SEARCH UI STATE =====

      setSearchUIState: (state) =>
        set({ searchUIState: state }, false, "setSearchUIState"),

      updateSearchUIState: (updates) =>
        set(
          (state) => ({
            searchUIState: {
              ...state.searchUIState,
              ...updates,
            },
          }),
          false,
          "updateSearchUIState"
        ),

      setShowSuggestions: (show) =>
        set(
          (state) => ({
            searchUIState: {
              ...state.searchUIState,
              showSuggestions: show,
            },
          }),
          false,
          "setShowSuggestions"
        ),

      setSelectedSuggestionIndex: (index) =>
        set(
          (state) => ({
            searchUIState: {
              ...state.searchUIState,
              selectedSuggestionIndex: index,
            },
          }),
          false,
          "setSelectedSuggestionIndex"
        ),

      // ===== COMPUTED/DERIVED STATE =====

      // Check if any modal is open
      isAnyModalOpen: () => {
        const state = get();
        return (
          state.showPlaceModal ||
          state.showFilters ||
          state.showImageGallery ||
          state.showTripPlanningModal ||
          state.showUserProfileModal
        );
      },

      // Check if any loading is in progress
      isAnyLoading: () => {
        const state = get();
        return Object.values(state.loadingStates).some((loading) => loading);
      },

      // Get active (unread) notifications count
      getActiveNotificationsCount: () => {
        const state = get();
        return state.notifications.filter((n) => !n.read).length;
      },

      // Get notifications by type
      getNotificationsByType: (type) => {
        const state = get();
        return state.notifications.filter((n) => n.type === type);
      },

      // Check if UI is in search mode
      isInSearchMode: () => {
        const state = get();
        return (
          state.searchUIState.searchInputFocused ||
          state.searchUIState.showSuggestions ||
          state.searchUIState.showSearchHistory
        );
      },

      // ===== UTILITY ACTIONS =====

      // Reset all UI state (useful for cleanup)
      resetUIState: () =>
        set(
          {
            showPlaceModal: false,
            selectedPlace: null,
            showFilters: false,
            showImageGallery: false,
            showTripPlanningModal: false,
            showUserProfileModal: false,
            loadingStates: {
              placeDetails: false,
              imageEnhancement: false,
              aiSearch: false,
              loadMore: false,
              filters: false,
              navigation: false,
            },
            notifications: [],
            systemMessage: null,
            searchUIState: {
              showSuggestions: false,
              selectedSuggestionIndex: -1,
              showSearchHistory: false,
              searchInputFocused: false,
            },
          },
          false,
          "resetUIState"
        ),

      // Handle keyboard shortcuts
      // NOTE: In React Native, keyboard shortcuts are not applicable.
      // This is kept for API compatibility but is a no-op on mobile.
      handleKeyboard: (key, ctrlKey = false, shiftKey = false) => {
        const state = get();

        switch (key) {
          case "Escape":
            if (state.isAnyModalOpen()) {
              state.closeAllModals();
            }
            break;
          default:
            break;
        }
      },
    }),
    {
      name: "UIStore", // DevTools name
    }
  )
);

export { useUIStore };
