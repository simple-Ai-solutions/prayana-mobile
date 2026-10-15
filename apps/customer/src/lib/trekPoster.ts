// The words on a trek poster card, ported from the web's
// components/activities/TrekPosterClassic.jsx. Every value is read from the
// listing; a field that is absent drops its line rather than being filled
// with a plausible default. Keep in step with the web.

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Small stable number from an id, so a card's look never changes between renders. */
export function hashOf(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const categoriesOf = (a: any): string[] =>
  (Array.isArray(a?.category) ? a.category : String(a?.category || '').split(','))
    .map((s: any) => String(s).trim())
    .filter(Boolean);

export const isTrekking = (a: any) => categoriesOf(a).includes('Trekking') || /\btrek/i.test(a?.title || '');

// ─── The poster title ────────────────────────────────────────────────────
// Words that describe the KIND of outing rather than the place. Stripped from
// the title to leave the name on the poster; the first one found becomes the
// small word above it.
const KIND_WORDS: Record<string, string> = {
  trek: 'Trek', trekking: 'Trek', hike: 'Hike', hiking: 'Hike', expedition: 'Expedition',
  camping: 'Camp', camp: 'Camp', outing: 'Day Outing', trail: 'Trail', climb: 'Climb',
  trip: 'Trip', tour: 'Tour', tours: 'Tour', safari: 'Safari', cruise: 'Cruise', walk: 'Walk',
  ticket: 'Tickets', tickets: 'Tickets', pass: 'Pass', show: 'Show', class: 'Class',
  workshop: 'Workshop', rafting: 'Rafting', kayaking: 'Kayaking', paragliding: 'Paragliding',
  scuba: 'Scuba', diving: 'Diving', snorkelling: 'Snorkelling', snorkeling: 'Snorkelling',
  retreat: 'Retreat', transfer: 'Transfer', experience: 'Experience', ride: 'Ride',
};
const FILLER = new Set([
  'sunrise', 'sunset', 'night', 'weekend', 'overnight', 'day', 'adventure', 'the', 'a', 'an',
  'with', 'and', 'from', 'to', 'in', 'of', 'at', 'for', 'on', 'bengaluru', 'bangalore',
  'guided', 'group', 'private', 'special', 'monsoon', 'winter', 'summer', 'one', 'two',
  'full', 'half', 'entry', 'skip', 'line', '2d1n', '1n2d',
]);

export function posterName(title = '', trek = false) {
  const head = title.split(/\s+(?:—|–|-|\||by)\s+|:|\(/i)[0] || title;
  const words = head.split(/\s+/).filter(Boolean);
  let kind: string | null = null;
  for (const w of title.split(/\s+/)) {
    const k = w.toLowerCase().replace(/[^a-z]/g, '');
    if (KIND_WORDS[k]) { kind = KIND_WORDS[k]; break; }
  }
  // Up to two meaningful words, keeping an "&" that joins them.
  const keep: string[] = [];
  let count = 0;
  for (const w of words) {
    if (count >= 2) break;
    const k = w.toLowerCase().replace(/[^a-z0-9&]/g, '');
    if (k === '&') { if (count === 1) keep.push('&'); continue; }
    if (KIND_WORDS[k] || FILLER.has(k) || /^\d+[dn]?$/.test(k) || !k) continue;
    keep.push(w.replace(/[,.;:!]+$/, ''));
    count++;
  }
  if (keep[keep.length - 1] === '&') keep.pop();
  const name = keep.join(' ') || words.slice(0, 2).join(' ');
  return { name, kind: kind || (trek ? 'Trek' : null) };
}

// ─── The line above the title ────────────────────────────────────────────
function joinDays(days: number[]) {
  // Monday-first reads more naturally than the Sunday-first index order.
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 1) return `Every ${DAY_FULL[sorted[0]]}`;
  const order = sorted.map((d) => DAY[d]);
  return `Every ${order.slice(0, -1).join(', ')} & ${order[order.length - 1]}`;
}

/**
 * Which days it runs, and for how long. No clock time: the slot times on many
 * listings are a 06:00 placeholder, and a wrong departure time is worse than none.
 */
export function scheduleLine(activity: any, durationLabel: string | null) {
  const w = activity.weeklySchedule;
  if (w?.days?.length) return [joinDays(w.days), durationLabel].filter(Boolean).join(' · ');
  const next = Array.isArray(activity.upcomingDates) ? activity.upcomingDates : [];
  if (next.length) {
    const d = new Date(`${next[0]}T00:00:00`);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return [`Next: ${label}`, durationLabel].filter(Boolean).join(' · ');
  }
  return durationLabel || null;
}

// ─── Where it is ─────────────────────────────────────────────────────────
// For treks the city field holds the base village or the departure city, so
// the region comes from the trek's name.
const TREK_REGIONS = [
  { test: /ballarayana|gangadikal|mullayanagiri|chikmagalur|chikkamagaluru/i, region: 'Chikmagalur' },
  { test: /kurinjal|netravathi|netravati|kudremukh/i, region: 'Kudremukh' },
  { test: /nelji|coorg|kodagu|madikeri/i, region: 'Coorg' },
  { test: /bandaje|didupe|ermayi|charmadi/i, region: 'Charmadi Ghats' },
  { test: /kodachadri/i, region: 'Shivamogga' },
  { test: /dudhsagar/i, region: 'Goa–Karnataka border' },
  { test: /kodaikanal/i, region: 'Kodaikanal, Tamil Nadu' },
  { test: /amboli/i, region: 'Amboli, Maharashtra' },
];

export function regionOf(activity: any, trek: boolean): string | null {
  const city = activity.location?.city;
  if (trek) {
    const hit = TREK_REGIONS.find((r) => r.test.test(activity.title || ''));
    if (hit) return hit.region;
    return city && !/bengaluru|bangalore/i.test(city) ? city : null;
  }
  return city || activity.location?.country || null;
}

/** "BANDAJE TREK" -> "Bandaje Trek"; drops a "— Coorg" the place line already shows. */
export function displayTitle(title = '', region: string | null) {
  let t = title === title.toUpperCase()
    ? title.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : title;
  if (region) {
    const [head, tail] = t.split(/\s+—\s+/);
    if (tail && region.toLowerCase().startsWith(tail.toLowerCase().slice(0, 6))) t = head;
  }
  return t;
}

// ─── What the price includes ─────────────────────────────────────────────
// Matched on the operator's own inclusion list, whole words only ("fee" must
// not match "coffee"). At most four fit across the poster.
export type Inclusion = 'Travel' | 'Guide' | 'Permits' | 'Food' | 'Stay' | 'First aid' | 'Photos' | 'Tea';
const INCLUDE_RULES: { test: RegExp; label: Inclusion }[] = [
  { test: /transport|travel|\bbus\b|tempo|pickup|pick-up|\bdrop\b|\bcab\b|traveller/i, label: 'Travel' },
  { test: /\bguides?\b|\btrek leaders?\b|\bcaptains?\b|\binstructors?\b/i, label: 'Guide' },
  { test: /\bpermits?\b|\bentry\b|forest (?:fee|permit|entry)|\btickets?\b|\bfees?\b/i, label: 'Permits' },
  { test: /\bfood\b|\bmeals?\b|breakfast|lunch|dinner|snacks?\b/i, label: 'Food' },
  { test: /\bstay\b|\btents?\b|\bcamp(?:ing|site)?\b|homestay|\bdorms?\b|accommodation/i, label: 'Stay' },
  { test: /first.?aid|medical/i, label: 'First aid' },
  { test: /\bphotos?\b|photograph|\bvideos?\b|\bdrone\b/i, label: 'Photos' },
  { test: /\btea\b|\bcoffee\b|refreshment/i, label: 'Tea' },
];

export function inclusions(activity: any): Inclusion[] {
  const list: string[] = activity.pricing?.includesWhat || [];
  if (!list.length) return [];
  const hay = list.join(' | ');
  return INCLUDE_RULES.filter((r) => r.test.test(hay)).slice(0, 4).map((r) => r.label);
}

// ─── The strap ───────────────────────────────────────────────────────────
// A line written per trek, else the listing's own shortest highlight, and only
// then a line for its category. About the experience, never about scarcity.
const STRAPS_BY_TREK = [
  { test: /gangadikal/i, line: 'Ridge walks above a sea of clouds' },
  { test: /ballarayana/i, line: 'An old fort on a cloud-wrapped ridge' },
  { test: /didupe|ermayi/i, line: 'Jungle streams to a hidden falls' },
  { test: /kodaikanal/i, line: 'Pine forests and misty pillar rocks' },
  { test: /nelji/i, line: "Coorg's quiet summit at sunset" },
  { test: /bandaje/i, line: 'Grasslands to the top of a waterfall' },
  { test: /chikmagalur|mullayanagiri/i, line: "Karnataka's highest peak" },
  { test: /dudhsagar/i, line: 'Walk the rails to the sea of milk' },
  { test: /kurinjal/i, line: 'Endless green folds of Kudremukh' },
  { test: /kodachadri/i, line: 'Sunset from a summit shrine' },
  { test: /netravathi|netravati/i, line: 'Fog, grass and a ridge to the top' },
  { test: /amboli/i, line: 'Where waterfalls flow upwards' },
];
const STRAPS_TREKKING = ['Come solo, leave with a crew', 'Strangers at the base, friends at the top', 'Two days off the grid'];
const STRAPS_DEFAULT = ["Moments you'll keep", 'Worth the trip', 'Made for memories'];

function ownLine(activity: any): string | null {
  const candidates = [
    ...(Array.isArray(activity.highlights) ? activity.highlights : []),
    String(activity.shortDescription || '').split(/[.!?;—–]|,\s/)[0],
  ];
  for (const c of candidates) {
    const line = String(c || '').replace(/^[\s•\-–—*🌟✨]+/u, '').trim();
    if (line.length >= 12 && line.length <= 40) return line;
  }
  return null;
}

export function strapFor(activity: any, trek: boolean, seed: number) {
  if (trek) {
    const hit = STRAPS_BY_TREK.find((s) => s.test.test(activity.title || ''));
    if (hit) return hit.line;
  }
  const own = ownLine(activity);
  if (own) return own;
  const pool = categoriesOf(activity)[0] === 'Trekking' ? STRAPS_TREKKING : STRAPS_DEFAULT;
  return pool[seed % pool.length];
}
