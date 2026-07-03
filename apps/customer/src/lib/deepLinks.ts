/**
 * Deep link router for the customer app.
 *
 * Recognises:
 *   - Custom scheme: `prayana://...`
 *   - Universal: https://prayanaai.com/app/...
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

export function resolveDeepLink(url: string | null | undefined): DeepLinkResult {
  if (!url) return null;
  try {
    const u = new URL(url);

    // Custom scheme: prayana://activity/abc → /activity/abc
    if (u.protocol === 'prayana:') {
      const path = `/${u.host}${u.pathname}`.replace(/\/+/g, '/');
      return path && path !== '/' ? path : '/';
    }

    // Universal link: https://prayanaai.com/app/activity/abc
    if ((u.protocol === 'https:' || u.protocol === 'http:') && APP_HOSTS.includes(u.host)) {
      if (u.pathname.startsWith(APP_PATH_PREFIX)) {
        const path = u.pathname.slice(APP_PATH_PREFIX.length) || '/';
        const search = u.search || '';
        return `${path}${search}`;
      }
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
