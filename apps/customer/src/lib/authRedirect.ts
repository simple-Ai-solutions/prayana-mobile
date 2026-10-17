// Where to land after signing in, from a `redirectTo` route param (set by
// useRequireAuth's redirectAfter, My Bookings, Profile…). Only in-app paths
// count: a leading "/" — not "//", which would read as another host — and
// never back into the sign-in screens themselves.
export function readRedirect(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('(auth)')) return null;
  return path;
}
