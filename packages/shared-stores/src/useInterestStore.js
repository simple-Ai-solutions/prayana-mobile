import { create } from "zustand";

export const useInterestStore = create((set) => ({
  currentInterest: null,
  interestData: null,
  loading: false,
  error: null,

  setCurrentInterest: (interest) => set({ currentInterest: interest }),

  setInterestData: (data) => set({ interestData: data }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearInterest: () => set({
    currentInterest: null,
    interestData: null,
    error: null,
    loading: false
  })
}));
