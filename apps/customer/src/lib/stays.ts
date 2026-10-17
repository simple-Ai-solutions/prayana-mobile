// stays — types and small pure helpers for the Stays screens (search,
// property, checkout, booking/voucher, My Bookings).
//
// Mirrors the web's components/stays/discovery/stayParams.js and
// components/stays/booking/stayBookingFormat.js. Stay dates are "YYYY-MM-DD"
// strings in India time, and every instant the server sends (payBy,
// freeUntil, cancelledAt…) is shown in IST wherever the phone is: the
// property runs on India time.
//
// Dates are formatted by hand rather than with Intl: Hermes' Intl support
// (timeZone, formatToParts, en-CA) differs between iOS and Android builds.
import type { CancellationId, HouseRuleId } from './stayLabels';
import { mealPlanLabel, BED_LABEL } from './stayLabels';

// ---- types (server: routes/stays.js, controllers/stayGuestController.js) -------

export type GoogleRating = { rating?: number | null; userRatingsTotal?: number | null } | null;

export type ReviewAspect = 'cleanliness' | 'location' | 'value' | 'staff' | 'comfort';

/** Prayana guests' own rating (separate from Google's). */
export type StayRatingSummary = {
  average: number;
  count: number;
  distribution?: Record<string, number>;
  aspects?: Partial<Record<ReviewAspect, number | null>>;
} | null;

export type StayCoordinates = { lat?: number | null; lng?: number | null } | null;

export type HouseRules = Partial<Record<HouseRuleId, boolean | null>>;

export type StaySearchCard = {
  _id: string;
  slug: string;
  name: string;
  propertyType?: string;
  category?: string;
  starRating?: number | null;
  google?: GoogleRating;
  rating?: StayRatingSummary;
  location?: { locality?: string; city?: string; state?: string; coordinates?: StayCoordinates };
  coverPhoto?: string | null;
  photos?: string[];
  amenities?: string[];
  houseRules?: HouseRules;
  freeCancellation?: boolean;
  nights?: number | null;
  price?: {
    /** null = no dates were given. */
    available?: boolean | null;
    soldOut?: boolean;
    nightly?: number | null;
    total?: number | null;
    roomTypeName?: string | null;
    mealPlan?: string | null;
    units?: number | null;
    roomsLeft?: number | null;
  };
};

export type StayPhoto = {
  _id: string;
  url: string;
  slot?: string;
  roomTypeId?: string | null;
  isCover?: boolean;
  caption?: string | null;
};

export type RoomKind = 'private' | 'dorm' | 'entire_place';

export type StayRoomType = {
  _id: string;
  name: string;
  kind?: RoomKind;
  ac?: boolean | null;
  bedType?: string | null;
  beds?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  bathroom?: 'attached' | 'shared' | string | null;
  sizeSqft?: number | null;
  features?: string[];
  baseOccupancy?: number | null;
  maxOccupancy?: number | null;
  mealPlan?: string | null;
  price?: { perNight?: number | null; extraPerson?: number | null; weekendPerNight?: number | null };
};

export type AvailabilityRow = {
  roomTypeId: string;
  /** Units free every night of the stay. */
  available: number;
  soldOut?: boolean;
  avgNightly?: number | null;
  totalForOne?: number | null;
  /** The party fits in `units` rooms of this type. */
  fits: boolean;
  fitMessage?: string | null;
  roomsNeeded?: number | null;
  units: number;
  price: { total: number; taxableValue?: number; gst?: number; extraTotal?: number } | null;
};

export type StayAvailability = {
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  rooms?: AvailabilityRow[];
  /** Present instead of the above when the dates are invalid. */
  error?: string;
  code?: string;
};

export type StayPolicies = {
  checkInFrom?: string | null;
  checkInUntil?: string | null;
  checkOutBy?: string | null;
  flexibleCheckout24h?: boolean;
  cancellation?: CancellationId | null;
  childrenAllowed?: boolean | null;
  childFreeUnderAge?: number | null;
  minCheckInAge?: number | null;
  houseRules?: HouseRules;
  notes?: string | null;
};

export type StayDetail = {
  _id: string;
  slug: string;
  name: string;
  propertyType?: string;
  category?: string;
  rentalMode?: 'rooms' | 'entire_place';
  hostOnSite?: boolean;
  description?: string | null;
  starRating?: number | null;
  google?: GoogleRating;
  rating?: StayRatingSummary;
  location?: {
    locality?: string;
    city?: string;
    state?: string;
    address?: string | null;
    coordinates?: StayCoordinates;
    exact?: boolean;
  };
  coverPhoto?: string | null;
  photos?: StayPhoto[];
  amenities?: string[];
  experiences?: string[];
  policies?: StayPolicies;
  roomTypes?: StayRoomType[];
  gstThreshold?: number;
  availability?: StayAvailability;
};

export type NightlyLine = {
  date: string;
  unitPrice: number;
  units: number;
  extraGuests?: number;
  extraCharge?: number;
  subtotal?: number;
  gstRate?: number | null;
  gst?: number;
};

export type StayPricing = {
  nightly?: NightlyLine[];
  roomTotal?: number;
  extraTotal?: number;
  taxableValue?: number;
  gst?: number;
  cgst?: number;
  sgst?: number;
  total?: number;
  currency?: string;
  discount?: number | null;
  payable?: number | null;
  couponCode?: string | null;
};

export type StayCouponResult =
  | { applied: true; code: string; discount: number; description?: string | null }
  | { applied: false; code: string; reason?: string | null }
  | null;

export type StayQuote = {
  roomTypeId: string;
  roomTypeName: string;
  roomKind?: RoomKind;
  mealPlan?: string | null;
  nights: number;
  units: number;
  extraGuests?: number;
  available?: number;
  cancellation?: CancellationId | null;
  freeCancellationUntil?: string | null;
  holdMinutes?: number;
  pricing: StayPricing;
  coupon?: StayCouponResult;
};

export type StayBookingStatus = 'payment_pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type StayBooking = {
  _id: string;
  reference: string;
  stay?: string;
  roomTypeId?: string;
  status: StayBookingStatus;
  snapshot?: {
    stayName?: string;
    slug?: string;
    propertyType?: string;
    coverPhoto?: string | null;
    address?: string | null;
    city?: string;
    state?: string;
    coordinates?: StayCoordinates;
    hostPhone?: string | null;
    hostEmail?: string | null;
    checkInFrom?: string | null;
    checkOutBy?: string | null;
    roomTypeName?: string;
    roomKind?: RoomKind;
    mealPlan?: string | null;
    cancellation?: CancellationId | null;
    houseRules?: HouseRules;
  };
  guest?: { name?: string; email?: string; phone?: string };
  specialRequests?: string | null;
  arrivalTime?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  units: number;
  adults: number;
  childrenAges?: number[];
  pricing?: StayPricing;
  tax?: { sacCode?: string; cgst?: number; sgst?: number; supplierGstin?: string | null };
  payment?: {
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    paidAt?: string | null;
    refundId?: string | null;
    refundedAmount?: number | null;
    refundedAt?: string | null;
    refundFailureReason?: string | null;
  };
  cancellation?: {
    cancelledAt?: string | null;
    cancelledBy?: 'customer' | 'vendor' | 'system' | null;
    reason?: string | null;
    refundPercent?: number | null;
    refundAmount?: number | null;
  };
  cancelPreview?: { refundPercent: number; refundAmount: number; freeUntil: string | null; allowed: boolean };
  payBy?: string;
  hasReviewed?: boolean;
  canReview?: boolean;
  createdAt?: string;
};

export type StayReview = {
  _id: string;
  rating: number;
  aspects?: Partial<Record<ReviewAspect, number | null>>;
  tripType?: string | null;
  title?: string | null;
  body?: string | null;
  photos?: string[];
  reviewer?: { name?: string };
  roomTypeName?: string | null;
  stayedOn?: string | null;
  nights?: number | null;
  reply?: { body?: string; repliedAt?: string } | null;
  createdAt?: string;
};

// ---- the party ----------------------------------------------------------------

export const MAX_ADULTS = 20;
export const MAX_CHILDREN = 6;
export const MAX_CHILD_AGE = 17;
export const MAX_ROOMS = 10;
export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;
export const DEFAULT_ADULTS = 2;

export type Party = { adults: number; children: number[]; rooms: number };
export type StayDates = { checkIn: string; checkOut: string };
export type StayQueryState = StayDates & Party;

export const DEFAULT_PARTY: Party = { adults: DEFAULT_ADULTS, children: [], rooms: 1 };

const clampInt = (v: unknown, def: number, min: number, max: number) => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** "4,9" → [4, 9] */
export function parseAges(v: unknown): number[] {
  return String(v || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '' && /^\d+$/.test(x))
    .map((x) => clampInt(x, 0, 0, MAX_CHILD_AGE))
    .slice(0, MAX_CHILDREN);
}

type ParamValue = string | string[] | undefined;
const one = (v: ParamValue): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Dates and party from route params. Dates come through only as a valid
 * pair: a lone check-in would make the server answer 400.
 */
export function readStayQuery(params: Record<string, ParamValue>): StayQueryState {
  const checkIn = one(params.checkIn) || '';
  const checkOut = one(params.checkOut) || '';
  const datesOk = isISODate(checkIn) && isISODate(checkOut);
  const adults = clampInt(one(params.adults), DEFAULT_ADULTS, 1, MAX_ADULTS);
  return {
    checkIn: datesOk ? checkIn : '',
    checkOut: datesOk ? checkOut : '',
    adults,
    children: parseAges(one(params.children)),
    // A room needs an adult (the server refuses otherwise).
    rooms: Math.min(clampInt(one(params.rooms), 1, 1, MAX_ROOMS), adults),
  };
}

function toQuery(entries: [string, string | number | undefined | null][]): string {
  const parts = entries
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Query entries for dates + party; defaults are left out so links stay short. */
function partyEntries(s: Partial<StayQueryState>): [string, string][] {
  const out: [string, string][] = [];
  if (s.checkIn && s.checkOut) out.push(['checkIn', s.checkIn], ['checkOut', s.checkOut]);
  if (s.adults && s.adults !== DEFAULT_ADULTS) out.push(['adults', String(s.adults)]);
  if (s.children?.length) out.push(['children', s.children.join(',')]);
  if (s.rooms && s.rooms !== 1) out.push(['rooms', String(s.rooms)]);
  return out;
}

/** /stays/<slug> with the guest's dates and party. */
export function propertyPath(slug: string, s: Partial<StayQueryState> = {}): string {
  return `/stays/${encodeURIComponent(slug)}${toQuery(partyEntries(s))}`;
}

/** /stays?q=… with dates and party. */
export function searchPath(q: string, s: Partial<StayQueryState> = {}): string {
  return `/stays${toQuery([['q', q.trim()], ...partyEntries(s)])}`;
}

export type StaySelection = {
  slug: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  /** Rooms, or beds (= guests) for a dorm room type. */
  units: number;
  adults: number;
  childrenAges: number[];
};

/** Same params as the web's /stays/checkout, so a shared link maps 1:1. */
export function checkoutPath(sel: StaySelection): string {
  return `/stays/checkout${toQuery([
    ['slug', sel.slug],
    ['room', sel.roomTypeId],
    ['checkIn', sel.checkIn],
    ['checkOut', sel.checkOut],
    ['rooms', sel.units],
    ['adults', sel.adults],
    ['children', sel.childrenAges.length ? sel.childrenAges.join(',') : ''],
  ])}`;
}

/** Reads the checkout params; a reason when the link is broken. */
export function parseSelection(
  params: Record<string, ParamValue>,
): { ok: true; sel: StaySelection } | { ok: false; slug: string; reason: string } {
  const slug = (one(params.slug) || '').trim();
  const roomTypeId = (one(params.room) || '').trim();
  const checkIn = one(params.checkIn) || '';
  const checkOut = one(params.checkOut) || '';
  const units = Number(one(params.rooms) || 1);
  const adults = Number(one(params.adults) || 0);
  const rawKids = (one(params.children) || '').trim();
  const childrenAges = rawKids ? rawKids.split(',').map((x) => Number(x.trim())) : [];

  const bad = (reason: string) => ({ ok: false as const, slug, reason });
  if (!slug || !roomTypeId) return bad("We couldn't tell which room you picked.");
  if (!isISODate(checkIn) || !isISODate(checkOut) || checkOut <= checkIn) {
    return bad('The dates for this stay look wrong.');
  }
  if (!Number.isInteger(units) || units < 1 || units > 20) return bad('The number of rooms looks wrong.');
  if (!Number.isInteger(adults) || adults < 1 || adults > 50) return bad('At least one adult has to stay.');
  if (childrenAges.some((a) => !Number.isInteger(a) || a < 0 || a > MAX_CHILD_AGE)) {
    return bad("Children's ages need to be between 0 and 17.");
  }
  return { ok: true, sel: { slug, roomTypeId, checkIn, checkOut, units, adults, childrenAges } };
}

// ---- dates ----------------------------------------------------------------------

const IST_OFFSET_MS = 330 * 60000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Today in India, "YYYY-MM-DD" (India has no daylight saving). */
export function todayIST(now: number = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar maths in UTC so the phone's own timezone can't shift the day. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!isISODate(checkIn) || !isISODate(checkOut)) return 0;
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
}

/** A local Date at midnight for the native picker's minimumDate. */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** What's wrong with a date pair, in the server's words, or null. Both empty is fine. */
export function datesProblem(checkIn: string, checkOut: string): string | null {
  if (!checkIn && !checkOut) return null;
  if (!isISODate(checkIn)) return 'Add a check-in date';
  if (!isISODate(checkOut)) return 'Add a check-out date';
  const today = todayIST();
  if (checkIn < today) return "Check-in can't be in the past";
  if (nightsBetween(today, checkIn) > MAX_ADVANCE_DAYS) return 'You can book up to a year ahead';
  const n = nightsBetween(checkIn, checkOut);
  if (n < 1) return 'Check-out must be after check-in';
  if (n > MAX_NIGHTS) return `Stays can be up to ${MAX_NIGHTS} nights`;
  return null;
}

type DayParts = { weekday: string; day: number; month: string; year: number; hours: number; minutes: number };

/** A stay date or an ISO instant, read as a calendar day/time in IST. */
function istParts(v: string | null | undefined): DayParts | null {
  if (!v) return null;
  let ms: number;
  if (DATE_RE.test(v)) {
    // A bare stay date is that day; midday keeps it clear of any boundary.
    ms = Date.parse(`${v}T12:00:00Z`);
  } else {
    const t = Date.parse(v);
    if (Number.isNaN(t)) return null;
    ms = t + IST_OFFSET_MS;
  }
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  return {
    weekday: WEEKDAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

/** "Sat, 14 Nov 2026" */
export function fmtDay(v?: string | null): string {
  const p = istParts(v);
  return p ? `${p.weekday}, ${p.day} ${p.month} ${p.year}` : '—';
}

/** "Fri, 16 Oct" */
export function fmtDayNoYear(v?: string | null): string {
  const p = istParts(v);
  return p ? `${p.weekday}, ${p.day} ${p.month}` : '';
}

/** "14 Nov" */
export function fmtShortDay(v?: string | null): string {
  const p = istParts(v);
  return p ? `${p.day} ${p.month}` : '—';
}

/** ISO instant → "3:45 PM" (IST) */
export function fmtTime(v?: string | null): string {
  const p = istParts(v);
  if (!p) return '';
  const h12 = p.hours % 12 === 0 ? 12 : p.hours % 12;
  return `${h12}:${String(p.minutes).padStart(2, '0')} ${p.hours < 12 ? 'AM' : 'PM'}`;
}

/** ISO instant → "Fri, 13 Nov 2026, 2:00 PM" (IST) */
export function fmtDateTime(v?: string | null): string {
  const p = istParts(v);
  return p ? `${fmtDay(v)}, ${fmtTime(v)}` : '—';
}

/** "14 Nov – 16 Nov 2026" */
export function fmtRange(checkIn?: string | null, checkOut?: string | null): string {
  const a = istParts(checkIn);
  const b = istParts(checkOut);
  if (!a || !b) return '—';
  const left = a.year === b.year ? `${a.day} ${a.month}` : `${a.day} ${a.month} ${a.year}`;
  return `${left} – ${b.day} ${b.month} ${b.year}`;
}

/** Seconds → "18:05" */
export function fmtCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---- money & words --------------------------------------------------------------

/** 2362.5 → "₹2,362.50"; 3000 → "₹3,000". Paise only when there are some. */
export function inr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const paise = Math.round(v * 100) % 100 !== 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Whole rupees for lists and cards; the checkout shows the paise. */
export function inrWhole(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;
}

/** What the guest pays: after any coupon (old bookings have no `payable`). */
export const payableOf = (p?: StayPricing | null): number => Number(p?.payable ?? p?.total ?? 0);
export const discountOf = (p?: StayPricing | null): number => Number(p?.discount || 0);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const nightsLabel = (n?: number | null) => plural(Number(n) || 0, 'night');

/** "2 adults, 1 child" */
export function guestsLabel(adults: number, childrenAges: number[] = []): string {
  const kids = childrenAges?.length || 0;
  return [plural(Number(adults) || 0, 'adult'), kids ? plural(kids, 'child', 'children') : null]
    .filter(Boolean)
    .join(', ');
}

/** "2 adults, 1 child · 1 room" */
export function partySummary(p: { adults: number; children: (number | null)[]; rooms: number }, showRooms = true): string {
  const people = [plural(p.adults, 'adult')];
  if (p.children.length) people.push(plural(p.children.length, 'child', 'children'));
  return showRooms ? `${people.join(', ')} · ${plural(p.rooms, 'room')}` : people.join(', ');
}

/** "ages 5 and 8" */
export function childAgesLabel(ages: number[] = []): string {
  if (!ages?.length) return '';
  const list = ages.map((a) => (Number(a) === 0 ? 'under 1' : String(a)));
  const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `${list.length === 1 ? 'age' : 'ages'} ${joined}`;
}

export function unitWord(kind: RoomKind | undefined, n: number): string {
  if (kind === 'dorm') return n === 1 ? 'bed' : 'beds';
  if (kind === 'entire_place') return n === 1 ? 'unit' : 'units';
  return n === 1 ? 'room' : 'rooms';
}

/** "Deluxe Room × 2", "3 beds · 6-Bed Dorm". For a dorm the units are beds, so they lead. */
export function roomLine(name: string | undefined, units: number, kind?: RoomKind): string {
  const u = Number(units) || 1;
  const n = name || 'Room';
  if (kind === 'dorm') return `${plural(u, 'bed')} · ${n}`;
  return u > 1 ? `${n} × ${u}` : n;
}

/** "1 King bed · AC · Attached bathroom" from a public room type. */
export function roomDetailsLine(rt?: StayRoomType | null): string {
  if (!rt) return '';
  const bed = rt.bedType ? BED_LABEL[rt.bedType] : undefined;
  const parts: string[] = [];
  if (rt.kind === 'entire_place') {
    if (rt.bedrooms) parts.push(plural(rt.bedrooms, 'bedroom'));
    if (rt.bathrooms) parts.push(plural(rt.bathrooms, 'bathroom'));
  } else if (rt.kind === 'dorm') {
    if (bed) parts.push(`${bed} beds`);
    if (rt.bathroom) parts.push(`${rt.bathroom === 'shared' ? 'Shared' : 'Private'} bathroom`);
  } else {
    if (bed) parts.push(`${(rt.beds || 0) > 1 ? `${rt.beds} × ` : ''}${bed} bed`);
    if (rt.bathroom) parts.push(`${rt.bathroom === 'shared' ? 'Shared' : 'Attached'} bathroom`);
  }
  if (rt.ac === true) parts.push('AC');
  if (rt.ac === false) parts.push('Non-AC');
  return parts.join(' · ');
}

export { mealPlanLabel };

/** "GST 5%" / "GST 18%", or plain "GST" when the nights mix both rates. */
export function gstLabel(nightly: NightlyLine[] = []): string {
  const rates = [...new Set(nightly.map((n) => n.gstRate).filter((r): r is number => r != null))];
  return rates.length === 1 ? `GST ${Math.round(rates[0] * 100)}%` : 'GST';
}

// ---- links ------------------------------------------------------------------------

const validCoords = (c?: StayCoordinates) => {
  const lat = Number(c?.lat);
  const lng = Number(c?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : null;
};

export function mapSearchHref(c?: StayCoordinates): string | null {
  const v = validCoords(c);
  return v ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}` : null;
}

export function directionsHref(c?: StayCoordinates): string | null {
  const v = validCoords(c);
  return v ? `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}` : null;
}

/** wa.me wants digits with the country code; a bare 10-digit number is Indian. */
export function whatsappHref(phone?: string | null): string | null {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}`;
}

// ---- the guest form ------------------------------------------------------------------

export const SPECIAL_REQUESTS_MAX = 500;

/** "98765 43210" → "+919876543210"; "+44 7700 900123" → "+447700900123"; else null. */
export function normalizePhone(value?: string | null): string | null {
  const v = String(value || '').replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{8,14}$/.test(v)) return v.startsWith('+91') && v.length !== 13 ? null : v;
  const m = v.match(/^(?:0|91)?([6-9]\d{9})$/);
  return m ? `+91${m[1]}` : null;
}

/** A stored "+919876543210" shown as "9876543210" next to the +91 prefix. */
export function phoneForField(value?: string | null): string {
  const v = String(value || '').replace(/\s/g, '');
  return v.startsWith('+91') ? v.slice(3) : v;
}

export type GuestValues = { name: string; phone: string; email: string; arrivalTime: string; specialRequests: string };
export type GuestErrors = Partial<Record<keyof GuestValues, string>>;

export function validateGuest(values: GuestValues): GuestErrors {
  const errors: GuestErrors = {};
  if ((values.name || '').trim().length < 2) errors.name = 'Enter the name of the person checking in';
  if (!normalizePhone(values.phone)) errors.phone = 'Enter a 10-digit mobile number';
  const email = (values.email || '').trim();
  if (!email) errors.email = 'Enter your email so we can send the voucher';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "That email doesn't look right";
  if ((values.specialRequests || '').length > SPECIAL_REQUESTS_MAX) {
    errors.specialRequests = `Keep it under ${SPECIAL_REQUESTS_MAX} characters`;
  }
  return errors;
}

// ---- API errors ------------------------------------------------------------------------

/** What makeAPICall throws on a non-2xx: the parsed JSON body is on `.data`. */
export type ApiError = {
  status?: number;
  code?: string;
  message?: string;
  data?: { code?: string; message?: string; available?: number } | null;
};

export const asApiError = (e: unknown): ApiError => (e && typeof e === 'object' ? (e as ApiError) : {});

export const errorCode = (e: unknown): string | null => {
  const err = asApiError(e);
  return err.data?.code || err.code || null;
};

const isNetworkError = (e: ApiError) =>
  !e.status && /network request failed|timed out|fetch|aborted/i.test(e.message || '');

/** The server's own sentence when it sent one; a calm fallback otherwise. */
export function errorText(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = asApiError(e);
  if (isNetworkError(err)) return "Couldn't reach Prayana. Check your connection and try again.";
  return err.data?.message || fallback;
}

/** Server messages come with and without a closing full stop. */
export const asSentence = (msg?: string | null): string =>
  msg ? (/[.!?]$/.test(msg.trim()) ? msg.trim() : `${msg.trim()}.`) : '';

// ---- the unpaid hold, per selection ---------------------------------------------------
//
// Creating a booking holds the rooms for 20 minutes. Remembering its id for
// this exact selection (for as long as the app runs) means leaving the
// checkout and coming back pays for the same hold instead of taking a second
// set of rooms off sale — and the server caps how many unpaid holds one
// account may have.

export type HoldRecord = { id: string; reference?: string; payBy?: string; sig: string };

const holds = new Map<string, HoldRecord>();

const holdKey = (sel: StaySelection) =>
  [sel.slug, sel.roomTypeId, sel.checkIn, sel.checkOut, sel.units, sel.adults, sel.childrenAges.join('-')].join('|');

export const readHold = (sel: StaySelection): HoldRecord | null => holds.get(holdKey(sel)) || null;
export const saveHold = (sel: StaySelection, hold: HoldRecord) => {
  holds.set(holdKey(sel), hold);
};
export const clearHold = (sel: StaySelection) => {
  holds.delete(holdKey(sel));
};
