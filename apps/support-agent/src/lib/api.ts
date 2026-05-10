// Thin REST client for the support-agent app. The Socket.IO live channel does
// most of the work; this is just for bootstrap reads (pending list, history)
// and for actions we want to be REST-replayable like resume-ai.
import Constants from "expo-constants";

const API_BASE: string =
  (Constants.expoConfig?.extra as any)?.API_BASE_URL ||
  "https://api.prayanaai.com/api";

async function request<T>(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.message || `Request failed: ${res.status}`);
  }
  return json as T;
}

export const agentAPI = {
  pendingHandoffs: (token: string) =>
    request<{ success: true; data: any[] }>("/support-agents/pending-handoffs", token),
  myConversations: (token: string) =>
    request<{ success: true; data: any[] }>("/support-agents/my-conversations", token),
  conversationHistory: (token: string, sessionId: string) =>
    request<{ success: true; data: { session: any; messages: any[] } }>(
      `/support-agents/conversation/${sessionId}/history`,
      token
    ),
  resumeAI: (token: string, sessionId: string) =>
    request<{ success: true }>("/chat/resume-ai", token, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),

  // Phase 3.1 — AI co-pilot
  suggestReply: (token: string, sessionId: string) =>
    request<{ success: true; data: { suggestion: string | null; hash?: string; reason?: string; cached?: boolean } }>(
      "/support-agents/suggest-reply",
      token,
      {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      }
    ),
  upsellHints: (token: string, sessionId: string) =>
    request<{
      success: true;
      data: { hints: Array<{ kind: string; title: string; body: string; ctaLabel: string; ctaUrl: string; priority: number }> };
    }>(`/support-agents/upsell-hints/${sessionId}`, token),
};
