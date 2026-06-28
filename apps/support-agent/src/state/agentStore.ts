// agentStore.ts — Zustand store for the support-agent app. Holds auth state,
// online/offline toggle, the live pending-handoffs queue, and the active
// agent socket connection.
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, socketService } from "@prayana/shared-services";
import { signOut as firebaseSignOut } from "firebase/auth";

// Persist the agent's "go online" preference across app launches so they
// don't have to flip the switch every time. Stored as a plain string so the
// AsyncStorage call is cheap and doesn't pull in JSON parse overhead.
const ONLINE_PREF_KEY = "@prayana/support-agent/online";

type Handoff = {
  sessionId: string;
  customer: { id: string | null; name: string; email: string | null; avatar: string | null };
  escalationReason: string | null;
  escalatedAt: string;
  queuedAt: string;
  destination: string | null;
  tripContext: any;
  recentMessages: Array<{ messageId: string; role: string; senderType: string | null; content: string; timestamp: string }>;
  wasReassigned: boolean;
};

type AgentMessage = {
  messageId: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  senderType: "ai" | "agent" | null;
  agentName?: string;
  content: string;
  timestamp: string;
};

// socketService is untyped JS; connectAgentNamespace returns the full action
// API. Declare it explicitly so the store's action methods type-check.
type AgentSocket = {
  socket: any;
  claim: (sessionId: string) => void;
  send: (sessionId: string, content: string) => void;
  typing: (sessionId: string, isTyping: boolean) => void;
  release: (sessionId: string) => void;
  resolve: (sessionId: string) => void;
  handBackToAI: (sessionId: string) => void;
  heartbeat: () => void;
  disconnect: () => void;
};

type AgentState = {
  isAuthenticated: boolean;
  firebaseToken: string | null;
  agentName: string | null;

  isOnline: boolean;
  agentSocket: AgentSocket | null;

  pendingHandoffs: Record<string, Handoff>;
  activeSessionId: string | null;
  activeMessages: AgentMessage[];

  // Actions
  signInWithToken: (token: string, name: string) => void;
  setFirebaseToken: (token: string) => void;
  signOut: () => void;
  goOnline: () => void;
  goOffline: () => void;
  restoreOnlinePreference: () => Promise<void>;
  claim: (sessionId: string) => void;
  send: (sessionId: string, content: string) => void;
  setTyping: (sessionId: string, isTyping: boolean) => void;
  resolve: (sessionId: string) => void;
  handBackToAI: (sessionId: string) => void;
  release: (sessionId: string) => void;
  loadActive: (sessionId: string, messages: AgentMessage[]) => void;
  appendMessage: (msg: AgentMessage) => void;
};

export const useAgentStore = create<AgentState>((set, get) => ({
  isAuthenticated: false,
  firebaseToken: null,
  agentName: null,

  isOnline: false,
  agentSocket: null,

  pendingHandoffs: {},
  activeSessionId: null,
  activeMessages: [],

  signInWithToken: (token, name) => set({ isAuthenticated: true, firebaseToken: token, agentName: name }),

  // Push refreshed Firebase ID tokens in without bouncing the live socket.
  // Existing socket keeps running; new connects use the fresh token.
  setFirebaseToken: (token) => set({ firebaseToken: token }),

  signOut: () => {
    get().agentSocket?.disconnect();
    set({
      isAuthenticated: false,
      firebaseToken: null,
      agentName: null,
      isOnline: false,
      agentSocket: null,
      pendingHandoffs: {},
      activeSessionId: null,
      activeMessages: [],
    });
    // Tear down Firebase session so next launch shows the login screen.
    firebaseSignOut(auth).catch(() => {});
  },

  goOnline: () => {
    const token = get().firebaseToken;
    if (!token || get().agentSocket) return;
    AsyncStorage.setItem(ONLINE_PREF_KEY, "1").catch(() => {});
    const sock = socketService.connectAgentNamespace(token, {
      onPendingHandoffs: (list: Handoff[]) => {
        const byId: Record<string, Handoff> = {};
        list.forEach((h) => (byId[h.sessionId] = h));
        set({ pendingHandoffs: byId });
      },
      onNewHandoff: (h: Handoff) => {
        set((s) => ({ pendingHandoffs: { ...s.pendingHandoffs, [h.sessionId]: h } }));
      },
      onClaimedByOther: ({ sessionId }: { sessionId: string }) => {
        set((s) => {
          const next = { ...s.pendingHandoffs };
          delete next[sessionId];
          return { pendingHandoffs: next };
        });
      },
      onClaimSucceeded: ({ sessionId }: { sessionId: string }) => {
        set((s) => {
          const next = { ...s.pendingHandoffs };
          delete next[sessionId];
          return { pendingHandoffs: next, activeSessionId: sessionId };
        });
      },
      onCustomerMessage: (msg: any) => {
        if (msg.sessionId !== get().activeSessionId) return;
        get().appendMessage({
          messageId: msg.messageId,
          sessionId: msg.sessionId,
          role: "user",
          senderType: null,
          content: msg.content,
          timestamp: msg.timestamp,
        });
      },
    });
    set({ isOnline: true, agentSocket: sock as unknown as AgentSocket });
  },

  goOffline: () => {
    AsyncStorage.setItem(ONLINE_PREF_KEY, "0").catch(() => {});
    get().agentSocket?.disconnect();
    set({ isOnline: false, agentSocket: null, pendingHandoffs: {} });
  },

  // Called from App.tsx after auth completes. Reads the persisted toggle
  // state and auto-connects the socket if the agent was online last time.
  // Idempotent — safe to call multiple times.
  restoreOnlinePreference: async () => {
    try {
      const v = await AsyncStorage.getItem(ONLINE_PREF_KEY);
      if (v === "1" && !get().isOnline && get().firebaseToken) {
        get().goOnline();
      }
    } catch {
      // Storage failure is non-blocking — agent can flip the toggle manually.
    }
  },

  claim: (sessionId) => get().agentSocket?.claim(sessionId),
  setTyping: (sessionId, isTyping) => {
    try {
      get().agentSocket?.typing(sessionId, isTyping);
    } catch {
      // Typing pings are advisory — silently ignore if socket isn't ready.
    }
  },
  send: (sessionId, content) => {
    get().agentSocket?.send(sessionId, content);
    // Optimistic local append
    get().appendMessage({
      messageId: `local-${Date.now()}`,
      sessionId,
      role: "assistant",
      senderType: "agent",
      agentName: get().agentName || "You",
      content,
      timestamp: new Date().toISOString(),
    });
  },
  resolve: (sessionId) => {
    get().agentSocket?.resolve(sessionId);
    set({ activeSessionId: null, activeMessages: [] });
  },
  handBackToAI: (sessionId) => {
    get().agentSocket?.handBackToAI(sessionId);
    set({ activeSessionId: null, activeMessages: [] });
  },
  release: (sessionId) => {
    get().agentSocket?.release(sessionId);
    set({ activeSessionId: null, activeMessages: [] });
  },

  loadActive: (sessionId, messages) => set({ activeSessionId: sessionId, activeMessages: messages }),
  appendMessage: (msg) => set((s) => ({ activeMessages: [...s.activeMessages, msg] })),
}));
