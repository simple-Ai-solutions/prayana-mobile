// chatStream — Server-Sent Events for /chat/stream, without a new dependency.
//
// React Native's fetch has no body.getReader(), so the web client's streaming
// path (aiChatService.sendMessageStream) cannot be ported directly. XHR does
// expose responseText incrementally on readyState 3 (RN turns on incremental
// updates when onreadystatechange is set before send), which is enough to
// parse an SSE body: keep what has been consumed and decode only the new tail.
//
// The server frames events as "data: {json}\n\n":
//   { type: "token", text }     append to the live bubble
//   { type: "status", text }    what Isha is doing ("Finding places to visit…")
//   { type: "media", images }   the place's photos, ahead of the words
//   { type: "done", aiMessage, mode, context, offerHandoff, handoffReason }
//   { type: "error", message }
//
// Failures reject with an error whose `code` says what to do, as on the web:
//   STREAM_UNAVAILABLE — the server won't stream (409, old deploy): use /send.
//                        Nothing was sent.
//   NETWORK_ERROR      — the request never got through. Nothing was sent.
//   SESSION_INVALID    — 403/404: the session is gone or isn't this client's.
//   RATE_LIMITED       — 429: a message limit or today's AI budget. `reason`
//                        is burst | session | day | budget.
//   INTERRUPTED        — the connection dropped mid-reply; `partialText` keeps
//                        what had arrived.
//   SERVER_ERROR       — the server reported a failure before any words.
// A Stop (the signal aborting) rejects with name "AbortError" and partialText.
import { getBaseURL, getAuthHeaders } from '@prayana/shared-services';

export type ChatStreamError = Error & {
  code?: string;
  status?: number;
  reason?: string | null;
  retryAfter?: number | null;
  partialText?: string;
};

export function chatError(code: string, message: string, extra: Partial<ChatStreamError> = {}): ChatStreamError {
  return Object.assign(new Error(message), { code, ...extra });
}

export type StreamCallbacks = {
  onToken?: (text: string) => void;
  onStatus?: (text: string) => void;
  onMedia?: (event: any) => void;
};

export type StreamResult = { done: any; text: string };

export function streamChatMessage(
  body: Record<string, unknown>,
  headers: Record<string, string>,
  { onToken, onStatus, onMedia }: StreamCallbacks,
  signal?: AbortSignal,
): Promise<StreamResult> {
  return new Promise<StreamResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let consumed = 0;
    let settled = false;
    let text = '';
    let finalEvent: any = null;
    let serverError: string | null = null;
    let headersSeen = false;
    let isStream = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', onAbort);
      fn();
    };

    function onAbort() {
      try {
        xhr.abort();
      } catch {
        /* already finished */
      }
      const err = Object.assign(new Error('Stopped'), { name: 'AbortError', partialText: text });
      settle(() => reject(err));
    }

    const handle = (evt: any) => {
      if (!evt || !evt.type) return;
      if (evt.type === 'token' && typeof evt.text === 'string') {
        text += evt.text;
        onToken?.(evt.text);
      } else if (evt.type === 'status') {
        onStatus?.(evt.text || '');
      } else if (evt.type === 'media') {
        onMedia?.(evt);
      } else if (evt.type === 'done') {
        finalEvent = evt;
      } else if (evt.type === 'error') {
        serverError = evt.message || 'stream error';
      }
    };

    // Parse whatever complete frames have arrived since last time
    const drain = () => {
      const all: string = xhr.responseText || '';
      if (all.length <= consumed) return;
      const chunk = all.slice(consumed);
      const lastBreak = chunk.lastIndexOf('\n\n');
      if (lastBreak === -1) return;
      consumed += lastBreak + 2;
      for (const frame of chunk.slice(0, lastBreak).split('\n\n')) {
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            handle(JSON.parse(raw));
          } catch {
            /* malformed frame */
          }
        }
      }
    };

    const readType = () => {
      const ctype = xhr.getResponseHeader('content-type') || xhr.getResponseHeader('Content-Type') || '';
      isStream = ctype.includes('text/event-stream');
    };

    const finishBody = () => {
      const status = xhr.status;
      if (!headersSeen && status) {
        headersSeen = true;
        readType();
      }
      if (status === 0) {
        // Nothing came back at all: the request never got through
        if (!headersSeen && !text) {
          settle(() => reject(chatError('NETWORK_ERROR', "Couldn't reach Isha. Check your connection.", { partialText: '' })));
        } else {
          settle(() => reject(chatError('INTERRUPTED', 'The connection dropped mid-reply.', { partialText: text })));
        }
        return;
      }
      if (status === 403 || status === 404) {
        settle(() => reject(chatError('SESSION_INVALID', "This chat session can't be used any more.", { status })));
        return;
      }
      if (status === 429) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(xhr.responseText || 'null');
        } catch {
          parsed = null;
        }
        settle(() =>
          reject(
            chatError('RATE_LIMITED', parsed?.message || 'Isha needs a short break. Try again in a minute.', {
              status: 429,
              reason: parsed?.reason || null,
              retryAfter: parsed?.retryAfter || null,
            }),
          ),
        );
        return;
      }
      // Frames in the body count as a stream even if the header went missing:
      // falling back to /send then would ask (and charge) the question twice
      if (status < 200 || status >= 300 || (!isStream && !/^data:/m.test(xhr.responseText || ''))) {
        settle(() => reject(chatError('STREAM_UNAVAILABLE', `stream unavailable (status ${status})`, { status })));
        return;
      }
      drain();
      if (!finalEvent) {
        settle(() =>
          reject(
            chatError(text ? 'INTERRUPTED' : 'SERVER_ERROR', serverError || 'The reply ended before it finished.', {
              partialText: text,
            }),
          ),
        );
        return;
      }
      settle(() => resolve({ done: finalEvent, text }));
    };

    (async () => {
      let auth: Record<string, string> = {};
      try {
        auth = ((await getAuthHeaders()) || {}) as Record<string, string>;
      } catch {
        auth = {};
      }
      if (settled) return;
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener?.('abort', onAbort);

      xhr.open('POST', `${getBaseURL()}/chat/stream`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      for (const [k, v] of Object.entries({ ...auth, ...headers })) {
        if (typeof v === 'string' && v) xhr.setRequestHeader(k, v);
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 2 && !headersSeen && xhr.status) {
          headersSeen = true;
          readType();
        }
        if (xhr.readyState === 3 && isStream) drain();
        if (xhr.readyState === 4) finishBody();
      };
      xhr.onerror = () => finishBody();
      xhr.ontimeout = () =>
        settle(() => reject(chatError(text ? 'INTERRUPTED' : 'NETWORK_ERROR', 'Isha took too long to answer.', { partialText: text })));

      try {
        xhr.send(JSON.stringify(body));
      } catch {
        settle(() => reject(chatError('NETWORK_ERROR', "Couldn't reach Isha. Check your connection.", { partialText: '' })));
      }
    })();
  });
}
