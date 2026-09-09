// goBack — a back handler that never dead-ends. router.back() is a no-op when
// there's no history to pop (a screen opened via deep-link, notification, or as
// a cold-start entry point), which makes the back button appear broken. Use
// this for top-bar back buttons on feature-root screens: pop when possible,
// else fall back to the tabs home (or a caller-supplied route).
import { router } from 'expo-router';

export function goBack(fallback: string = '/(tabs)') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as any);
}
