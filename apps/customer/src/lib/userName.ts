// "Is this a real user name?" — mirrors server/utils/validateUserName.js on the
// web repo so the app and the API agree on what counts as a placeholder.
//
// Phone-OTP signups are created without a name, and older flows wrote
// placeholders ("Travel User", "User 1234", the phone number itself). All of
// those count as ABSENT: the account is "profile incomplete" and the user is
// asked for their name once.

const PLACEHOLDER_NAMES = new Set(['travel user', 'user', 'guest', 'anonymous']);
// "User 1234" — an older auto-generated placeholder.
const NUMBERED_PLACEHOLDER_RE = /^user\s*\d{3,4}$/i;
// A "name" that is really a phone number ("+918123061232", "8123061232").
const PHONE_AS_NAME_RE = /^\+?\d[\d\s-]{6,}$/;

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 100;

export function isPlaceholderName(name: unknown): boolean {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return true;
  if (NUMBERED_PLACEHOLDER_RE.test(trimmed)) return true;
  if (PHONE_AS_NAME_RE.test(trimmed)) return true;
  return false;
}

// Accounts whose name was saved this session. The root NameGate checks this
// before redirecting, so a profile fetch that started before the save and
// returns the stale placeholder can't bounce the user back to the name step.
const namedThisSession = new Set<string>();
export const markNameComplete = (uid: string) => { namedThisSession.add(uid); };
export const isNameCompleteThisSession = (uid: string) => namedThisSession.has(uid);

/** Client-side check before PUT /auth/profile; the server re-validates. */
export function validateName(name: string): { valid: boolean; value: string; message?: string } {
  const value = name.trim().replace(/\s+/g, ' ');
  if (!value) return { valid: false, value, message: 'Please enter your name.' };
  if (value.length < MIN_NAME_LENGTH) {
    return { valid: false, value, message: `Name must be at least ${MIN_NAME_LENGTH} characters.` };
  }
  if (value.length > MAX_NAME_LENGTH) {
    return { valid: false, value, message: `Name cannot exceed ${MAX_NAME_LENGTH} characters.` };
  }
  if (isPlaceholderName(value)) {
    return { valid: false, value, message: 'Please enter your real name.' };
  }
  // Require at least one letter so "1234" / "----" can't pass as a name.
  if (!/\p{L}/u.test(value)) {
    return { valid: false, value, message: 'Please enter a valid name.' };
  }
  return { valid: true, value };
}
