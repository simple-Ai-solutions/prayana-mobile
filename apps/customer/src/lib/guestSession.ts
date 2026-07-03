/**
 * Guest session factory.
 *
 * Why this exists:
 *  - Apple App Store rejects apps that gate non-purchase content behind sign-in
 *    (App Review Guideline 5.1.1 (v)).
 *  - Travel apps convert better when users can browse → see value → sign up,
 *    not the reverse.
 *
 * The guest object is shape-compatible with Firebase's `User` so existing code
 * that reads `user.uid`, `user.displayName`, etc. keeps working. The `uid`
 * sentinel `'guest-user'` is what every gated flow (booking, save, chat) checks
 * via `isGuest()` before showing the login prompt.
 */

export const GUEST_UID = 'guest-user';

export function makeGuestUser() {
  return {
    uid: GUEST_UID,
    displayName: 'Guest',
    email: null,
    photoURL: null,
    phoneNumber: null,
    isAnonymous: true,
    providerData: [],
    metadata: { creationTime: new Date().toISOString() },
    getIdToken: async () => 'guest-token',
  } as any;
}

export function isGuest(user: { uid?: string } | null | undefined): boolean {
  return !user || user.uid === GUEST_UID;
}
