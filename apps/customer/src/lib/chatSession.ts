// chatSession — the chat's server session and the key that proves it's ours.
//
// The server only lets a chat session be used by the client that started it
// (which holds the session's access key) or by the signed-in user who started
// it. Without the key, anyone who guessed a session id could read the whole
// conversation. So: ask for a key when starting a session, keep it with the
// session id, and send it as X-Chat-Session-Key on every call for that session
// (and as `sessionKey` when joining its live socket room).
//
// The id stays in AsyncStorage, where it always was; the key goes in
// SecureStore. A saved id with no key (from before keys, or from a server not
// yet issuing them) is still offered: a server that refuses it answers 403,
// and the chat screen then starts a new session.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { makeChatAPICall } from '@prayana/shared-services';

const ID_STORE = 'prayana.chat.sessionId';
const KEY_STORE = 'prayana.chat.sessionKey';
export const SESSION_KEY_HEADER = 'X-Chat-Session-Key';

export type ChatSession = { sessionId: string; sessionKey: string | null };

let current: ChatSession | null = null;

async function readKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_STORE);
  } catch {
    return null;
  }
}

async function writeKey(key: string | null): Promise<void> {
  try {
    if (key) await SecureStore.setItemAsync(KEY_STORE, key);
    else await SecureStore.deleteItemAsync(KEY_STORE);
  } catch {
    // Without SecureStore the key lives for this launch only; a relaunch
    // then starts a new session rather than failing.
  }
}

/** The session saved by an earlier launch, if it can still be used. */
export async function loadSavedChatSession(): Promise<ChatSession | null> {
  const sessionId = await AsyncStorage.getItem(ID_STORE).catch(() => null);
  if (!sessionId) return null;
  current = { sessionId, sessionKey: await readKey() };
  return current;
}

/** Start a new server session and remember it (and its key) for relaunches. */
export async function startChatSession(context: Record<string, any> = { type: 'general' }): Promise<ChatSession> {
  const res = await makeChatAPICall('/chat/session/start', {
    method: 'POST',
    body: JSON.stringify({ context, useSessionKey: true }),
    timeout: 15000,
  });
  const sessionId = res?.data?.sessionId;
  if (!sessionId) throw new Error('Could not start session');
  current = { sessionId: String(sessionId), sessionKey: res?.data?.sessionKey || null };
  await AsyncStorage.setItem(ID_STORE, current.sessionId).catch(() => {});
  await writeKey(current.sessionKey);
  return current;
}

/** Drop the saved session, e.g. when the user clears the chat. */
export async function forgetChatSession(): Promise<void> {
  current = null;
  await AsyncStorage.removeItem(ID_STORE).catch(() => {});
  await writeKey(null);
}

/** The key for `sessionId`, when it's the session this app holds. */
export function chatSessionKeyFor(sessionId: string | null | undefined): string | null {
  return sessionId && current?.sessionId === String(sessionId) ? current.sessionKey : null;
}

/** Headers that let the server know this app may use `sessionId`. */
export function chatSessionHeaders(sessionId: string | null | undefined): Record<string, string> {
  const key = chatSessionKeyFor(sessionId);
  return key ? { [SESSION_KEY_HEADER]: key } : {};
}

/** The server refused the session (not ours, or gone): start a new one. */
export const isSessionRefused = (err: any): boolean => err?.status === 403 || err?.status === 404;
