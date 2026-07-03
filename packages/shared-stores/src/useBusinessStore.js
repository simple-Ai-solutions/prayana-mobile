// stores/useBusinessStore.js - Zustand store for Business/Marketplace feature
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { mmkvStorage } from "./storage";

const useBusinessStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // ===== BUSINESS ACCOUNT =====
        businessAccount: null,
        isBusinessLoaded: false,
        isBusinessLoading: false,

        // ===== ONBOARDING WIZARD STATE =====
        onboardingStep: 1, // 1-5
        onboardingData: {
          accountType: null, // "company" | "agent"
          businessDetails: {},
          documents: [],
          firstListing: {},
          payoutDetails: {},
        },

        // ===== DASHBOARD DATA =====
        dashboardData: null,
        dashboardLoading: false,

        // ===== BUSINESS LISTINGS =====
        myListings: [],
        listingsLoading: false,

        // ===== BUSINESS BOOKINGS =====
        myBusinessBookings: [],
        bookingsLoading: false,

        // ===== MARKETPLACE STATE (public browse) =====
        featuredActivities: [],
        featuredLoading: false,

        // ===== ACTIONS =====

        setBusinessAccount: (account) =>
          set({ businessAccount: account, isBusinessLoaded: true, isBusinessLoading: false }),

        setBusinessLoading: (loading) =>
          set({ isBusinessLoading: loading }),

        clearBusinessAccount: () =>
          set({ businessAccount: null, isBusinessLoaded: false }),

        // Onboarding
        setOnboardingStep: (step) =>
          set({ onboardingStep: step }),

        setOnboardingData: (stepKey, data) =>
          set((state) => ({
            onboardingData: { ...state.onboardingData, [stepKey]: data },
          })),

        resetOnboarding: () =>
          set({
            onboardingStep: 1,
            onboardingData: {
              accountType: null,
              businessDetails: {},
              documents: [],
              firstListing: {},
              payoutDetails: {},
            },
          }),

        // Dashboard
        setDashboardData: (data) =>
          set({ dashboardData: data, dashboardLoading: false }),

        setDashboardLoading: (loading) =>
          set({ dashboardLoading: loading }),

        // Listings
        setMyListings: (listings) =>
          set({ myListings: listings, listingsLoading: false }),

        setListingsLoading: (loading) =>
          set({ listingsLoading: loading }),

        addListingToStore: (listing) =>
          set((state) => ({ myListings: [listing, ...state.myListings] })),

        updateListingInStore: (id, updates) =>
          set((state) => ({
            myListings: state.myListings.map((l) =>
              l._id === id ? { ...l, ...updates } : l
            ),
          })),

        removeListingFromStore: (id) =>
          set((state) => ({
            myListings: state.myListings.filter((l) => l._id !== id),
          })),

        // Business bookings
        setMyBusinessBookings: (bookings) =>
          set({ myBusinessBookings: bookings, bookingsLoading: false }),

        setBookingsLoading: (loading) =>
          set({ bookingsLoading: loading }),

        updateBookingInStore: (id, updates) =>
          set((state) => ({
            myBusinessBookings: state.myBusinessBookings.map((b) =>
              b._id === id ? { ...b, ...updates } : b
            ),
          })),

        // Featured activities (marketplace homepage)
        setFeaturedActivities: (activities) =>
          set({ featuredActivities: activities, featuredLoading: false }),

        setFeaturedLoading: (loading) =>
          set({ featuredLoading: loading }),
      }),
      {
        name: "prayana-business-store",
        storage: createJSONStorage(() => mmkvStorage),
        // Only persist essential data, not loading states
        partialize: (state) => ({
          businessAccount: state.businessAccount,
          isBusinessLoaded: state.isBusinessLoaded,
          onboardingStep: state.onboardingStep,
          onboardingData: state.onboardingData,
        }),
      }
    ),
    { name: "BusinessStore" }
  )
);

export default useBusinessStore;
