// services/socketService.js - Socket.IO client for instant real-time collaboration
// Adapted for React Native: replaced process.env with configurable URL via API_CONFIG
import { io } from "socket.io-client";
import { API_CONFIG } from "./apiConfig";

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentTripId = null;
    this.listeners = new Map(); // Map<eventName, Set<callback>>
    this.pendingListeners = []; // Queued listeners added before socket init
  }

  /**
   * Connect to Socket.IO server
   * @param {string} firebaseToken - Firebase authentication token
   */
  connect(firebaseToken) {
    if (this.socket && this.connected) {
      console.log("Already connected to Socket.IO");
      return this.socket;
    }

    // Extract base URL without /api suffix
    const apiUrl = API_CONFIG.BASE_URL;
    const SOCKET_URL = apiUrl.replace(/\/api$/, ""); // Remove /api if present

    console.log(`[Socket] Connecting to Socket.IO at ${SOCKET_URL}/trip`);

    this.socket = io(`${SOCKET_URL}/trip`, {
      auth: { token: firebaseToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection events
    this.socket.on("connect", () => {
      this.connected = true;
      console.log("[Socket] Connected");

      // Rejoin trip room if we were in one
      if (this.currentTripId) {
        this.socket.emit("join-trip", { tripId: this.currentTripId });
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.connected = false;
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
    });

    this.socket.on("error", (error) => {
      console.error("[Socket] Error:", error);
    });

    // Flush any listeners that were queued before socket was created
    if (this.pendingListeners.length > 0) {
      console.log(`[Socket] Attaching ${this.pendingListeners.length} queued listeners`);
      for (const { event, callback } of this.pendingListeners) {
        this.on(event, callback);
      }
      this.pendingListeners = [];
    }

    return this.socket;
  }

  /**
   * Join a trip room for real-time updates
   * @param {string} tripId - Trip ID to join
   */
  joinTrip(tripId) {
    if (!this.socket) {
      console.error("Socket not initialized - cannot join trip");
      return;
    }

    this.currentTripId = tripId;

    // If already connected, join immediately
    if (this.connected) {
      this.socket.emit("join-trip", { tripId });
      console.log(`[Socket] Joining trip room: ${tripId}`);
    } else {
      // Wait for connection, then join
      console.log(`[Socket] Waiting for connection before joining trip ${tripId}...`);
      this.socket.once("connect", () => {
        this.socket.emit("join-trip", { tripId });
        console.log(`[Socket] Joining trip room (after connect): ${tripId}`);
      });
    }
  }

  /**
   * Leave current trip room
   */
  leaveTrip() {
    if (!this.socket || !this.currentTripId) return;

    this.socket.emit("leave-trip", { tripId: this.currentTripId });
    this.currentTripId = null;
    console.log("[Socket] Left trip room");
  }

  /**
   * Broadcast trip update to all collaborators
   * @param {string} tripId - Trip ID
   * @param {Object} changes - Changes made to trip
   * @param {string} field - Field that was changed
   */
  broadcastUpdate(tripId, changes, field) {
    if (!this.socket || !this.connected) {
      console.warn("[Socket] Socket not connected - cannot broadcast", {
        hasSocket: !!this.socket,
        connected: this.connected,
        currentTripId: this.currentTripId
      });
      return;
    }

    console.log(`[Socket] Emitting trip-update`, {
      tripId,
      field,
      destinationsCount: changes?.destinations?.length,
      daysCount: changes?.days?.length,
      socketConnected: this.connected,
      currentTripId: this.currentTripId
    });

    this.socket.emit("trip-update", {
      tripId,
      changes,
      field,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Socket] Broadcast sent: ${field}`);
  }

  /**
   * Notify that user is editing a field
   * @param {string} tripId - Trip ID
   * @param {string} field - Field being edited
   */
  notifyEditing(tripId, field) {
    if (!this.socket || !this.connected) return;

    this.socket.emit("editing", { tripId, field });
  }

  /**
   * Notify that user stopped editing
   * @param {string} tripId - Trip ID
   */
  stopEditing(tripId) {
    if (!this.socket || !this.connected) return;

    this.socket.emit("stop-editing", { tripId });
  }

  /**
   * Send heartbeat to maintain presence
   * @param {string} tripId - Trip ID
   */
  heartbeat(tripId) {
    if (!this.socket || !this.connected) return;

    this.socket.emit("heartbeat", { tripId });
  }

  /**
   * Send chat message to trip collaborators
   * @param {string} tripId - Trip ID
   * @param {Object} message - Message object with userId, userName, text, timestamp
   */
  sendChatMessage(tripId, message) {
    if (!this.socket || !this.connected) {
      console.warn("Socket not connected - cannot send chat message");
      return;
    }

    // Server expects message as an object with a `message` field so it can spread it
    const messageObj = typeof message === 'string' ? { message } : message;
    this.socket.emit("chat-message", { tripId, message: messageObj });
    console.log(`[Socket] Sent chat message`);
  }

  /**
   * Notify that user is typing in chat
   * @param {string} tripId - Trip ID
   */
  notifyTyping(tripId) {
    if (!this.socket || !this.connected) return;

    this.socket.emit("typing", { tripId });
  }

  /**
   * Stop typing notification
   * @param {string} tripId - Trip ID
   */
  stopTyping(tripId) {
    if (!this.socket || !this.connected) return;

    this.socket.emit("stop-typing", { tripId });
  }

  /**
   * Listen to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.socket) {
      // Queue listener to be attached when socket connects
      this.pendingListeners.push({ event, callback });
      console.log(`[Socket] Queued listener for "${event}" (socket not yet initialized)`);
      return;
    }

    // Store listener in a Set to allow multiple listeners per event
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    this.socket.on(event, callback);
    console.log(`[Socket] Registered listener for event: ${event}`);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Optional specific callback to remove
   */
  off(event, callback) {
    if (!this.socket) return;

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      if (callback) {
        // Remove specific callback
        this.socket.off(event, callback);
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      } else {
        // Remove all callbacks for this event
        callbacks.forEach(cb => {
          this.socket.off(event, cb);
        });
        this.listeners.delete(event);
      }
      console.log(`[Socket] Removed listener(s) for event: ${event}`);
    }
  }

  /**
   * Disconnect from Socket.IO
   */
  disconnect() {
    if (this.socket) {
      // Leave current trip if any
      if (this.currentTripId) {
        this.leaveTrip();
      }

      // Remove all listeners
      this.listeners.forEach((_, event) => {
        this.off(event);
      });
      this.listeners.clear();

      // Disconnect socket
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentTripId = null;
      this.pendingListeners = [];

      console.log("[Socket] Disconnected");
    }
  }

  /**
   * Get connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      connected: this.connected,
      tripId: this.currentTripId,
      hasSocket: !!this.socket,
    };
  }
}

// Export singleton instance
export default new SocketService();
