// ⚠️ Local development flags — every value MUST be false when committed. ⚠️
// These exist only to browse the vendor app without a real backend/session; they
// are never meant to ship. Flip one locally, then set it back to false before
// committing (same discipline as the auth bypass in app/_layout.tsx).

// Skips real sign-in and seeds a fake session (see app/_layout.tsx) so the UI can
// be browsed without credentials. While this is on there is no Firebase token,
// so authenticated data fetches return 401 — screens read this same flag to stay
// quiet (show their empty state) instead of nagging with a "failed to load"
// toast about an error that is expected in this mode.
export const DEV_BYPASS_AUTH = false;

// Seeds a fake business account (see app/_layout.tsx) so the app skips the
// onboarding wizard and lands on the dashboard with the tab bar visible. Needed
// to browse the post-onboarding UI while DEV_BYPASS_AUTH is on, since real
// registration 401s without a Firebase token. Set back to false to see the
// pre-onboarding "Welcome / Complete Onboarding" state again.
export const DEV_BYPASS_ONBOARDING = false;
