// Talking to Isha's server. Mirrors the website's services/aiChatService.js:
// every call for a session carries its access key (X-Chat-Session-Key), which
// the server requires to read or write a session it didn't see the owner of.
import { Platform } from 'react-native';
import { makeChatAPICall } from '@prayana/shared-services';
import { streamChatMessage, chatError, type ChatStreamError } from '../../lib/chatStream';
import type { ChatResponse, MediaEvent } from './types';

export type { ChatStreamError };

const requestId = () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export const sessionHeaders = (key?: string | null): Record<string, string> =>
  key ? { 'X-Chat-Session-Key': key } : {};

function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

// One shape for a finished reply, whether it came over /send or /stream
function toChatResponse(ai: any, data: any): ChatResponse {
  return {
    message: ai?.content ?? null,
    actions: ai?.actions || [],
    relatedPlaces: ai?.relatedPlaces || [],
    topPlaces: ai?.topPlaces || [],
    localPlaces: ai?.localPlaces || [],
    map: ai?.map || null,
    images: ai?.images || [],
    suggestions: ai?.suggestions || [],
    destinationData: ai?.destinationData || null,
    detectedDestination: ai?.detectedDestination || null,
    esimPlans: ai?.esimPlans || [],
    actionCards: ai?.actionCards || [],
    itinerary: ai?.itinerary || null,
    inventory: ai?.inventory || [],
    contextUpdates: data?.context || null,
    mode: data?.mode || 'ai',
    offerHandoff: !!data?.offerHandoff,
    handoffReason: data?.handoffReason || null,
    metadata: {
      messageId: ai?.messageId,
      model: ai?.metadata?.model || ai?.aiData?.model,
      timestamp: ai?.timestamp,
    },
  };
}

// makeAPICall's errors carry the HTTP status and the server's JSON body
function asChatError(err: any): ChatStreamError {
  if (err?.name === 'AbortError') return err;
  const status = err?.status;
  if (status === 403 || status === 404) {
    return chatError('SESSION_INVALID', "This chat session can't be used any more.", { status });
  }
  if (status === 429) {
    return chatError('RATE_LIMITED', err?.data?.message || 'Isha needs a short break. Try again in a minute.', {
      status,
      reason: err?.data?.reason || null,
      retryAfter: err?.data?.retryAfter || null,
    });
  }
  if (!status) return chatError('NETWORK_ERROR', "Couldn't reach Isha. Check your connection.");
  return chatError('SERVER_ERROR', err?.message || 'Isha couldn\'t finish that reply.', { status });
}

export const chatService = {
  /** A new server session, with its access key. */
  async startSession(context: Record<string, unknown>): Promise<{ sessionId: string; sessionKey: string | null }> {
    const res = await makeChatAPICall('/chat/session/start', {
      method: 'POST',
      timeout: 15000,
      body: JSON.stringify({
        context,
        startedAt: new Date().toISOString(),
        userAgent: `PrayanaApp/${Platform.OS} ${String(Platform.Version)}`,
        // Ask for an access key; it's sent back on every call for this session
        useSessionKey: true,
        timezone: timezone(),
      }),
    });
    const sessionId = res?.data?.sessionId;
    if (!res?.success || !sessionId) throw new Error(res?.message || 'Failed to start session');
    return { sessionId: String(sessionId), sessionKey: res.data.sessionKey || null };
  },

  /** One reply over SSE. Tokens, steps and photos arrive through the callbacks. */
  async sendMessageStream(
    text: string,
    context: Record<string, unknown>,
    sessionId: string,
    sessionKey: string | null,
    callbacks: { onToken: (t: string) => void; onStatus: (t: string) => void; onMedia: (m: MediaEvent) => void },
    signal: AbortSignal,
  ): Promise<ChatResponse> {
    const { done, text: streamed } = await streamChatMessage(
      {
        sessionId,
        message: { content: text, context, timestamp: new Date().toISOString() },
        requestId: requestId(),
      },
      sessionHeaders(sessionKey),
      callbacks,
      signal,
    );
    // A person is in the chat: no AI reply (theirs comes over the socket)
    if (done.gated || done.aiMessage === null) {
      return { message: null, mode: done.mode || 'ai', metadata: { gated: true } };
    }
    const response = toChatResponse(done.aiMessage, done);
    response.message = done.aiMessage?.content || streamed;
    response.streamed = true;
    return response;
  },

  /** One reply over /send, for a server that won't stream. */
  async sendMessage(
    text: string,
    context: Record<string, unknown>,
    sessionId: string,
    sessionKey: string | null,
    signal: AbortSignal,
  ): Promise<ChatResponse> {
    let res: any;
    try {
      // An external signal also switches off makeAPICall's own retries: a
      // re-sent message would be answered (and counted) twice
      res = await makeChatAPICall('/chat/send', {
        method: 'POST',
        signal,
        headers: sessionHeaders(sessionKey),
        body: JSON.stringify({
          sessionId,
          message: { content: text, context, timestamp: new Date().toISOString() },
          requestId: requestId(),
        }),
      });
    } catch (err) {
      throw asChatError(err);
    }
    if (!res?.success) throw chatError('SERVER_ERROR', res?.message || 'Backend API error');
    const ai = res.data?.aiMessage;
    const mode = res.data?.mode || 'ai';
    if (!ai || mode !== 'ai') return { message: null, mode, metadata: { gated: true } };
    return toChatResponse(ai, res.data);
  },

  /** The server's copy of a conversation, oldest first. Needs the key. */
  async getHistory(sessionId: string, sessionKey: string | null, limit = 50): Promise<any[]> {
    try {
      const res = await makeChatAPICall(`/chat/history/${sessionId}?limit=${limit}`, {
        timeout: 10000,
        headers: sessionHeaders(sessionKey),
      });
      return Array.isArray(res?.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  async updateContext(sessionId: string, sessionKey: string | null, context: Record<string, unknown>) {
    try {
      await makeChatAPICall('/chat/context', {
        method: 'POST',
        timeout: 10000,
        headers: sessionHeaders(sessionKey),
        body: JSON.stringify({ sessionId, context }),
      });
    } catch {
      /* context is a nicety; the chat works without it */
    }
  },

  async escalate(sessionId: string, sessionKey: string | null, tripContext: Record<string, unknown>) {
    const res = await makeChatAPICall('/chat/escalate', {
      method: 'POST',
      timeout: 15000,
      headers: sessionHeaders(sessionKey),
      body: JSON.stringify({ sessionId, reason: 'explicit', tripContext }),
    });
    if (res?.success === false) throw new Error(res?.message || 'Escalation refused');
  },

  async cancelHandoff(sessionId: string, sessionKey: string | null) {
    const res = await makeChatAPICall('/chat/cancel-handoff', {
      method: 'POST',
      timeout: 15000,
      headers: sessionHeaders(sessionKey),
      body: JSON.stringify({ sessionId }),
    });
    if (res?.success === false) throw new Error(res?.message || 'Cancel refused');
  },
};
