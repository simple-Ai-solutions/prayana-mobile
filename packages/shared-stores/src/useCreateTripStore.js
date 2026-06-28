// stores/useCreateTripStore.js - Zustand store for Create a Trip feature
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { mmkvStorage } from "./storage";

// Helper: Regenerate day slots when destinations change
function regenerateDays(destinations, startDate, existingDays = []) {
  const days = [];
  let currentDate = startDate ? new Date(startDate) : null;
  let dayNumber = 1;

  destinations.forEach((dest, destIndex) => {
    for (let d = 0; d < (dest.duration || 1); d++) {
      const existingDay = existingDays.find((ed) => ed.dayNumber === dayNumber);
      days.push({
        dayNumber,
        date: currentDate ? new Date(currentDate).toISOString() : null,
        title: `Day ${dayNumber} - ${dest.name}`,
        destinationIndex: destIndex,
        activities: existingDay?.activities || [],
        notes: existingDay?.notes || "",
        transportToNext: existingDay?.transportToNext || null,
      });
      if (currentDate) {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      dayNumber++;
    }
  });

  return days;
}

const useCreateTripStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === TRIP DATA ===
        tripId: null,
        tempTripId: null, // Temporary client-side ID for real-time collaboration before first save
        name: "My Trip",
        description: "",
        startDate: null,
        endDate: null,
        travelers: 1,
        kids: 0,
        budget: "moderate",
        tripType: "leisure",
        tripStyles: [],
        currency: "INR",
        coverImage: null,

        // === DESTINATIONS (ordered) ===
        destinations: [],

        // === DAYS ===
        days: [],

        // === UI STATE ===
        currentStep: 1,
        selectedDayIndex: 0,
        isSaving: false,
        hasUnsavedChanges: false,
        lastSaved: null,
        errors: {},

        // === BUDGET TRACKING ===
        budgetAmount: 0, // Total budget in selected currency
        expenses: [], // [{id, category, amount, note, dayIndex, activityName, date, paidBy, splitAmong, splitType, customSplits}]
        budgetCategories: {
          accommodation: 0,
          food: 0,
          transport: 0,
          activities: 0,
          shopping: 0,
          misc: 0,
        },
        offlineMembers: [], // [{ id, name }] — name-only trip members with no account
        settledTransactions: {}, // { "from:to:amount": { settledAt: ISO } }

        // === AI SUGGESTIONS ===
        destinationSuggestions: [],
        activitySuggestions: [],
        isLoadingSuggestions: false,

        // === COLLABORATION ===
        collaborators: [],
        activeEditors: [],
        isCollaborating: false,
        isPolling: false,
        broadcastCallback: null, // Set by useCollaboration hook for instant broadcasts
        fieldPresence: {}, // { [fieldName]: [{userId, userName, avatar, color}] }
        userRole: null, // "owner" | "editor" | "viewer" | null — derived from trip data on load

        // === STEP 1 ACTIONS ===
        setName: (name) => {
          set({ name, hasUnsavedChanges: true });
          get().broadcastChanges('name');
        },

        setDates: (startDate, endDate) => {
          const state = get();
          const newDays = regenerateDays(
            state.destinations,
            startDate,
            state.days
          );
          set({ startDate, endDate, days: newDays, hasUnsavedChanges: true });
          get().broadcastChanges('dates');
        },

        setTravelers: (travelers) => {
          set({ travelers, hasUnsavedChanges: true });
          get().broadcastChanges('travelers');
        },

        setKids: (kids) => {
          set({ kids, hasUnsavedChanges: true });
          get().broadcastChanges('kids');
        },

        setBudget: (budget) => {
          set({ budget, hasUnsavedChanges: true });
          get().broadcastChanges('budget');
        },

        setTripType: (tripType) => {
          set({ tripType, hasUnsavedChanges: true });
          get().broadcastChanges('tripType');
        },

        setTripStyles: (tripStyles) => {
          set({ tripStyles, hasUnsavedChanges: true });
          get().broadcastChanges('tripStyles');
        },

        toggleTripStyle: (style) => {
          const cur = get().tripStyles || [];
          const next = cur.includes(style)
            ? cur.filter((s) => s !== style)
            : [...cur, style];
          set({ tripStyles: next, hasUnsavedChanges: true });
          get().broadcastChanges('tripStyles');
        },

        setCurrency: (currency) => {
          set({ currency, hasUnsavedChanges: true });
          get().broadcastChanges('currency');
        },

        setCoverImage: (coverImage) => {
          set({ coverImage, hasUnsavedChanges: true });
          get().broadcastChanges('coverImage');
        },

        setDescription: (description) => {
          set({ description, hasUnsavedChanges: true });
          get().broadcastChanges('description');
        },

        // === BUDGET ACTIONS ===
        setBudgetAmount: (amount) => {
          set({ budgetAmount: amount, hasUnsavedChanges: true });
          get().broadcastChanges('budgetAmount');
        },

        addExpense: (expense) => {
          const state = get();
          const newExpense = {
            // Collision-proof id: Date.now() alone collides for two expenses
            // added in the same millisecond (delete-one-removes-both + dup React keys).
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: new Date().toISOString(),
            ...expense,
          };
          set({ expenses: [...state.expenses, newExpense], hasUnsavedChanges: true });
          get().broadcastChanges('expenses');
        },

        removeExpense: (expenseId) => {
          const state = get();
          set({ expenses: state.expenses.filter(e => e.id !== expenseId), hasUnsavedChanges: true });
          get().broadcastChanges('expenses');
        },

        updateExpense: (id, patch) => {
          set((state) => ({
            expenses: state.expenses.map((e) => e.id === id ? { ...e, ...patch } : e),
            hasUnsavedChanges: true,
          }));
          get().broadcastChanges('expenses');
        },

        getTotalSpent: () => {
          const state = get();
          return state.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        },

        getSpentByCategory: () => {
          const state = get();
          const byCategory = {};
          state.expenses.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
          });
          return byCategory;
        },

        // === OFFLINE MEMBERS (splitwise guests without accounts) ===
        addOfflineMember: (name) => {
          const state = get();
          const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          set({ offlineMembers: [...state.offlineMembers, { id, name }], hasUnsavedChanges: true });
        },

        removeOfflineMember: (id) => {
          const state = get();
          set({ offlineMembers: state.offlineMembers.filter(m => m.id !== id), hasUnsavedChanges: true });
        },

        // === SETTLEMENT TRACKING ===
        markSettled: (key) => {
          const state = get();
          set({
            settledTransactions: { ...state.settledTransactions, [key]: { settledAt: new Date().toISOString() } },
            hasUnsavedChanges: true,
          });
        },

        unmarkSettled: (key) => {
          const state = get();
          const updated = { ...state.settledTransactions };
          delete updated[key];
          set({ settledTransactions: updated, hasUnsavedChanges: true });
        },

        // === STEP 2 ACTIONS ===
        addDestination: (destination) => {
          const state = get();

          // Auto-calculate duration from dates if this is the first destination
          let suggestedDuration = destination.duration || 2;
          if (state.destinations.length === 0 && state.startDate && state.endDate) {
            const start = new Date(state.startDate);
            const end = new Date(state.endDate);
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            if (totalDays > 0) {
              suggestedDuration = totalDays;
            }
          }

          const newDest = {
            ...destination,
            order: state.destinations.length,
            duration: suggestedDuration,
          };
          const newDestinations = [...state.destinations, newDest];
          const newDays = regenerateDays(
            newDestinations,
            state.startDate,
            state.days
          );
          set({
            destinations: newDestinations,
            days: newDays,
            hasUnsavedChanges: true,
          });

          // Broadcast change instantly
          get().broadcastChanges('destinations');
        },

        removeDestination: (index) => {
          const state = get();
          const newDestinations = state.destinations
            .filter((_, i) => i !== index)
            .map((d, i) => ({ ...d, order: i }));
          const newDays = regenerateDays(newDestinations, state.startDate, []);
          set({
            destinations: newDestinations,
            days: newDays,
            hasUnsavedChanges: true,
          });

          // Broadcast change instantly
          get().broadcastChanges('destinations');
        },

        reorderDestinations: (fromIndex, toIndex) => {
          const state = get();
          const newDestinations = [...state.destinations];
          const [moved] = newDestinations.splice(fromIndex, 1);
          newDestinations.splice(toIndex, 0, moved);
          const reordered = newDestinations.map((d, i) => ({
            ...d,
            order: i,
          }));
          const newDays = regenerateDays(reordered, state.startDate, []);
          set({
            destinations: reordered,
            days: newDays,
            hasUnsavedChanges: true,
          });

          // Broadcast change instantly
          get().broadcastChanges('destinations');
        },

        setDestinationDuration: (index, duration) => {
          const state = get();
          const newDestinations = [...state.destinations];
          newDestinations[index] = { ...newDestinations[index], duration };
          const newDays = regenerateDays(
            newDestinations,
            state.startDate,
            state.days
          );
          set({
            destinations: newDestinations,
            days: newDays,
            hasUnsavedChanges: true,
          });

          // Broadcast change instantly
          get().broadcastChanges('destinations');
        },

        updateDestinationNotes: (index, notes) => {
          const state = get();
          const newDestinations = [...state.destinations];
          newDestinations[index] = { ...newDestinations[index], notes };
          set({ destinations: newDestinations, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges('destinations');
        },

        // === STEP 3 ACTIONS ===
        addActivity: (dayIndex, activity) => {
          const state = get();
          const newDays = [...state.days];
          const newActivity = {
            ...activity,
            order: newDays[dayIndex].activities.length,
            activityId: `act_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`,
          };

          // Debug log for coordinates
          console.log('Store: Adding activity:', newActivity.name);
          console.log('Coordinates:', newActivity.coordinates);
          console.log('Has lat/lng?', newActivity.coordinates?.lat, newActivity.coordinates?.lng);

          newDays[dayIndex] = {
            ...newDays[dayIndex],
            activities: [...newDays[dayIndex].activities, newActivity],
          };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`day-${dayIndex}-activities`);
        },

        removeActivity: (dayIndex, activityIndex) => {
          const state = get();
          const newDays = [...state.days];
          newDays[dayIndex] = {
            ...newDays[dayIndex],
            activities: newDays[dayIndex].activities
              .filter((_, i) => i !== activityIndex)
              .map((a, i) => ({ ...a, order: i })),
          };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`day-${dayIndex}-activities`);
        },

        reorderActivities: (dayIndex, fromIndex, toIndex) => {
          const state = get();
          const newDays = [...state.days];
          const activities = [...newDays[dayIndex].activities];
          const [moved] = activities.splice(fromIndex, 1);
          activities.splice(toIndex, 0, moved);
          newDays[dayIndex] = {
            ...newDays[dayIndex],
            activities: activities.map((a, i) => ({ ...a, order: i })),
          };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`day-${dayIndex}-activities`);
        },

        moveActivityBetweenDays: (fromDay, toDay, activityIndex) => {
          const state = get();
          const newDays = [...state.days];
          const activity = newDays[fromDay].activities[activityIndex];
          newDays[fromDay] = {
            ...newDays[fromDay],
            activities: newDays[fromDay].activities.filter(
              (_, i) => i !== activityIndex
            ),
          };
          newDays[toDay] = {
            ...newDays[toDay],
            activities: [
              ...newDays[toDay].activities,
              { ...activity, order: newDays[toDay].activities.length },
            ],
          };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`activities-moved`);
        },

        updateDayNotes: (dayIndex, notes) => {
          const state = get();
          const newDays = [...state.days];
          newDays[dayIndex] = { ...newDays[dayIndex], notes };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`day-${dayIndex}-notes`);
        },

        updateActivityNotes: (dayIndex, activityIndex, notes) => {
          const state = get();
          const newDays = [...state.days];
          const activities = [...newDays[dayIndex].activities];
          activities[activityIndex] = { ...activities[activityIndex], notes };
          newDays[dayIndex] = { ...newDays[dayIndex], activities };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`day-${dayIndex}-activity-${activityIndex}-notes`);
        },

        setTransportToNext: (dayIndex, transport) => {
          const state = get();
          const newDays = [...state.days];
          newDays[dayIndex] = {
            ...newDays[dayIndex],
            transportToNext: transport,
          };
          set({ days: newDays, hasUnsavedChanges: true });

          // Broadcast change instantly
          get().broadcastChanges(`day-${dayIndex}-transport`);
        },

        // === NAVIGATION ===
        setCurrentStep: (step) => set({ currentStep: step }),
        setSelectedDayIndex: (index) => set({ selectedDayIndex: index }),
        nextStep: () =>
          set((state) => ({
            currentStep: Math.min(state.currentStep + 1, 4),
          })),
        prevStep: () =>
          set((state) => ({
            currentStep: Math.max(state.currentStep - 1, 1),
          })),

        // === AI SUGGESTIONS ===
        setDestinationSuggestions: (suggestions) =>
          set({ destinationSuggestions: suggestions }),
        setActivitySuggestions: (suggestions) =>
          set({ activitySuggestions: suggestions }),
        setIsLoadingSuggestions: (loading) =>
          set({ isLoadingSuggestions: loading }),
        clearSuggestions: () =>
          set({ destinationSuggestions: [], activitySuggestions: [] }),

        // === SAVE/LOAD ===
        setTripId: (tripId) => set({ tripId }),

        // Initialize temporary trip ID for real-time collaboration (like Google Docs)
        initializeTempTripId: () => {
          const state = get();
          if (!state.tempTripId && !state.tripId) {
            const tempTripId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            set({ tempTripId });
            console.log(`Initialized temporary trip ID for collaboration: ${tempTripId}`);
          }
        },

        // Get active trip ID (real tripId or tempTripId)
        getActiveTripId: () => {
          const state = get();
          return state.tripId || state.tempTripId;
        },

        setIsSaving: (saving) => set({ isSaving: saving }),
        markSaved: () =>
          set({
            hasUnsavedChanges: false,
            lastSaved: new Date().toISOString(),
          }),
        setErrors: (errors) => set({ errors }),

        // === LOAD EXISTING TRIP ===
        loadTrip: (tripData) =>
          set({
            tripId: tripData.tripId,
            name: tripData.name,
            description: tripData.description || "",
            startDate: tripData.startDate,
            endDate: tripData.endDate,
            travelers: tripData.travelers || 1,
            kids: tripData.kids || 0,
            budget: tripData.budget || "moderate",
            tripType: tripData.tripType || "leisure",
            currency: tripData.currency || "INR",
            coverImage: tripData.coverImage || null,
            destinations: tripData.destinations || [],
            days: tripData.days || [],
            currentStep: tripData.lastEditedStep || 1,
            hasUnsavedChanges: false,
            errors: {},
            // Budget & splits — restored from saved trip
            budgetAmount: tripData.budgetAmount || 0,
            expenses: tripData.expenses || [],
            budgetCategories: tripData.budgetCategories || { accommodation: 0, food: 0, transport: 0, activities: 0, shopping: 0, misc: 0 },
            offlineMembers: tripData.offlineMembers || [],
            settledTransactions: tripData.settledTransactions || {},
          }),

        // === RESET ===
        resetTrip: () =>
          set({
            tripId: null,
            name: "My Trip",
            description: "",
            startDate: null,
            endDate: null,
            travelers: 1,
            kids: 0,
            budget: "moderate",
            tripType: "leisure",
            currency: "INR",
            coverImage: null,
            destinations: [],
            days: [],
            currentStep: 1,
            selectedDayIndex: 0,
            hasUnsavedChanges: false,
            lastSaved: null,
            errors: {},
            destinationSuggestions: [],
            activitySuggestions: [],
            isLoadingSuggestions: false,
            // Budget & splits reset
            budgetAmount: 0,
            expenses: [],
            budgetCategories: { accommodation: 0, food: 0, transport: 0, activities: 0, shopping: 0, misc: 0 },
            offlineMembers: [],
            settledTransactions: {},
            userRole: null,
          }),

        // === COMPUTED GETTERS ===
        getTotalDays: () => {
          const state = get();
          return state.destinations.reduce(
            (sum, d) => sum + (d.duration || 0),
            0
          );
        },

        getTotalActivities: () => {
          const state = get();
          return state.days.reduce(
            (sum, day) => sum + (day.activities?.length || 0),
            0
          );
        },

        getDestinationForDay: (dayIndex) => {
          const state = get();
          const day = state.days[dayIndex];
          if (!day) return null;
          return state.destinations[day.destinationIndex] || null;
        },

        // === COLLABORATION ACTIONS ===
        setCollaborators: (collaborators) => set({ collaborators }),

        addCollaborator: (collaborator) =>
          set((state) => ({
            collaborators: [...state.collaborators, collaborator],
          })),

        removeCollaborator: (userId) =>
          set((state) => ({
            collaborators: state.collaborators.filter(
              (c) => c.userId !== userId
            ),
          })),

        setActiveEditors: (editors) => set({ activeEditors: editors }),

        setIsPolling: (isPolling) => set({ isPolling }),

        setIsCollaborating: (isCollaborating) => set({ isCollaborating }),

        setUserRole: (userRole) => set({ userRole }),

        // Track which field each remote user is currently editing
        setUserEditingField: (fieldName, user) => set((state) => {
          const updated = { ...state.fieldPresence };
          if (!updated[fieldName]) updated[fieldName] = [];
          // Remove this user from any other field first
          Object.keys(updated).forEach((f) => {
            updated[f] = updated[f].filter((u) => u.userId !== user.userId);
          });
          updated[fieldName] = [...(updated[fieldName] || []), user];
          return { fieldPresence: updated };
        }),

        clearUserEditingField: (userId) => set((state) => {
          const updated = { ...state.fieldPresence };
          Object.keys(updated).forEach((f) => {
            updated[f] = updated[f].filter((u) => u.userId !== userId);
          });
          return { fieldPresence: updated };
        }),

        // Set callback for instant collaboration broadcasting
        setBroadcastCallback: (callback) => set({ broadcastCallback: callback }),

        // Helper to broadcast changes instantly
        broadcastChanges: (field) => {
          const state = get();

          console.log("[BROADCAST DEBUG] broadcastChanges called", {
            field,
            hasCallback: !!state.broadcastCallback,
            isCollaborating: state.isCollaborating,
            activeEditors: state.activeEditors?.length || 0,
            activeEditorsData: state.activeEditors
          });

          // Broadcast as soon as callback is set (even with 1 user)
          // Server filters recipients - this ensures changes are ready when collaborators join
          if (state.broadcastCallback) {
            const { broadcastCallback, ...tripData } = state;
            console.log("[BROADCAST] Sending update to collaborators", {
              field,
              destinationsCount: tripData.destinations?.length,
              daysCount: tripData.days?.length
            });
            state.broadcastCallback(tripData, field);
          } else {
            console.warn("[BROADCAST] Skipped - no callback set yet");
          }
        },

        applyRemoteChanges: (remoteTrip) =>
          set((state) => {
            console.log("[REMOTE CHANGES] Applying remote changes", {
              remoteDestinations: remoteTrip.destinations?.length,
              localDestinations: state.destinations?.length,
              remoteDays: remoteTrip.days?.length,
              localDays: state.days?.length
            });

            // Merge remote changes into local state
            // Use "last write wins" strategy based on updatedAt timestamp
            const newState = {
              ...state,
              name: remoteTrip.name || state.name,
              description: remoteTrip.description || state.description,
              startDate: remoteTrip.startDate || state.startDate,
              endDate: remoteTrip.endDate || state.endDate,
              travelers: remoteTrip.travelers || state.travelers,
              kids: remoteTrip.kids ?? state.kids,
              budget: remoteTrip.budget || state.budget,
              tripType: remoteTrip.tripType || state.tripType,
              currency: remoteTrip.currency || state.currency,
              destinations: remoteTrip.destinations || state.destinations,
              days: remoteTrip.days || state.days,
              collaborators: remoteTrip.collaborators || state.collaborators,
              // Budget & splits sync — merge from remote, prefer remote if present
              budgetAmount: remoteTrip.budgetAmount ?? state.budgetAmount,
              expenses: remoteTrip.expenses || state.expenses,
              offlineMembers: remoteTrip.offlineMembers || state.offlineMembers,
              settledTransactions: remoteTrip.settledTransactions
                ? { ...state.settledTransactions, ...remoteTrip.settledTransactions }
                : state.settledTransactions,
              hasUnsavedChanges: false, // Don't mark as unsaved - these are remote changes
            };

            console.log("[REMOTE CHANGES] Applied successfully", {
              newDestinations: newState.destinations?.length,
              newDays: newState.days?.length
            });

            return newState;
          }),
      }),
      {
        name: "create-trip-store",
        storage: createJSONStorage(() => mmkvStorage),
        partialize: (state) => ({
          tripId: state.tripId,
          name: state.name,
          description: state.description,
          startDate: state.startDate,
          endDate: state.endDate,
          travelers: state.travelers,
          kids: state.kids,
          budget: state.budget,
          tripType: state.tripType,
          currency: state.currency,
          coverImage: state.coverImage,
          destinations: state.destinations,
          days: state.days,
          currentStep: state.currentStep,
          // Budget & splits — persisted so page refresh doesn't wipe data
          budgetAmount: state.budgetAmount,
          expenses: state.expenses,
          offlineMembers: state.offlineMembers,
          settledTransactions: state.settledTransactions,
        }),
      }
    ),
    { name: "CreateTripStore" }
  )
);

export { useCreateTripStore };
