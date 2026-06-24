/**
 * Deep link router for the vendor app.
 *
 * Recognises:
 *   - Custom scheme: `prayanabiz://...`
 *   - Universal: https://business.prayanaai.com/app/...
 */

const APP_HOSTS = ['business.prayanaai.com'];
const APP_PATH_PREFIX = '/app';

export type DeepLinkResult = string | null;

export function resolveDeepLink(url: string | null | undefined): DeepLinkResult {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'prayanabiz:') {
      const path = `/${u.host}${u.pathname}`.replace(/\/+/g, '/');
      return path && path !== '/' ? path : '/';
    }
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

export function buildPublicUrl(route: string): string {
  const cleanPath = route.startsWith('/') ? route : `/${route}`;
  return `https://business.prayanaai.com${APP_PATH_PREFIX}${cleanPath}`;
}
