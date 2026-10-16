/**
 * Deep link router for the customer app.
 *
 * Recognises:
 *   - Custom scheme: `prayana://...`
 *   - Universal: https://prayanaai.com/app/...
 *   - Website links that have an app screen (see WEB_ROUTES below), with or
 *     without the /app prefix: trip share / invite / live-trip links and the
 *     package landing pages.
 *
 * Maps incoming URL paths to expo-router routes. Push notification payloads
 * also use the same `route` field, so this is the single normaliser.
 *
 * Usage:
 *   const url = await Linking.getInitialURL();
 *   const route = resolveDeepLink(url);
 *   if (route) router.push(route);
 */

const APP_HOSTS = ['prayanaai.com', 'www.prayanaai.com'];
const APP_PATH_PREFIX = '/app';

export type DeepLinkResult = string | null;

// Static screens under app/trip/. /trip/<anything else> on the website is a
// live-trip share token (web app/trip/[token]/page.js).
const TRIP_SCREENS = new Set([
  'plan', 'setup', 'destinations', 'planner', 'search-activity', 'review', 'itinerary',
  'share', 'invite', 'live',
]);

/**
 * Website paths that open a specific app screen, or null when the path is not
 * one of them. Website and app share these URLs except /trip/<token>, which
 * the app serves at /trip/live/<token>.
 *
 *   /trip/share/<shareToken>   → /trip/share/<shareToken>   (join via share link)
 *   /trip/invite/<token>       → /trip/invite/<token>       (accept invite)
 *   /trip/<token>              → /trip/live/<token>         (follow a live trip)
 *   /packages/in/<place>[/<facet>], /packages/from/<city>, /packages/type/<type>
 */
export function mapWebPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'trip') {
    if ((parts[1] === 'share' || parts[1] === 'invite') && parts[2] && parts.length === 3) {
      return `/trip/${parts[1]}/${parts[2]}`;
    }
    if (parts.length === 2 && !TRIP_SCREENS.has(parts[1])) return `/trip/live/${parts[1]}`;
    if (parts[1] === 'live' && parts[2] && parts.length === 3) return `/trip/live/${parts[2]}`;
    return null;
  }
  if (parts[0] === 'packages') {
    if (parts[1] === 'in' && parts[2] && parts.length <= 4) return `/${parts.join('/')}`;
    if ((parts[1] === 'from' || parts[1] === 'type') && parts[2] && parts.length === 3) return `/${parts.join('/')}`;
  }
  return null;
}

export function resolveDeepLink(url: string | null | undefined): DeepLinkResult {
  if (!url) return null;
  try {
    const u = new URL(url);

    // Custom scheme: prayana://activity/abc → /activity/abc
    if (u.protocol === 'prayana:') {
      const path = `/${u.host}${u.pathname}`.replace(/\/+/g, '/');
      const mapped = mapWebPath(path);
      if (mapped) return mapped;
      return path && path !== '/' ? path : '/';
    }

    if ((u.protocol === 'https:' || u.protocol === 'http:') && APP_HOSTS.includes(u.host)) {
      // Universal link: https://prayanaai.com/app/activity/abc
      if (u.pathname.startsWith(APP_PATH_PREFIX)) {
        const path = u.pathname.slice(APP_PATH_PREFIX.length) || '/';
        const mapped = mapWebPath(path);
        if (mapped) return mapped;
        const search = u.search || '';
        return `${path}${search}`;
      }
      // A website URL with an app screen: https://prayanaai.com/trip/share/abc
      return mapWebPath(u.pathname);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Build a public URL the user can share, given an internal route.
 * Used by share buttons and email/WhatsApp templates.
 */
export function buildPublicUrl(route: string): string {
  const cleanPath = route.startsWith('/') ? route : `/${route}`;
  return `https://prayanaai.com${APP_PATH_PREFIX}${cleanPath}`;
}
