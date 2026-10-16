import { resolveDeepLink } from '../lib/deepLinks';

// Every link the app is opened with comes through here before Expo Router
// shows it. prayana://chat?initialMessage=... is already a route; a
// https://prayanaai.com/app/... link becomes the route after /app.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^https?:\/\//i.test(path)) return resolveDeepLink(path) || '/';
  } catch {
    // An unreadable link opens the app, not an error
    return '/';
  }
  return path;
}
