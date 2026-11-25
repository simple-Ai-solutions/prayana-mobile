// Where to go once sign-in finishes. Screens that need an account send the
// user to /(auth)/login with `redirectTo` (a booking checkout, notifications…);
// the login screen stores it here, and every way of finishing sign-in — phone,
// email, Google, Apple, Truecaller, sign-up, or the name screen after any of
// them — reads it, instead of dropping the user on the home tab and losing
// what they were doing.

let pending: string | null = null;

/** Only in-app paths: no schemes, no protocol-relative "//host". */
function safe(path?: string | null): string | null {
  if (typeof path !== 'string') return null;
  const p = path.trim();
  return p.startsWith('/') && !p.startsWith('//') ? p : null;
}

export function setPostAuthRedirect(path?: string | null) {
  pending = safe(path);
}

/** The route to open after sign-in (home if none); clears it. */
export function postAuthRoute(): string {
  const p = pending;
  pending = null;
  return p || '/(tabs)';
}
