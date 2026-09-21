// goBack — a back handler that never dead-ends.
//
// Two failure modes, both of which leave the user stuck on a screen whose back
// button appears dead:
//
//   1. router.back() is a no-op when there is genuinely no history to pop — a
//      screen opened by deep link, notification, or as a cold-start entry.
//   2. router.canGoBack() can report TRUE while the pop still goes unhandled
//      ("The action 'GO_BACK' was not handled by any navigator"). It reflects
//      the root navigator rather than the stack that would service the pop.
//
// So the guard alone is not enough: check the navigation state for a route
// actually stacked beneath us, and treat the guard as a second opinion.
import { router, useRootNavigationState } from 'expo-router';

/** Imperative version for callers without hook context. */
export function goBack(fallback: string = '/(tabs)') {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // fall through — a throwing navigator still needs somewhere to land
  }
  router.replace(fallback as any);
}

/**
 * Hook version. Prefer this inside components: it can see the navigation state
 * and so avoids firing an unhandled GO_BACK.
 */
export function useGoBack(fallback: string = '/(tabs)') {
  const navState = useRootNavigationState();
  return () => {
    const stacked = navState?.routes?.length ?? 0;
    if (stacked > 1 && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallback as any);
  };
}
