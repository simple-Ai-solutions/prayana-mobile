// hooks/useCollaboration.js - Real-time collaboration hook with Socket.IO
import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { useCreateTripStore } from "@prayana/shared-stores";
import { useUIStore } from "@prayana/shared-stores";
import { socketService } from "@prayana/shared-services";

// activityTracker is not yet migrated - stub with all required methods
const activityTracker = {
  trackActivity: () => {},
  getActivitySummary: () => ({}),
  clearActivities: () => {},
  addActivity: () => {},
  generateMessage: (type, data) => {
    const name = data?.name || '';
    switch (type) {
      case 'destination-added': return `added ${name} as a destination`;
      case 'name-changed': return `renamed the trip to "${name}"`;
      case 'dates-changed': return 'updated trip dates';
      case 'budget-updated': return `updated the budget${data?.budget ? ` to ${data.budget}` : ''}`;
      case 'expense-added': return `added an expense${data?.category ? ` (${data.category})` : ''}`;
      case 'activity-added': return `added ${name}${data?.day ? ` to ${data.day}` : ''}`;
      case 'activity-moved': return 'reordered activities';
      case 'note-updated': return 'updated notes';
      case 'transport-updated': return 'updated transport';
      default: return 'updated the trip';
    }
  },
  trackUserPresence: () => {},
};

/**
 * Detect activity type from field name
 */
function detectActivityType(field, changes) {
  if (field === "destinations") {
    // Check if destinations array changed
    if (!changes.destinations) return null;
    return "destination-added"; // Default - will be refined by activity data
  }
  if (field === "name") return "name-changed";
  if (field === "dates") return "dates-changed";
  if (field === "budget") return "budget-updated";
  if (field === "budgetAmount") return "budget-updated";
  if (field === "expenses") return "expense-added";
  if (field.includes("day-") && field.includes("activities")) return "activity-added";
  if (field.includes("notes")) return "note-updated";
  if (field.includes("transport")) return "transport-updated";
  if (field === "activities-moved") return "activity-moved";
  return "trip-updated";
}

/**
 * Extract activity data from changes
 */
function extractActivityData(field, changes) {
  const data = {};

  if (field === "destinations" && changes.destinations) {
    const lastDest = changes.destinations[changes.destinations.length - 1];
    data.name = lastDest?.name || "Unknown";
  }

  if (field === "name") {
    data.name = changes.name;
  }

  if (field === "budget") {
    data.budget = changes.budget;
  }

  if (field.includes("day-") && field.includes("activities")) {
    const dayMatch = field.match(/day-(\d+)/);
    if (dayMatch && changes.days) {
      const dayIndex = parseInt(dayMatch[1]);
      const day = changes.days[dayIndex];
      if (day?.activities?.length > 0) {
        const lastActivity = day.activities[day.activities.length - 1];
        data.name = lastActivity?.name || "Unknown";
        data.day = `Day ${dayIndex + 1}`;
      }
    }
  }

  if (field === "expenses" && changes.expenses) {
    const lastExpense = changes.expenses[changes.expenses.length - 1];
    data.amount = lastExpense?.amount;
    data.category = lastExpense?.category;
  }

  return data;
}

// Assign a consistent color to each collaborator based on their userId
const USER_COLORS = [
  "#06B6D4", // cyan
  "#8B5CF6", // purple
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#EC4899", // pink
  "#3B82F6", // blue
  "#F97316", // orange
];

function getUserColor(userId) {
  if (!userId) return USER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

/**
 * Hook for instant real-time collaboration on trips using Socket.IO
 * @param {string} tripId - Trip ID to collaborate on
 * @returns {Object} Collaboration state and methods
 */
export function useCollaboration(tripId) {
  const { user, isLoading: authLoading, getIdToken } = useAuth();
  const {
    setActiveEditors,
    applyRemoteChanges,
    setIsPolling,
    setIsCollaborating,
    setBroadcastCallback,
    setUserEditingField,
    clearUserEditingField,
  } = useCreateTripStore();
  const { addNotification } = useUIStore();

  const heartbeatIntervalRef = useRef(null);

  useEffect(() => {
    // Don't start if:
    // - No trip ID
    // - No user (not authenticated)
    // - Auth still loading
    // - Guest user (no real Firebase token)
    if (!tripId || !user || authLoading || user.uid === 'guest-user') {
      return;
    }

    let isActive = true;

    // Clear stale activities from previous session
    activityTracker.clearActivities();

    // Initialize Socket.IO connection
    const initializeSocket = async () => {
      try {
        const token = await getIdToken();

        if (!isActive) return; // Component unmounted during token fetch

        // Connect to Socket.IO
        const socket = socketService.connect(token);

        // Join trip room
        socketService.joinTrip(tripId);

        // Listen for active users updates
        socketService.on("active-users", (activeUsers) => {
          if (!isActive) return;
          console.log(`Active users: ${activeUsers.length}`);
          setActiveEditors(activeUsers);

          const isCollaborating = activeUsers && activeUsers.length > 1;
          setIsCollaborating(isCollaborating);
        });

        // Listen for trip changes from other users
        socketService.on("trip-changed", ({ userId, userName, changes, field, userAvatar }) => {
          if (!isActive) return;
          console.log(`[COLLAB] Received update from ${userName}: ${field}`, {
            userId,
            changesKeys: changes ? Object.keys(changes) : [],
            destinationsCount: changes?.destinations?.length,
            daysCount: changes?.days?.length
          });

          // Apply remote changes
          if (changes) {
            applyRemoteChanges(changes);

            // Track activity in feed
            const activityType = detectActivityType(field, changes);
            const activityData = extractActivityData(field, changes);

            if (activityType) {
              const activityMessage = activityTracker.generateMessage(activityType, activityData);
              activityTracker.addActivity({
                type: activityType,
                userName: userName || "Someone",
                userAvatar: userAvatar,
                message: activityMessage,
                data: activityData,
              });

              // Only surface meaningful edits (not generic trip-updated) in the bell
              if (activityType !== "trip-updated") {
                const tripName = useCreateTripStore.getState().name;
                addNotification({
                  type: "info",
                  category: "collaboration",
                  subtype: "edit",
                  message: activityMessage,
                  tripId,
                  tripName: tripName || "your trip",
                  userName: userName || "Someone",
                  avatar: userAvatar,
                });
              }
            }
          } else {
            console.warn("[COLLAB] No changes data in trip-changed event");
          }
        });

        // Listen for user joined - skip own join to avoid self-duplicates
        socketService.on("user-joined", ({ userId: joinedUserId, userName, avatar }) => {
          if (!isActive) return;
          if (joinedUserId === user?.uid) return;
          console.log(`${userName} joined the trip`);

          // Track activity
          activityTracker.trackUserPresence("user-joined", userName, avatar);

          // Persist in notification bell
          const tripName = useCreateTripStore.getState().name;
          addNotification({
            type: "info",
            category: "collaboration",
            subtype: "user-joined",
            message: `${userName} joined the trip`,
            tripId,
            tripName: tripName || "your trip",
            userName,
            avatar,
          });
        });

        // Listen for user left - skip own leave to avoid noise
        socketService.on("user-left", ({ userId: leftUserId, userName, avatar }) => {
          if (!isActive) return;
          if (leftUserId === user?.uid) return;
          console.log(`${userName} left the trip`);

          // Track activity
          activityTracker.trackUserPresence("user-left", userName, avatar);

          // Persist in notification bell
          const tripName = useCreateTripStore.getState().name;
          addNotification({
            type: "info",
            category: "collaboration",
            subtype: "user-left",
            message: `${userName} left the trip`,
            tripId,
            tripName: tripName || "your trip",
            userName,
            avatar,
          });
        });

        // Listen for user editing - update field presence in store
        socketService.on("user-editing", ({ userId: editingUserId, userName, avatar, field }) => {
          if (!isActive) return;
          console.log(`${userName} is editing ${field}`);
          setUserEditingField(field, { userId: editingUserId, userName, avatar, color: getUserColor(editingUserId) });
        });

        // Listen for user stopped editing - clear field presence
        socketService.on("user-stopped-editing", ({ userId: stoppedUserId }) => {
          if (!isActive) return;
          clearUserEditingField(stoppedUserId);
        });

        // Send heartbeat every 10 seconds to maintain presence
        heartbeatIntervalRef.current = setInterval(() => {
          socketService.heartbeat(tripId);
        }, 10000);

        setIsPolling(true); // Use same flag to indicate "connected"

        // Listen for full collaborator list (for online/offline display)
        socketService.on("trip-collaborators", ({ collaborators }) => {
          if (!isActive) return;
          const { setCollaborators } = useCreateTripStore.getState();
          setCollaborators(collaborators || []);
        });

        // Set instant broadcast callback (only for editors/owners, not viewers)
        const currentRole = useCreateTripStore.getState().userRole;
        if (currentRole === "viewer") {
          setBroadcastCallback(null); // Viewers don't broadcast edits
          console.log("Viewer mode - broadcast disabled");
        } else {
          setBroadcastCallback((tripData, field) => {
            // Re-check role in case it changed after initial load
            if (useCreateTripStore.getState().userRole === "viewer") return;

            console.log(`[BROADCAST CALLBACK] Broadcasting change: ${field}`, {
              tripId,
              destinationsCount: tripData.destinations?.length,
              daysCount: tripData.days?.length,
              socketConnected: socketService.getStatus().connected
            });
            socketService.broadcastUpdate(tripId, tripData, field);

            // Also track YOUR OWN changes in the activity feed
            const activityType = detectActivityType(field, tripData);
            const activityData = extractActivityData(field, tripData);
            if (activityType && activityType !== "trip-updated") {
              activityTracker.addActivity({
                type: activityType,
                userName: user?.displayName || user?.email || "You",
                userAvatar: user?.photoURL || null,
                message: activityTracker.generateMessage(activityType, activityData),
                data: activityData,
              });
            }
          });
        }

        console.log("Socket.IO collaboration initialized", {
          tripId,
          userId: user?.uid,
          socketConnected: socketService.getStatus().connected
        });
      } catch (error) {
        console.error("Failed to initialize Socket.IO:", error);
        setIsPolling(false);
      }
    };

    initializeSocket();

    // Cleanup on unmount or trip change
    return () => {
      isActive = false;

      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Remove all event listeners
      socketService.off("active-users");
      socketService.off("trip-changed");
      socketService.off("trip-collaborators");
      socketService.off("user-joined");
      socketService.off("user-left");
      socketService.off("user-editing");
      socketService.off("user-stopped-editing");

      // Leave trip and disconnect
      socketService.leaveTrip();
      socketService.disconnect();

      setIsPolling(false);
      setActiveEditors([]);
      setIsCollaborating(false);
      setBroadcastCallback(null); // Clear broadcast callback

      console.log("Socket.IO cleanup complete");
    };
  }, [
    tripId,
    user,
    authLoading,
    getIdToken,
    setActiveEditors,
    applyRemoteChanges,
    setIsPolling,
    setIsCollaborating,
    setBroadcastCallback,
    setUserEditingField,
    clearUserEditingField,
    addNotification,
  ]);

  /**
   * Broadcast update to all collaborators
   * @param {Object} changes - Changes made
   * @param {string} field - Field that was changed
   */
  const broadcastUpdate = (changes, field) => {
    if (!tripId) return;

    socketService.broadcastUpdate(tripId, changes, field);
  };

  /**
   * Notify that user is editing a specific field
   * @param {string} field - Field being edited (e.g., "day-2-activity-3")
   */
  const notifyEditing = (field) => {
    if (!tripId) return;

    socketService.notifyEditing(tripId, field);
  };

  /**
   * Clear editing notification
   */
  const clearEditing = () => {
    if (!tripId) return;

    socketService.stopEditing(tripId);
  };

  const status = socketService.getStatus();

  return {
    isPolling: status.connected, // Reuse "isPolling" to mean "is connected"
    broadcastUpdate,
    notifyEditing,
    clearEditing,
  };
}
