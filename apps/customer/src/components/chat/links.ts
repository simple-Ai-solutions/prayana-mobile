// Where a website link from Isha goes in the app. The server builds cards and
// replies with the website's paths (/activities/<slug>, /esim/checkout?bundle=…);
// these map them onto the app's own screens.
import type { useRouter } from 'expo-router';
import { mapWebPath } from '../../lib/deepLinks';
import { routeForLink } from '../../lib/notifications';
import { openInApp } from '../../lib/openInApp';

type Router = ReturnType<typeof useRouter>;

const SITE_HOSTS = /^(www\.)?prayanaai\.com$/i;

export const qs = (obj: Record<string, unknown>) => {
  const parts = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

/** The app route for a website path or URL, or null when it's a page elsewhere. */
export function appRouteFor(href?: string | null): string | null {
  if (!href) return null;
  let path = href;
  if (/^https?:\/\//i.test(href)) {
    try {
      const u = new URL(href);
      if (!SITE_HOSTS.test(u.host)) return null;
      path = `${u.pathname}${u.search}`;
      if (path.startsWith('/app/')) path = path.slice(4);
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/')) return null;
  const [bare, search = ''] = path.split('?');
  const query = search ? `?${search}` : '';
  const parts = bare.split('/').filter(Boolean);

  const mapped = mapWebPath(bare);
  if (mapped) return `${mapped}${query}`;

  switch (parts[0]) {
    case 'activities':
      // /activities/<id>/book → the booking screen; /activities/<slug> → detail
      if (parts[1] && parts[2] === 'book') return `/activity/book/${parts[1]}${query}`;
      if (parts[1]) return `/activity/${parts[1]}${query}`;
      return `/activities${query}`;
    case 'esim': {
      const params = new URLSearchParams(search);
      if (parts[1] === 'checkout') {
        const bundle = parts[2] || params.get('bundle');
        if (bundle) return `/esim/checkout/${encodeURIComponent(bundle)}${qs({ country: params.get('country') })}`;
      }
      if (parts[1] === 'my-orders' || parts[1] === 'order') return `${bare}${query}`;
      const country = parts[1] || params.get('country');
      return country && /^[a-z]{2}$/i.test(country) ? `/esim/${country.toUpperCase()}` : '/esim';
    }
    case 'packages':
    case 'transport':
    case 'captain-tours':
    case 'outstation-cabs':
    case 'destination':
    case 'monuments':
      return `${bare}${query}`;
    default:
      return routeForLink(path);
  }
}

/** Open a link from a card or a reply: an app screen when there is one, else the in-app browser. */
export function openHref(router: Router, href?: string | null) {
  if (!href) return;
  const route = appRouteFor(href);
  if (route) {
    router.push(route as never);
    return;
  }
  if (/^(https?:|mailto:|tel:)/i.test(href)) openInApp(href);
}

export function goToLogin(router: Router) {
  router.push({ pathname: '/(auth)/login', params: { redirectTo: '/chat' } } as never);
}
