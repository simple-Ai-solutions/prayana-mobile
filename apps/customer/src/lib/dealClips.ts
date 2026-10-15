// Clips for the home "Sea, sand, savings" deals rail, ported from the web's
// components/packages/dealClips.js (its "home" clip set — the Deals tab on
// /packages uses different footage). Keep the pools in step with the web.
//
// Andaman footage is unbranded tropical scenery: no Andaman & Nicobar clips
// exist on the stock sites, so the names say what a clip SHOWS, not where it
// was shot.

const CDN = 'https://prayanaai.com/images/sea-sand-clips';

const POOLS: Record<string, string[]> = {
  'Andaman & Nicobar Islands': ['andaman-speedboat', 'andaman-sunset', 'andaman-beach', 'andaman-reef'],
  Thailand: ['pattaya-bay'],
  Indonesia: ['bali-kelingking'],
};

/**
 * A clip per deal card, never the same file on two cards: four of the six
 * deals are usually Andaman, and a row playing one clip four times reads as a
 * stuck video. Once a destination's pool runs out the rest keep their photo.
 * Returns `{ [packageId]: videoUrl }`.
 */
export function assignDealClips(deals: any[] = []): Record<string, string> {
  const taken = new Set<string>();
  const clips: Record<string, string> = {};
  deals.forEach((pkg) => {
    const name = (POOLS[pkg.dealDestination] || []).find((n) => !taken.has(n));
    if (name) {
      taken.add(name);
      clips[pkg._id] = `${CDN}/${name}.mp4`;
    }
  });
  return clips;
}
