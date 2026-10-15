// Helpers for the Divya Darshana yatra cards, ported from the web:
//   components/packages/DepartureChips.jsx   (upcomingDepartures, seatNote)
//   utils/departureStatus.js                 (departureStatus)
//   components/packages/PackageExperienceCard (inclusionsOf, photosOf)
//   components/divya-darshana/GroupDepartureRail + OvalCard (poster lettering)
// Keep in step with the web.

export const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type Departure = {
  _id?: string;
  startDate: string;
  status?: string;
  availableSlots?: number;
  bookedSlots?: number;
  variantOverrides?: { prices?: Record<string, { pricePerPerson?: number; mrpPerPerson?: number }> };
};

/** Bookable departures, soonest first: past dates and anything not open dropped. */
export function upcomingDepartures(pkg: any): Departure[] {
  const now = Date.now();
  return ((pkg?.departures || []) as Departure[])
    .filter((d) => d?.status === 'open' && new Date(d.startDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * How a departure is selling, as a label rather than a seat count. Urgency is
 * earned, never invented: "Filling fast" needs seats to have actually sold.
 */
export function departureStatus(dep: Departure, now = new Date()) {
  const total = dep?.availableSlots ?? 0;
  const booked = dep?.bookedSlots ?? 0;
  const left = total - booked;
  const closed = dep?.status && dep.status !== 'open' && dep.status !== 'filling_fast';
  const start = dep?.startDate ? new Date(dep.startDate) : null;
  const daysOut = start ? Math.round((start.getTime() - now.getTime()) / 86400000) : Infinity;

  if (closed || left <= 0) return { label: 'Sold out', tone: 'gone' as const, left };
  if (left <= 4) return { label: `Only ${left} ${left === 1 ? 'seat' : 'seats'} left`, tone: 'urgent' as const, left };
  if (booked > 0 && left <= 10) return { label: 'Filling fast', tone: 'urgent' as const, left };
  if (daysOut <= 7) return { label: 'Closing soon', tone: 'urgent' as const, left };
  return { label: 'Small group · confirmed', tone: 'calm' as const, left };
}

/** Real scarcity only; "Closing soon" is about the calendar, so it earns no badge. */
export function seatNote(dep: Departure) {
  const st = departureStatus(dep);
  if (st.tone === 'gone') return { text: st.label, tone: 'gone' as const };
  if (st.tone === 'urgent' && st.label !== 'Closing soon') return { text: st.label, tone: 'urgent' as const };
  return null;
}

export const priceOf = (dep: Departure | undefined, pkg: any): number | undefined =>
  Object.values(dep?.variantOverrides?.prices || {})[0]?.pricePerPerson ?? pkg.variants?.[0]?.pricing?.basePrice;

/** The list price a departure is discounted from, where one is set. */
export const mrpOf = (dep: Departure | undefined): number | null =>
  Object.values(dep?.variantOverrides?.prices || {})[0]?.mrpPerPerson ?? null;

// ─── What the price includes ─────────────────────────────────────────────
// Read from the package's own inclusions list — whole words, at most four, in
// the order a traveller weighs them.
export type PackagePerk = 'Camping' | 'Stay' | 'Meals' | 'Transfers' | 'Guide' | 'Sightseeing';
const INCLUDE_RULES: { test: RegExp; label: PackagePerk }[] = [
  { test: /\bcamping\b|\btents?\b/i, label: 'Camping' },
  { test: /accommodation|\bhotels?\b|\bstays?\b|\bnights? in\b|homestay|resort/i, label: 'Stay' },
  { test: /breakfast|dinner|lunch|\bmeals?\b/i, label: 'Meals' },
  { test: /transfer|vehicle|\bcab\b|coach|pickup|pick-up|\bdrop\b|traveller/i, label: 'Transfers' },
  { test: /\bguide\b|representative|assistance|tour manager/i, label: 'Guide' },
  { test: /sightseeing|excursion|tour of/i, label: 'Sightseeing' },
];

export function inclusionsOf(pkg: any): PackagePerk[] {
  const hay = ((pkg.inclusions || []) as string[]).join(' | ');
  if (!hay) return [];
  const hits = INCLUDE_RULES.filter((r) => r.test.test(hay)).map((r) => r.label);
  // Camping and Stay say the same thing twice when a trip has both.
  return hits.filter((l) => !(l === 'Stay' && hits.includes('Camping'))).slice(0, 4);
}

/** The package's own photos, primary first; expired Google photo links dropped. */
export function photosOf(pkg: any): string[] {
  const dead = (u = '') => /maps\.googleapis\.com\/maps\/api\/place\/photo/.test(u);
  const primary = pkg.images?.find((i: any) => i.isPrimary)?.url;
  return [...new Set([primary, ...(pkg.images || []).map((i: any) => i.url)].filter(Boolean))]
    .filter((u) => !dead(u)) as string[];
}

/**
 * Hands each package photos no other card on the page uses: every card first
 * gets one lead photo, then the rest are shared out round-robin, so the
 * changing photos never repeat another card's temple.
 */
export function assignExclusiveFrames(pkgs: any[] = [], max = 4): Record<string, string[]> {
  const used = new Set<string>();
  const out: Record<string, string[]> = {};
  const pools = pkgs.map((p) => photosOf(p));
  pkgs.forEach((p) => { out[p._id] = []; });
  for (let round = 0; round < max; round++) {
    pkgs.forEach((p, i) => {
      const pick = pools[i].find((u) => !used.has(u));
      if (pick) { used.add(pick); out[p._id].push(pick); }
    });
  }
  return out;
}

// ─── Poster lettering ────────────────────────────────────────────────────

/** Group card: "Varanasi, Prayagraj & Ayodhya — …" -> Varanasi over "Prayagraj · Ayodhya". */
export function groupPosterNames(title = '') {
  const head = title.split(/\s+[—–]\s+/)[0].trim();
  const places = head.split(/,|&/).map((x) => x.trim()).filter(Boolean);
  if (places.length > 1) return { name: places[0], rest: places.slice(1).join(' · ') };
  return { name: head.replace(/\s+(soul )?journey$/i, '').trim() || head, rest: null as string | null };
}

/** "…Group Tour, 3N/4D" -> "Group tour · 3N/4D" */
export function groupStrapOf(title = '') {
  const tail = title.split(/\s+[—–]\s+/)[1] || '';
  return tail.replace(/,\s*/g, ' · ').replace(/group tour/i, 'Group tour') || 'Sacred journey';
}

/** Arch card: the place set big, the rest of the route on the small line. */
export function archPosterNames(pkg: any) {
  const head = String(pkg.title || '').split(/\s+[—–]\s+/)[0].replace(/\s+with\s+.*$/i, '').trim();
  const places = head.split(/,|&/).map((x) => x.trim()).filter(Boolean);
  if (places.length > 1) return { name: places[0], rest: places.slice(1).join(' · ') };
  const short = head.replace(/\s+(soul\s+)?(journey|yatra|darshan|pilgrimage|tour)$/i, '').trim();
  // "Do Dham Yatra — Kedarnath & Badrinath, 5N/6D …": the places after the
  // dash say which dhams, so they make the strap. Durations and "from …" don't.
  const tail = String(pkg.title || '').split(/\s+[—–]\s+/)[1]?.split(',')[0]?.trim() || '';
  const tailPlaces = /\d/.test(tail) || /^from\b/i.test(tail) ? [] : tail.split(/&|·/).map((x) => x.trim()).filter(Boolean);
  return {
    name: short.length > 18 ? pkg.primaryDestination || short : short || head,
    rest: tailPlaces.length > 1 ? tailPlaces.join(' · ') : (null as string | null),
  };
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
