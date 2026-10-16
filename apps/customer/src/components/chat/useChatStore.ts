// The Isha conversation, app-wide. A port of the website's stores/useChatStore.js:
// leaving the chat screen minimises it (the conversation, its session and any
// reply in flight carry on), "New chat" is the one way to start over, and the
// last ten chats are kept on the phone so any of them can be resumed with
// Isha's memory of it (each keeps its server session and key).
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeItineraryAPICall } from '@prayana/shared-services';
import { chatService, type ChatStreamError } from './chatService';
import { chatError } from '../../lib/chatStream';
import type {
  ChatContext,
  ChatMessage,
  ChatResponse,
  HandoffMode,
  MediaEvent,
  PageEntity,
  ReplyStep,
  SavedConversation,
  TripFormData,
} from './types';

export const MAX_MESSAGE_LENGTH = 500;
// A reply that hasn't finished after this long is given up on. The agent can
// run several tool turns, so this is generous; it only stops a hung request
// leaving the chat waiting forever.
const REPLY_TIMEOUT_MS = 120000;
const MAX_SAVED_CHATS = 10;

const HISTORY_STORAGE = 'prayana.isha.conversations.v1';
const SESSION_STORAGE = 'prayana.isha.session.v1';
// Before session keys: an id alone, which the server no longer lets us read
const LEGACY_SESSION_STORAGE = 'prayana.chat.sessionId';

export const newMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
const now = () => new Date().toISOString();

/** Whether an earlier message already showed place cards for this reply's destination. */
function topPlacesAlreadyShown(earlier: ChatMessage[], response: { detectedDestination?: string | null; topPlaces?: any[] }) {
  if (!(response?.topPlaces || []).length) return false;
  const key = (m: any) =>
    String(m?.detectedDestination || m?.topPlaces?.[0]?.city || m?.topPlaces?.[0]?.name || '').trim().toLowerCase();
  const k = key(response);
  return earlier.some((m) => (m.topPlaces || []).length > 0 && key(m) === k);
}

// What Isha is doing, as a list: each new status marks the earlier ones done
function addStep(steps: ReplyStep[] = [], text: string) {
  if (!text) return steps;
  const done = steps.map((s) => (s.done ? s : { ...s, done: true }));
  if (done.some((s) => s.text === text)) return done;
  return [...done, { text, done: false }];
}
function finishSteps(steps?: ReplyStep[]) {
  return steps && steps.some((s) => !s.done) ? steps.map((s) => ({ ...s, done: true })) : steps;
}

// The first line of a reply, as plain text, for the launcher
function previewOf(text: unknown) {
  const plain = String(text || '')
    .replace(/[*_#>`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 90 ? `${plain.slice(0, 87).trimEnd()}…` : plain;
}

function friendlyError(error: ChatStreamError | any, { timedOut = false } = {}) {
  if (timedOut) return 'Isha took too long to answer. Try again in a moment.';
  const msg = String(error?.message || '');
  if (error?.code === 'UNAVAILABLE') return "Isha can't be reached right now. Try again in a moment.";
  if (error?.code === 'NETWORK_ERROR' || /network|failed to fetch/i.test(msg)) {
    return "Couldn't reach Isha. Check your connection and try again.";
  }
  // The server explains its own limits ("faster than Isha can keep up",
  // "taking a break for the rest of today")
  if (error?.code === 'RATE_LIMITED') return msg;
  if (error?.status === 429) return 'Lots of people are asking Isha things right now. Try again in a moment.';
  return "Isha couldn't finish that reply. Try again.";
}

type ReplyController = AbortController & { stoppedByUser?: boolean };

// Outside the state: none of these should re-render anything
let replyController: ReplyController | null = null;
let revealTimer: ReturnType<typeof setInterval> | null = null;
let revealResolve: (() => void) | null = null;
let hydration: Promise<void> | null = null;
let storedSession: { sessionId: string | null; sessionKey: string | null } = { sessionId: null, sessionKey: null };

function persistHistory(history: SavedConversation[]) {
  AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify(history)).catch(() => {
    // Too big for storage: keep the five newest
    AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify(history.slice(0, 5))).catch(() => {});
  });
}

function rememberSession(sessionId: string | null, sessionKey: string | null) {
  storedSession = { sessionId, sessionKey };
  AsyncStorage.setItem(SESSION_STORAGE, JSON.stringify(storedSession)).catch(() => {});
}

// Keep just enough of each message to draw the chat again: the heavy cards
// (places, photos, plans) stay behind, a plan's reference comes along
function slimMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.type !== 'loading' && m.type !== 'itinerary_loading' && m.type !== 'trip_planner_form')
    .filter((m) => m.content || m.type === 'itinerary_preview')
    .map((m) => {
      const slim: ChatMessage = {
        id: m.id,
        role: m.role,
        content: m.content,
        type: m.type,
        timestamp: m.timestamp,
        suggestions: m.suggestions,
        ...(m.senderType ? { senderType: m.senderType, agentName: m.agentName } : {}),
        ...(m.deliveryStatus === 'offline' ? { deliveryStatus: 'offline' as const } : {}),
      };
      const plan = m.itinerary || m.itineraryRef;
      if (plan && m.type !== 'itinerary_preview') {
        slim.itineraryRef = {
          slug: plan.slug || null,
          markdownItineraryId: plan.markdownItineraryId || plan.itineraryId || null,
          destination: plan.destination || m.detectedDestination || null,
          duration: plan.duration || null,
          transportMode: plan.transportMode || null,
          title: plan.title || null,
          images: ((m.coverImages?.length ? m.coverImages : m.images) || [])
            .map((img) => (typeof img === 'string' ? img : img?.url))
            .filter((u): u is string => !!u)
            .slice(0, 3),
        };
      }
      if (m.type === 'itinerary_preview') {
        const d = m.itineraryData;
        const full =
          d?.markdown && typeof d.markdown === 'object' ? d.markdown : d?.data && typeof d.data === 'object' ? d.data : d;
        slim.itineraryRef = {
          slug: full?.slug || m.itineraryRef?.slug || null,
          markdownItineraryId: full?.markdownItineraryId || full?.itineraryId || m.itineraryRef?.markdownItineraryId || null,
          destination: m.requestData?.destination || full?.destination || m.itineraryRef?.destination || null,
          duration: m.requestData?.duration || full?.duration || m.itineraryRef?.duration || null,
          transportMode: m.requestData?.transportMode || full?.transportMode || m.itineraryRef?.transportMode || null,
          title: full?.title || m.itineraryRef?.title || null,
        };
      }
      return slim;
    });
}

export type ChatState = {
  messages: ChatMessage[];
  inputMessage: string;
  isChatOpen: boolean;
  hydrated: boolean;
  currentSessionId: string | null;
  // The session's access key: the server only lets the holder of the key (or
  // the signed-in user who started it) read or write the session
  currentSessionKey: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isSending: boolean;
  streamingMessageId: string | null;
  // A message typed while Isha is still replying; sent when she finishes
  queuedMessage: string | null;
  // Replies that land while the chat is minimised, for the launcher
  unreadCount: number;
  replyPreview: string | null;
  chatContext: ChatContext;
  // Whether Isha is told which page the user came from (the composer's chip)
  shareContext: boolean;
  isOnline: boolean;

  // Human handoff: mirrors ChatSession.mode on the server
  mode: HandoffMode;
  assignedAgent: { id?: string; name?: string } | null;
  isEscalating: boolean;
  isCancellingHandoff: boolean;
  agentTyping: boolean;
  handoffOffered: boolean;
  handoffOfferReason: string | null;
  handoffDismissed: boolean;

  conversationHistory: SavedConversation[];
  currentConversationId: string | null;

  isAuthenticated: boolean;
  guestMessageCount: number;
  showLoginPrompt: boolean;
  maxGuestMessages: number;
  loginDismissCount: number;
  forceLogin: boolean;

  hydrate: () => Promise<void>;
  openChat: (context?: { destination?: string | null; pageEntity?: PageEntity | null }) => Promise<void>;
  closeChat: () => void;
  setInputMessage: (text: string) => void;
  setAuthenticated: (value: boolean) => void;
  setOnline: (value: boolean) => void;
  setShareContext: (value: boolean) => void;
  setUserLocation: (loc: ChatContext['userLocation']) => void;
  dismissReplyPreview: () => void;

  addMessage: (message: Partial<ChatMessage> & { role: ChatMessage['role'] }) => string;
  updateMessage: (id: string, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => void;
  removeMessage: (id: string) => void;

  sendMessage: (text: string, opts?: { countAsGuest?: boolean }) => Promise<void>;
  stopGenerating: () => void;
  regenerateLastResponse: () => Promise<void>;
  editAndResend: (id: string, text: string) => Promise<void>;
  retryMessage: (id: string) => Promise<void>;
  flushOfflineMessages: () => Promise<void>;
  continueGenerating: () => Promise<void>;
  finishInterruptedReply: (id: string) => Promise<void>;

  showTripPlannerForm: () => void;
  generateTripItinerary: (form: TripFormData) => Promise<void>;

  saveConversation: () => void;
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => void;
  togglePinConversation: (id: string) => void;
  clearAllConversations: () => void;
  startNewChat: () => Promise<void>;

  escalateToHuman: () => Promise<void>;
  cancelHandoff: () => Promise<void>;
  acceptHandoffOffer: () => Promise<void>;
  dismissHandoffOffer: () => void;
  onModeChanged: (payload: { mode?: HandoffMode; assignedAgent?: { id?: string; name?: string } | null }) => void;
  onAgentMessage: (payload: { messageId?: string; agentName?: string; content: string; timestamp?: string }) => void;
  onAgentTyping: (payload: { isTyping?: boolean }) => void;

  closeLoginPrompt: () => void;
  handleUserLogin: () => void;

  _ensureSession: () => Promise<string>;
  _renewSession: () => Promise<string>;
  _streamReply: (text: string, placeholderId: string, opts?: { userMessageId?: string | null }) => Promise<void>;
  _applyResponse: (id: string, response: ChatResponse, opts?: { keepContent?: boolean }) => void;
  _reveal: (id: string, fullText: string) => Promise<void>;
};

const emptyContext: ChatContext = { destination: null, pageEntity: null, currentView: 'home', userLocation: null };

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  inputMessage: '',
  isChatOpen: false,
  hydrated: false,
  currentSessionId: null,
  currentSessionKey: null,
  connectionStatus: 'disconnected',
  isSending: false,
  streamingMessageId: null,
  queuedMessage: null,
  unreadCount: 0,
  replyPreview: null,
  chatContext: emptyContext,
  shareContext: true,
  isOnline: true,

  mode: 'ai',
  assignedAgent: null,
  isEscalating: false,
  isCancellingHandoff: false,
  agentTyping: false,
  handoffOffered: false,
  handoffOfferReason: null,
  handoffDismissed: false,

  conversationHistory: [],
  currentConversationId: null,

  isAuthenticated: false,
  guestMessageCount: 0,
  showLoginPrompt: false,
  maxGuestMessages: 3,
  loginDismissCount: 0,
  forceLogin: false,

  // ===== Loading what the phone kept =====

  hydrate: () => {
    if (hydration) return hydration;
    hydration = (async () => {
      try {
        const [historyRaw, sessionRaw] = await Promise.all([
          AsyncStorage.getItem(HISTORY_STORAGE),
          AsyncStorage.getItem(SESSION_STORAGE),
        ]);
        const history = historyRaw ? (JSON.parse(historyRaw) as SavedConversation[]) : [];
        if (sessionRaw) storedSession = JSON.parse(sessionRaw);
        set({ conversationHistory: Array.isArray(history) ? history : [] });
        AsyncStorage.removeItem(LEGACY_SESSION_STORAGE).catch(() => {});
      } catch {
        /* a broken store just means starting fresh */
      }
      set({ hydrated: true });
    })();
    return hydration;
  },

  // ===== Opening and minimising =====

  openChat: async (context = {}) => {
    set((s) => ({
      isChatOpen: true,
      unreadCount: 0,
      replyPreview: null,
      chatContext: {
        ...s.chatContext,
        pageEntity: context.pageEntity ?? null,
        destination: context.destination ?? s.chatContext.destination,
      },
    }));
    await get().hydrate();

    // A minimised chat comes back as it was: same session, same messages
    if (get().currentSessionId) return;
    set({ connectionStatus: 'connecting' });

    // A saved id without its key predates session keys: the server won't let
    // us use it, so start a new one instead
    const { sessionId, sessionKey } = storedSession;
    if (sessionId && sessionKey) {
      set({ currentSessionId: sessionId, currentSessionKey: sessionKey, connectionStatus: 'connected' });
      if (!get().messages.length) {
        const saved = get().conversationHistory.find((c) => c.sessionId === sessionId);
        if (saved?.messages?.length) {
          set({ messages: [...saved.messages], currentConversationId: saved.id });
        } else {
          // Not saved here (an older build): the server's copy, words only
          const rows = await chatService.getHistory(sessionId, sessionKey);
          if (rows.length && !get().messages.length) {
            set({
              messages: rows
                .filter((r) => r?.content)
                .map(
                  (r): ChatMessage => ({
                    id: String(r.messageId || r._id || newMessageId()),
                    role: r.role === 'user' ? 'user' : 'assistant',
                    type: r.role === 'user' ? 'message' : 'response',
                    content: String(r.content),
                    timestamp: r.timestamp || now(),
                    ...(r.senderType === 'agent' ? { senderType: 'agent' as const, agentName: r.agentName } : {}),
                    ...(r.metadata?.itineraryRef?.slug || r.metadata?.itineraryRef?.markdownItineraryId
                      ? { itineraryRef: r.metadata.itineraryRef }
                      : {}),
                  }),
                ),
            });
          }
        }
      }
      return;
    }

    try {
      await get()._ensureSession();
    } catch {
      set({ connectionStatus: 'error' });
    }
  },

  // Leaving the screen minimises. A reply still in flight keeps streaming and
  // shows up on the launcher.
  closeChat: () => {
    if (get().messages.length > 0) get().saveConversation();
    set({ isChatOpen: false });
  },

  setInputMessage: (text) => set({ inputMessage: text }),

  setAuthenticated: (value) => {
    if (get().isAuthenticated === !!value) return;
    set({ isAuthenticated: !!value });
    if (value) get().handleUserLogin();
  },

  setOnline: (value) => {
    const was = get().isOnline;
    if (was === value) return;
    set({ isOnline: value });
    // Messages written while offline go, in order, once the connection is back
    if (value) get().flushOfflineMessages();
  },

  setShareContext: (value) => set({ shareContext: !!value }),

  setUserLocation: (loc) => {
    set((s) => ({ chatContext: { ...s.chatContext, userLocation: loc } }));
    const { currentSessionId, currentSessionKey } = get();
    // The server's context keeps a place name, not coordinates
    if (currentSessionId && loc?.city) {
      chatService.updateContext(currentSessionId, currentSessionKey, { searchLocation: loc.city });
    }
  },

  dismissReplyPreview: () => set({ replyPreview: null }),

  // ===== Messages =====

  addMessage: (message) => {
    const id = message.id || newMessageId();
    set((s) => ({
      messages: [...s.messages, { content: '', timestamp: now(), ...message, id } as ChatMessage],
    }));
    return id;
  },

  updateMessage: (id, patch) =>
    set((prev) => {
      const idx = prev.messages.findIndex((m) => m.id === id);
      if (idx === -1) return prev;
      const updated = prev.messages.slice();
      const current = prev.messages[idx];
      updated[idx] = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
      return { messages: updated };
    }),

  removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

  // ===== Sessions =====

  _ensureSession: async () => {
    const existing = get().currentSessionId;
    if (existing) return existing;
    const { sessionId, sessionKey } = await chatService.startSession(get().chatContext);
    rememberSession(sessionId, sessionKey);
    set({ currentSessionId: sessionId, currentSessionKey: sessionKey, connectionStatus: 'connected' });
    return sessionId;
  },

  // A fresh server session for the conversation on screen, which stays. For
  // when the server refuses the old one (it predates keys, or it's gone).
  _renewSession: async () => {
    const { sessionId, sessionKey } = await chatService.startSession(get().chatContext);
    rememberSession(sessionId, sessionKey);
    set({ currentSessionId: sessionId, currentSessionKey: sessionKey, connectionStatus: 'connected' });
    return sessionId;
  },

  // ===== Asking Isha =====

  sendMessage: async (message, { countAsGuest = true } = {}) => {
    const state = get();
    const text = String(message || '').trim();
    if (!text) return;

    // Typed while Isha is still answering: send it as soon as she's done
    if (state.isSending) {
      set({ queuedMessage: text, inputMessage: '' });
      return;
    }

    // Guests get a few messages, then the sign-in prompt. Not while a person
    // from the team is in the chat: they can't help anyone who can't talk.
    const withPerson = state.mode === 'queued' || state.mode === 'human';
    if (!state.isAuthenticated && !withPerson && countAsGuest) {
      if (state.guestMessageCount >= state.maxGuestMessages) {
        set({ showLoginPrompt: true, forceLogin: state.loginDismissCount >= 2 });
        return;
      }
      set({ guestMessageCount: state.guestMessageCount + 1 });
    }

    set({ inputMessage: '' });

    // Offline: keep the message and send it when the connection is back
    if (!state.isOnline) {
      state.addMessage({ role: 'user', content: text, type: 'message', deliveryStatus: 'offline' });
      return;
    }

    const userMessageId = state.addMessage({ role: 'user', content: text, type: 'message' });
    const placeholderId = state.addMessage({
      role: 'assistant',
      content: '',
      type: 'response',
      isStreaming: true,
      steps: [],
    });
    await get()._streamReply(text, placeholderId, { userMessageId });
  },

  // One reply from Isha into the placeholder message. Every way of asking
  // (send, regenerate, continue) goes through here, so they all stream, can be
  // stopped, and fail the same way.
  _streamReply: async (text, placeholderId, { userMessageId = null } = {}) => {
    const controller: ReplyController = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REPLY_TIMEOUT_MS);

    replyController = controller;
    set({ isSending: true, streamingMessageId: placeholderId });

    const { updateMessage } = get();
    const onToken = (chunk: string) => {
      if (!chunk) return;
      updateMessage(placeholderId, (m) => ({
        content: (m.content || '') + chunk,
        isStreaming: true,
        steps: finishSteps(m.steps),
      }));
    };
    const onStatus = (statusText: string) => {
      if (!statusText) return;
      updateMessage(placeholderId, (m) => ({ statusText, steps: addStep(m.steps, statusText) }));
    };
    // The place's photos, as soon as they're found: they lead the reply. Not
    // when this place's cards are already on screen (shown once).
    const onMedia = (media: MediaEvent) => {
      const messages = get().messages;
      const idx = messages.findIndex((m) => m.id === placeholderId);
      if (idx === -1 || !media?.images?.length) return;
      if (topPlacesAlreadyShown(messages.slice(0, idx), media as any)) return;
      updateMessage(placeholderId, { images: media.images });
    };

    const state = get();
    const c = state.chatContext;
    // The composer's "Isha can see" chip can switch the page context off
    const context: Record<string, unknown> = state.shareContext
      ? { destination: c.destination, pageEntity: c.pageEntity, currentView: c.currentView, userLocation: c.userLocation }
      : { destination: null, pageEntity: null, currentView: 'browsing', userLocation: c.userLocation };

    try {
      let response: ChatResponse | null = null;
      let didStream = false;
      const ask = async () => {
        let sessionId: string;
        try {
          sessionId = await get()._ensureSession();
        } catch {
          throw chatError('NETWORK_ERROR', "Couldn't reach Isha. Check your connection.");
        }
        const key = get().currentSessionKey;
        try {
          response = await chatService.sendMessageStream(text, context, sessionId, key, { onToken, onStatus, onMedia }, controller.signal);
          didStream = !!response?.streamed;
        } catch (streamErr: any) {
          // Only when the server won't stream: then nothing was sent and one
          // /send is safe. Any other failure is shown, never re-sent, since
          // the server may already be answering it.
          if (streamErr?.code !== 'STREAM_UNAVAILABLE') throw streamErr;
          response = await chatService.sendMessage(text, context, sessionId, key, controller.signal);
        }
      };
      try {
        await ask();
      } catch (askErr: any) {
        if (askErr?.code !== 'SESSION_INVALID') throw askErr;
        await get()._renewSession();
        await ask();
      }
      const reply = response as ChatResponse | null;

      // A person is in the loop (queued/human/resolved): no AI reply. Theirs
      // comes over the /customer-chat socket.
      if (!reply?.message || reply.metadata?.gated || (reply.mode && reply.mode !== 'ai')) {
        const newMode = (reply?.mode && reply.mode !== 'ai' ? reply.mode : get().mode) as HandoffMode;
        set((prev) => ({ messages: prev.messages.filter((m) => m.id !== placeholderId), mode: newMode }));
        return;
      }

      // /send: reveal the text progressively. Stop cuts it short.
      if (!didStream) await get()._reveal(placeholderId, reply.message);
      get()._applyResponse(placeholderId, reply, { keepContent: !!controller.stoppedByUser });
      if (controller.stoppedByUser) updateMessage(placeholderId, { stopped: true });

      if (reply.contextUpdates && typeof reply.contextUpdates === 'object') {
        const dest = (reply.contextUpdates as any).destination;
        if (typeof dest === 'string' && dest) set((s) => ({ chatContext: { ...s.chatContext, destination: dest } }));
      }

      // Offer (or clear) "Talk to a person" from the server's read of whether
      // Isha could help. Never automatic, never again once dismissed.
      if (reply.offerHandoff && get().mode === 'ai' && !get().handoffDismissed) {
        set({ handoffOffered: true, handoffOfferReason: reply.handoffReason || null });
      } else if (get().handoffOffered) {
        set({ handoffOffered: false, handoffOfferReason: null });
      }

      // Saved after every reply, so closing the app loses nothing
      get().saveConversation();

      if (!get().isChatOpen) {
        set((prev) => ({ unreadCount: prev.unreadCount + 1, replyPreview: previewOf(reply.message) }));
      }
    } catch (error: any) {
      const partial = error?.partialText || '';
      const current = get().messages.find((m) => m.id === placeholderId);
      const shownText = current?.content || partial;

      if (controller.stoppedByUser) {
        // Stopped: keep what was written, mark it, offer to regenerate
        updateMessage(placeholderId, (m) => ({
          content: m.content || partial,
          isStreaming: false,
          stopped: true,
          steps: finishSteps(m.steps),
        }));
      } else if (error?.code === 'NETWORK_ERROR' && userMessageId && !shownText) {
        // The question never reached Isha: mark it unsent with a retry rather
        // than an answer-shaped error under it
        set((prev) => ({
          messages: prev.messages
            .filter((m) => m.id !== placeholderId)
            .map((m) => (m.id === userMessageId ? { ...m, deliveryStatus: 'failed' as const } : m)),
          // A message Isha never got doesn't use up a guest's free ones
          guestMessageCount: prev.isAuthenticated ? prev.guestMessageCount : Math.max(0, prev.guestMessageCount - 1),
        }));
      } else if (!timedOut && error?.code === 'INTERRUPTED' && shownText) {
        // Dropped mid-reply: keep the words already on screen
        updateMessage(placeholderId, (m) => ({
          content: m.content || partial,
          isStreaming: false,
          interrupted: true,
          steps: finishSteps(m.steps),
        }));
      } else {
        const limited = error?.code === 'RATE_LIMITED' || error?.status === 429;
        if (!limited) console.warn('Isha reply failed:', error?.code || error?.message);
        // Turned away by a limit: it didn't use up one of a guest's messages
        if (limited && !get().isAuthenticated) {
          set((prev) => ({ guestMessageCount: Math.max(0, prev.guestMessageCount - 1) }));
        }
        updateMessage(placeholderId, (m) => ({
          content: friendlyError(error, { timedOut }),
          type: 'error',
          // "day" and "budget" limits last until tomorrow: no retry button
          errorReason: error?.reason || null,
          isStreaming: false,
          steps: finishSteps(m.steps),
        }));
      }
    } finally {
      clearTimeout(timer);
      if (replyController === controller) replyController = null;
      set({ isSending: false, streamingMessageId: null });

      // Something typed while Isha was answering goes now
      const queued = get().queuedMessage;
      if (queued) {
        set({ queuedMessage: null });
        get().sendMessage(queued);
      }
    }
  },

  // Copy a finished reply's cards and data onto its message
  _applyResponse: (id, response, { keepContent = false } = {}) => {
    const messages = get().messages;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    // "Places worth your time" once per destination: every reply about a
    // place comes with the same cards
    const placesShown = topPlacesAlreadyShown(messages.slice(0, idx), response);
    get().updateMessage(id, (m) => ({
      content: keepContent ? m.content : response.message ?? m.content,
      isStreaming: false,
      steps: finishSteps(m.steps),
      actions: response.actions || [],
      relatedPlaces: response.relatedPlaces || [],
      topPlaces: placesShown ? [] : response.topPlaces || [],
      images: placesShown ? [] : response.images || [],
      // A plan's cover keeps the place's photos even when its cards aren't repeated
      coverImages: response.itinerary ? response.images || [] : [],
      localPlaces: response.localPlaces || [],
      map: response.map || null,
      suggestions: response.suggestions || [],
      destinationData: response.destinationData || null,
      detectedDestination: response.detectedDestination || null,
      esimPlans: response.esimPlans || [],
      actionCards: response.actionCards || [],
      itinerary: response.itinerary || null,
      inventory: response.inventory || [],
      metadata: response.metadata,
    }));
  },

  // The /send path has the whole text at once: show it word by word
  _reveal: (id, fullText) =>
    new Promise<void>((resolve) => {
      let at = 0;
      revealResolve = resolve;
      revealTimer = setInterval(() => {
        const exists = get().messages.some((m) => m.id === id);
        if (!exists) {
          if (revealTimer) clearInterval(revealTimer);
          revealTimer = null;
          revealResolve = null;
          resolve();
          return;
        }
        let target = Math.min(at + 8 + Math.floor(Math.random() * 8), fullText.length);
        const space = fullText.indexOf(' ', target);
        if (space !== -1 && space - at < 24) target = space + 1;
        at = Math.min(target, fullText.length);
        const done = at >= fullText.length;
        get().updateMessage(id, { content: fullText.slice(0, at), isStreaming: !done });
        if (done) {
          if (revealTimer) clearInterval(revealTimer);
          revealTimer = null;
          revealResolve = null;
          resolve();
        }
      }, 32);
    }),

  // Stop: cancel the request in flight and keep whatever Isha had written
  stopGenerating: () => {
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
      const r = revealResolve;
      revealResolve = null;
      r?.();
    }
    if (replyController) {
      replyController.stoppedByUser = true;
      replyController.abort();
    }
  },

  regenerateLastResponse: async () => {
    const { isSending, messages } = get();
    if (isSending) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && !messages[i].deliveryStatus) {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const question = messages[lastUserIdx];
    // Everything after that question gives way to a fresh answer
    const placeholderId = newMessageId();
    set({
      messages: [
        ...messages.slice(0, lastUserIdx + 1),
        { id: placeholderId, role: 'assistant', content: '', type: 'response', isStreaming: true, steps: [], timestamp: now() },
      ],
    });
    await get()._streamReply(question.content, placeholderId);
  },

  editAndResend: async (id, text) => {
    const { isSending, messages } = get();
    if (isSending) return;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1 || messages[idx].role !== 'user') return;
    set({ messages: messages.slice(0, idx) });
    await get().sendMessage(text);
  },

  // Send a message again that never reached Isha
  retryMessage: async (id) => {
    const message = get().messages.find((m) => m.id === id);
    if (!message || get().isSending) return;
    set((prev) => ({ messages: prev.messages.filter((m) => m.id !== id) }));
    await get().sendMessage(message.content);
  },

  flushOfflineMessages: async () => {
    if (get().isSending) return;
    const pending = get().messages.filter((m) => m.deliveryStatus === 'offline');
    if (!pending.length) return;
    set((prev) => ({ messages: prev.messages.filter((m) => m.deliveryStatus !== 'offline') }));
    for (const m of pending) {
      await get().sendMessage(m.content, { countAsGuest: false });
    }
  },

  // A long reply that ran out: ask Isha to carry on
  continueGenerating: async () => {
    const { isSending, messages } = get();
    if (isSending) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.type !== 'error');
    if (!lastAssistant) return;
    const placeholderId = get().addMessage({ role: 'assistant', content: '', type: 'response', isStreaming: true, steps: [] });
    await get()._streamReply('Please continue your previous response from where you left off.', placeholderId);
  },

  finishInterruptedReply: async (id) => {
    if (get().isSending) return;
    get().updateMessage(id, { interrupted: false });
    await get().continueGenerating();
  },

  // ===== The step-by-step trip planner =====

  showTripPlannerForm: () => {
    get().addMessage({ role: 'assistant', type: 'trip_planner_form', content: "Let's plan your trip" });
  },

  // The card shows as soon as the guide is written; the structured plan (its
  // photos) follows in the background
  generateTripItinerary: async (form) => {
    const { addMessage } = get();
    set({ isSending: true });
    addMessage({ role: 'user', type: 'message', content: `Plan a ${form.duration}-day trip to ${form.destination}` });
    const loadingId = addMessage({
      role: 'assistant',
      type: 'itinerary_loading',
      content: 'Crafting your travel guide',
      requestData: form,
      isTemporary: true,
    });
    const previewId = newMessageId();
    const body = JSON.stringify({
      ...form,
      preferences: form.preferences || { budget: 'moderate', interests: [], travelStyle: 'relaxed', groupType: 'general' },
    });
    try {
      const markdownPromise = makeItineraryAPICall('/itinerary/generate-markdown', { method: 'POST', body });
      const structuredPromise = makeItineraryAPICall('/itinerary/generate', { method: 'POST', body });
      structuredPromise.catch(() => null);

      const markdown = await markdownPromise;
      if (!markdown?.success) throw new Error('Failed to generate itinerary');
      set((s) => ({
        isSending: false,
        messages: [
          ...s.messages.filter((m) => m.id !== loadingId),
          {
            id: previewId,
            role: 'assistant',
            type: 'itinerary_preview',
            content: 'Your travel guide is ready',
            itineraryData: { markdown: markdown.data, structured: null },
            requestData: form,
            timestamp: now(),
          },
        ],
      }));
      get().saveConversation();

      structuredPromise
        .then((structured: any) => {
          if (!structured?.success) return;
          get().updateMessage(previewId, (m) => ({
            itineraryData: { ...(m.itineraryData || {}), structured: structured.data },
          }));
        })
        .catch(() => {});
    } catch (error: any) {
      get().updateMessage(loadingId, {
        type: 'error',
        content: `Sorry, I couldn't generate your itinerary. ${error?.message || ''}`.trim(),
        isTemporary: false,
      });
      set({ isSending: false });
    } finally {
      // Something typed while the plan was being written goes now
      const queued = get().queuedMessage;
      if (queued) {
        set({ queuedMessage: null });
        get().sendMessage(queued);
      }
    }
  },

  // ===== Saved chats =====

  saveConversation: () => {
    const state = get();
    if (!state.messages.length) return;
    const firstUser = state.messages.find((m) => m.role === 'user');
    const title = firstUser?.content ? firstUser.content.slice(0, 50) : state.chatContext.destination || 'New conversation';
    const conversation: SavedConversation = {
      id: state.currentConversationId || `conv-${Date.now()}`,
      title,
      subtitle: state.chatContext.destination || '',
      timestamp: now(),
      messages: slimMessages(state.messages),
      context: { destination: state.chatContext.destination },
      // The server session holding this conversation, so reopening it keeps
      // Isha's memory of it instead of starting her from blank
      sessionId: state.currentSessionId,
      sessionKey: state.currentSessionKey,
      pinned: state.conversationHistory.find((c) => c.id === state.currentConversationId)?.pinned,
    };
    const history = [conversation, ...state.conversationHistory.filter((c) => c.id !== conversation.id)].slice(0, MAX_SAVED_CHATS);
    set({ conversationHistory: history, currentConversationId: conversation.id });
    persistHistory(history);
  },

  loadConversation: async (id) => {
    const state = get();
    const conversation = state.conversationHistory.find((c) => c.id === id);
    if (!conversation || state.isSending) return;
    // Keep the chat being left
    if (state.messages.length > 0 && state.currentConversationId !== conversation.id) get().saveConversation();
    set((s) => ({
      messages: [...conversation.messages],
      chatContext: { ...s.chatContext, destination: conversation.context?.destination ?? s.chatContext.destination },
      currentConversationId: conversation.id,
      queuedMessage: null,
      handoffOffered: false,
      handoffOfferReason: null,
    }));
    // Talk to the server session that holds these messages, or the screen
    // shows the old chat while Isha answers from an empty history
    if (conversation.sessionId && conversation.sessionKey) {
      rememberSession(conversation.sessionId, conversation.sessionKey);
      set({ currentSessionId: conversation.sessionId, currentSessionKey: conversation.sessionKey, mode: 'ai', assignedAgent: null });
    }
  },

  deleteConversation: (id) => {
    const history = get().conversationHistory.filter((c) => c.id !== id);
    set({ conversationHistory: history });
    persistHistory(history);
  },

  togglePinConversation: (id) => {
    const history = get().conversationHistory.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
    set({ conversationHistory: history });
    persistHistory(history);
  },

  clearAllConversations: () => {
    set({ conversationHistory: [] });
    AsyncStorage.removeItem(HISTORY_STORAGE).catch(() => {});
  },

  // Keep the current chat in history first, then a fresh empty session.
  // Without resetting currentConversationId the next save would overwrite it.
  startNewChat: async () => {
    if (get().isSending) get().stopGenerating();
    if (get().messages.length > 0) get().saveConversation();
    set({
      currentConversationId: null,
      messages: [],
      queuedMessage: null,
      inputMessage: '',
      handoffOffered: false,
      handoffOfferReason: null,
      handoffDismissed: false,
      mode: 'ai',
      assignedAgent: null,
      agentTyping: false,
      currentSessionId: null,
      currentSessionKey: null,
      connectionStatus: 'connecting',
    });
    try {
      await get()._ensureSession();
    } catch {
      // The welcome screen still shows; the next message tries again
      set({ connectionStatus: 'error' });
    }
  },

  // ===== A person from the team =====

  escalateToHuman: async () => {
    if (get().isEscalating) return;
    set({ isEscalating: true, handoffOffered: false });
    try {
      const sessionId = await get()._ensureSession();
      const c = get().chatContext;
      await chatService.escalate(sessionId, get().currentSessionKey, {
        destination: c.destination || null,
        currentView: c.currentView || null,
      });
      set({ mode: 'queued' });
    } catch (e: any) {
      console.warn('escalateToHuman failed:', e?.message);
      throw e;
    } finally {
      set({ isEscalating: false });
    }
  },

  // Back out of a queued/human handoff to Isha, so nobody is stuck waiting
  cancelHandoff: async () => {
    const sessionId = get().currentSessionId;
    if (!sessionId || get().isCancellingHandoff) return;
    set({ isCancellingHandoff: true });
    try {
      await chatService.cancelHandoff(sessionId, get().currentSessionKey);
      set({ mode: 'ai', assignedAgent: null, agentTyping: false, handoffOffered: false, handoffOfferReason: null });
    } catch (e: any) {
      console.warn('cancelHandoff failed:', e?.message);
      throw e;
    } finally {
      set({ isCancellingHandoff: false });
    }
  },

  acceptHandoffOffer: async () => {
    set({ handoffOffered: false, handoffDismissed: true });
    await get().escalateToHuman();
  },

  dismissHandoffOffer: () => set({ handoffOffered: false, handoffOfferReason: null, handoffDismissed: true }),

  onModeChanged: ({ mode, assignedAgent }) =>
    set({
      mode: mode || 'ai',
      assignedAgent: assignedAgent || (mode === 'human' ? get().assignedAgent : null),
      agentTyping: false,
      handoffOffered: false,
      handoffOfferReason: null,
    }),

  onAgentMessage: (msg) => {
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: msg.messageId || `agent-${Date.now()}`,
          role: 'assistant',
          senderType: 'agent',
          agentName: msg.agentName,
          content: msg.content,
          timestamp: msg.timestamp || now(),
        },
      ],
      agentTyping: false,
      ...(s.isChatOpen ? {} : { unreadCount: s.unreadCount + 1, replyPreview: previewOf(msg.content) }),
    }));
    get().saveConversation();
  },

  onAgentTyping: ({ isTyping }) => set({ agentTyping: !!isTyping }),

  // ===== Guests =====

  // Skipping gives three more messages; the third prompt can't be skipped
  closeLoginPrompt: () =>
    set((s) => ({ showLoginPrompt: false, loginDismissCount: s.loginDismissCount + 1, guestMessageCount: 0 })),

  handleUserLogin: () => set({ guestMessageCount: 0, showLoginPrompt: false, loginDismissCount: 0, forceLogin: false }),
}));
