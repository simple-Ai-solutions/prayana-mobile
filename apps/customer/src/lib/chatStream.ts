// chatStream — Server-Sent Events for /chat/stream, without a new dependency.
//
// React Native's fetch has no body.getReader(), so the web client's streaming
// path (aiChatService.sendMessageStream) cannot be ported directly. XHR does
// expose responseText incrementally on readyState 3, which is enough to parse
// an SSE body: track how much we have already consumed and decode only the new
// tail on each progress event.
//
// The server frames events as "data: {json}\n\n" with these shapes:
//   { type: "token", text }  — append to the live bubble
//   { type: "done", aiMessage, mode, ... } — final payload, same object the
//                                            non-streaming /chat/send returns
//   { type: "error", message }
//
// Falls back to the caller's non-streaming path on any transport failure, so a
// server with streaming disabled (409) degrades rather than breaks.
import { getBaseURL, getAuthHeaders } from '@prayana/shared-services';

export type StreamHandlers = {
  onToken: (text: string) => void;
  onDone: (payload: any) => void;
  onError: (err: Error) => void;
};

export type StreamHandle = { abort: () => void };

export function streamChatMessage(
  body: Record<string, any>,
  handlers: StreamHandlers,
  timeoutMs = 90000,
): StreamHandle {
  const xhr = new XMLHttpRequest();
  let consumed = 0;
  let settled = false;
  let sawToken = false;

  const finish = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
  };

  /** Parse whatever complete "data:" frames have arrived since last time. */
  const drain = () => {
    const text: string = xhr.responseText || '';
    if (text.length <= consumed) return;
    const chunk = text.slice(consumed);
    // Only consume up to the last complete frame; keep any partial tail.
    const lastBreak = chunk.lastIndexOf('\n\n');
    if (lastBreak === -1) return;
    consumed += lastBreak + 2;

    for (const frame of chunk.slice(0, lastBreak).split('\n\n')) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      let evt: any;
      try {
        evt = JSON.parse(raw);
      } catch {
        continue; // a frame split mid-JSON; the tail will arrive next tick
      }
      if (evt.type === 'token' && typeof evt.text === 'string') {
        sawToken = true;
        handlers.onToken(evt.text);
      } else if (evt.type === 'done') {
        finish(() => handlers.onDone(evt));
      } else if (evt.type === 'error') {
        // Mid-stream errors after text has arrived are not fatal: the user
        // already has a usable reply.
        if (!sawToken) finish(() => handlers.onError(new Error(evt.message || 'Stream error')));
      }
    }
  };

  (async () => {
    let headers: Record<string, string> = {};
    try {
      headers = ((await getAuthHeaders()) || {}) as Record<string, string>;
    } catch {
      headers = {};
    }

    xhr.open('POST', `${getBaseURL()}/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    Object.entries(headers).forEach(([k, v]) => {
      if (typeof v === 'string') xhr.setRequestHeader(k, v);
    });
    xhr.timeout = timeoutMs;

    xhr.onreadystatechange = () => {
      // 3 = LOADING: partial body available. 4 = DONE.
      if (xhr.readyState === 3) drain();
      if (xhr.readyState === 4) {
        drain();
        if (xhr.status < 200 || xhr.status >= 300) {
          finish(() => handlers.onError(new Error(`Stream HTTP ${xhr.status}`)));
          return;
        }
        // Stream ended without a "done" frame — treat as complete if we got
        // text, otherwise let the caller fall back.
        finish(() =>
          sawToken
            ? handlers.onDone({ type: 'done' })
            : handlers.onError(new Error('Stream closed with no content')),
        );
      }
    };
    xhr.onerror = () => finish(() => handlers.onError(new Error('Stream network error')));
    xhr.ontimeout = () => finish(() => handlers.onError(new Error('Stream timed out')));

    try {
      xhr.send(JSON.stringify(body));
    } catch (e: any) {
      finish(() => handlers.onError(e instanceof Error ? e : new Error('Stream send failed')));
    }
  })();

  return {
    abort: () => {
      settled = true;
      try {
        xhr.abort();
      } catch {
        /* already finished */
      }
    },
  };
}
