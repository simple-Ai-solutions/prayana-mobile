// Stays (hotels, homestays, hostels, resorts, villas) — labels, helpers and
// types for the vendor screens. Ported from the web wizard's
// components/business/stays/stayConfig.js (and its calendar/dates.js). The
// stored keys and the defaults a new draft starts from live on the server in
// server/services/stayCatalog.js — keep the lists in step.

import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepId = 'property' | 'rooms' | 'photos' | 'rules' | 'legal' | 'review';
export type Category = 'hotel' | 'home' | 'unique';
export type RoomKind = 'private' | 'dorm' | 'entire_place';

export interface RoomPrice {
  perNight: number | null;
  extraPerson: number | null;
  weekendPerNight: number | null;
}

export interface RoomType {
  _id: string;
  name: string;
  nameIsCustom: boolean;
  kind: RoomKind;
  ac: boolean;
  bedType: string;
  beds: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  bathroom: string;
  count: number;
  sizeSqft: number | null;
  features: string[];
  baseOccupancy: number;
  maxOccupancy: number;
  mealPlan: string;
  price: RoomPrice;
  isActive: boolean;
}

export interface StayLocation {
  name?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  coordinates?: { lat: number | null; lng: number | null } | null;
  placeId?: string | null;
}

export type HouseRules = Record<string, boolean | null | undefined>;

export interface Policies {
  checkInFrom?: string;
  checkInUntil?: string | null;
  checkOutBy?: string;
  flexibleCheckout24h?: boolean;
  cancellation?: string;
  childrenAllowed?: boolean;
  childFreeUnderAge?: number;
  minCheckInAge?: number;
  houseRules: HouseRules;
  notes?: string;
}

export interface GuestContact {
  phone?: string | null;
  email?: string | null;
  whatsapp?: boolean;
}

export interface LegalDraft {
  ownership: string | null;
  legalName: string;
  gstRegistered: boolean | null;
  gstin: string;
}

/** The fields the wizard edits (and autosaves with PATCH /stays/mine/:id). */
export interface StayDraft {
  propertyType: string;
  rentalMode: string;
  hostOnSite: boolean | null;
  name: string;
  description: string;
  starRating: number;
  location: StayLocation;
  google?: Record<string, unknown> | null;
  guestContact: GuestContact;
  roomTypes: RoomType[];
  amenities: string[];
  policies: Policies;
  experiences: string[];
  legal: LegalDraft;
}

export interface StayPhoto {
  _id: string;
  url: string;
  slot: string;
  roomTypeId?: string | null;
  isCover?: boolean;
  caption?: string | null;
}

export interface Licence {
  _id: string;
  type: string;
  number?: string | null;
  fileName?: string | null;
  status: string;
  reviewNote?: string | null;
}

export interface CompletenessItem {
  key: string;
  step: StepId;
  label: string;
  required: boolean;
  done: boolean;
}

export interface StepProgress {
  done: number;
  total: number;
  requiredLeft: number;
}

export interface Completeness {
  percent: number;
  canSubmit: boolean;
  items: CompletenessItem[];
  missing: CompletenessItem[];
  byStep?: Partial<Record<StepId, StepProgress>>;
}

export type ImportStatus = 'running' | 'done' | 'failed';
/** Where a running import is; "done" / "failed" once it finished. */
export type ImportStep = 'starting' | 'reading' | 'understanding' | 'photos' | 'done' | 'failed';
/** Why an import failed. BLOCKED: the site refused us, so screenshots are the way in. */
export type ImportFailCode = 'BLOCKED' | 'FETCH_FAILED' | 'NOTHING_FOUND' | 'AI_FAILED' | 'NO_AI' | 'FAILED';

/** An import from another site filling this draft (server: services/stayListingImport). */
export interface ImportJob {
  status?: ImportStatus | null;
  step?: ImportStep | null;
  /** Human text: "Reading your listing…", "Imported from Booking.com.", or why it failed. */
  message?: string | null;
  code?: ImportFailCode | null;
  /** Things to check after a done import ("1 room type needs a nightly price."). */
  warnings?: string[];
  filled?: { rooms?: number; photos?: number; amenities?: number } | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/** The listing a draft was imported from. */
export interface ListingSource {
  platform?: string | null;
  url?: string | null;
  importedAt?: string | null;
  guestRating?: { value?: number | null; outOf?: number | null; count?: number | null } | null;
}

/** A stay as GET /stays/mine/:id returns it (server-owned fields + editable ones). */
export interface Stay {
  _id: string;
  status: string;
  name?: string;
  propertyType?: string;
  category?: string;
  rentalMode?: string;
  moderation?: { reason?: string | null; approvedAt?: string | null } | null;
  photos?: StayPhoto[];
  legal?: Partial<LegalDraft> & { licences?: Licence[] };
  completeness?: Completeness;
  onboarding?: { lastStep?: string | null } | null;
  importJob?: ImportJob | null;
  source?: ListingSource | null;
  [key: string]: unknown;
}

/** A row of GET /stays/mine. */
export interface StaySummary {
  _id: string;
  name?: string;
  propertyType?: string;
  status: string;
  moderation?: { reason?: string | null; approvedAt?: string | null } | null;
  location?: { city?: string | null; state?: string | null };
  coverPhoto?: string | null;
  fromPrice?: number | null;
  totalRooms?: number;
  roomTypeCount?: number;
  photoCount?: number;
  onboarding?: { lastStep?: string | null } | null;
  completeness?: { percent?: number; canSubmit?: boolean };
  /** Only when the list sends it: an import from another site still filling this draft. */
  importJob?: { status?: ImportStatus | null; step?: ImportStep | null } | null;
}

export type DraftPatch = Partial<StayDraft> | ((d: StayDraft) => Partial<StayDraft>);

/** What every wizard step gets. */
export interface StepProps {
  draft: StayDraft;
  update: (patch: DraftPatch) => void;
  stay: Stay;
  applyServer: (data: Partial<Stay> | null | undefined) => void;
  /** Flushes pending edits; resolves false when the save failed. */
  save: (extra?: Record<string, unknown>) => Promise<boolean>;
  goTo: (id: StepId) => void;
  /** Leave the wizard on purpose (back, or replace with `to`), past the step-back guard. */
  leave: (to?: string) => void;
}

/** A file for a multipart upload (React Native FormData). */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

// ─── Property types ───────────────────────────────────────────────────────────

export const CATEGORIES: { id: Category; label: string; hint: string; icon: IconName }[] = [
  {
    id: 'hotel',
    label: 'Hotel, resort or hostel',
    hint: 'Many rooms at one place, with a front desk or someone always on site.',
    icon: 'business-outline',
  },
  {
    id: 'home',
    label: 'Home or homestay',
    hint: 'A villa, flat or cottage rented whole, or rooms in the home you live in.',
    icon: 'home-outline',
  },
  {
    id: 'unique',
    label: 'Something different',
    hint: 'Houseboats, tents, treehouses and farm stays: the stay is the experience.',
    icon: 'compass-outline',
  },
];

export const CATEGORY_GROUP_LABEL: Record<Category, string> = {
  hotel: 'Hotels, resorts & hostels',
  home: 'Homes & homestays',
  unique: 'Unique stays',
};

interface PropertyTypeInfo {
  category: Category;
  label: string;
  hint: string;
  icon: IconName;
  common?: boolean;
}

// Grouped like the picker shows them: the common ones first.
export const PROPERTY_TYPES: Record<string, PropertyTypeInfo> = {
  hotel: { category: 'hotel', label: 'Hotel', hint: 'Rooms with daily service and a front desk.', icon: 'business-outline', common: true },
  resort: { category: 'hotel', label: 'Resort', hint: 'Holiday stay with grounds, a pool or a restaurant.', icon: 'umbrella-outline', common: true },
  hostel: { category: 'hotel', label: 'Hostel', hint: 'Dorm beds and budget private rooms.', icon: 'bed-outline', common: true },
  guest_house: { category: 'hotel', label: 'Guest house / lodge', hint: 'A small, simple place with a few rooms.', icon: 'storefront-outline', common: true },
  heritage_hotel: { category: 'hotel', label: 'Heritage hotel', hint: 'A haveli, palace or old mansion.', icon: 'library-outline', common: true },
  serviced_apartment: { category: 'hotel', label: 'Serviced apartment', hint: 'Apartments with housekeeping and a front desk.', icon: 'key-outline' },
  lodge: { category: 'hotel', label: 'Jungle or mountain lodge', hint: 'Rooms close to nature, often with meals.', icon: 'trail-sign-outline' },
  bnb: { category: 'hotel', label: 'Bed & breakfast', hint: 'A few rooms with breakfast included.', icon: 'cafe-outline' },
  motel: { category: 'hotel', label: 'Highway motel', hint: 'Roadside stay for people driving through.', icon: 'car-outline' },
  capsule_hotel: { category: 'hotel', label: 'Capsule / pod hotel', hint: 'Private sleeping pods.', icon: 'cube-outline' },

  homestay: { category: 'home', label: 'Homestay', hint: 'Rooms in the home you or your family live in.', icon: 'people-outline', common: true },
  villa: { category: 'home', label: 'Villa', hint: 'A whole house, often with a garden or pool.', icon: 'sunny-outline', common: true },
  apartment: { category: 'home', label: 'Apartment / flat', hint: 'A whole flat with a kitchen.', icon: 'grid-outline', common: true },
  cottage: { category: 'home', label: 'Cottage', hint: 'A small standalone house.', icon: 'home-outline', common: true },
  bungalow: { category: 'home', label: 'Bungalow', hint: 'A single-storey house rented whole.', icon: 'albums-outline' },
  farmhouse: { category: 'home', label: 'Farmhouse', hint: 'A house on farmland, rented whole.', icon: 'flower-outline' },

  houseboat: { category: 'unique', label: 'Houseboat', hint: 'Kerala backwaters, Dal Lake and more.', icon: 'boat-outline', common: true },
  glamping: { category: 'unique', label: 'Glamping / tents', hint: 'Comfortable tents with real beds.', icon: 'bonfire-outline', common: true },
  treehouse: { category: 'unique', label: 'Treehouse', hint: 'Rooms up in the trees.', icon: 'leaf-outline', common: true },
  farm_stay: { category: 'unique', label: 'Farm stay', hint: 'Stay on a working farm or plantation.', icon: 'flower-outline', common: true },
  campsite: { category: 'unique', label: 'Campsite', hint: 'Tents or space to pitch, with shared facilities.', icon: 'bonfire-outline' },
  eco_lodge: { category: 'unique', label: 'Eco stay', hint: 'Mud houses, bamboo huts, off-grid stays.', icon: 'earth-outline' },
};

export const typesIn = (category: Category) =>
  Object.entries(PROPERTY_TYPES)
    .filter(([, t]) => t.category === category)
    .map(([id, t]) => ({ id, ...t }));

export const typeLabel = (id?: string | null) => (id && PROPERTY_TYPES[id]?.label) || 'Property';

// ─── Wizard steps ─────────────────────────────────────────────────────────────

export const STEPS: { id: StepId; label: string; short: string }[] = [
  { id: 'property', label: 'Your property', short: 'Property' },
  { id: 'rooms', label: 'Rooms & prices', short: 'Rooms' },
  { id: 'photos', label: 'Photos', short: 'Photos' },
  { id: 'rules', label: 'Amenities & rules', short: 'Rules' },
  { id: 'legal', label: 'Owner & licences', short: 'Licences' },
  { id: 'review', label: 'Review & submit', short: 'Review' },
];
export const STEP_IDS: StepId[] = STEPS.map((s) => s.id);
export const isStepId = (v: unknown): v is StepId => typeof v === 'string' && (STEP_IDS as string[]).includes(v);

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const BED_TYPES = [
  { id: 'king', label: 'King' },
  { id: 'queen', label: 'Queen' },
  { id: 'double', label: 'Double' },
  { id: 'twin', label: 'Twin (2 singles)' },
  { id: 'single', label: 'Single' },
  { id: 'bunk', label: 'Bunk' },
  { id: 'sofa_bed', label: 'Sofa-bed' },
  { id: 'mattress', label: 'Floor mattress' },
];

export const MEAL_PLANS = [
  { id: 'room_only', label: 'Room only', hint: 'No meals' },
  { id: 'breakfast', label: 'With breakfast', hint: 'Breakfast included' },
  { id: 'half_board', label: 'Breakfast + dinner', hint: 'Two meals included' },
  { id: 'full_board', label: 'All meals', hint: 'Breakfast, lunch and dinner' },
];
export const mealLabel = (id?: string | null) => MEAL_PLANS.find((m) => m.id === id)?.label || 'Room only';

export const ROOM_FEATURES = [
  { id: 'balcony', label: 'Balcony' },
  { id: 'sea_view', label: 'Sea view' },
  { id: 'mountain_view', label: 'Mountain view' },
  { id: 'lake_view', label: 'Lake view' },
  { id: 'river_view', label: 'River view' },
  { id: 'garden_view', label: 'Garden view' },
  { id: 'pool_view', label: 'Pool view' },
  { id: 'city_view', label: 'City view' },
  { id: 'kitchenette', label: 'Kitchenette' },
  { id: 'bathtub', label: 'Bathtub' },
  { id: 'private_pool', label: 'Private pool' },
  { id: 'jacuzzi', label: 'Jacuzzi' },
  { id: 'work_desk', label: 'Work desk' },
  { id: 'tv', label: 'TV' },
  { id: 'fireplace', label: 'Fireplace' },
];

/** Property types that may sell dorm beds (plus every "unique" stay). */
export const DORM_TYPES = new Set(['hostel', 'capsule_hotel', 'campsite', 'glamping', 'eco_lodge', 'guest_house', 'lodge']);

/** How many guests one bed of this type sleeps (for the "is that a lot?" warning). */
export const BED_CAPACITY: Record<string, number> = { king: 2, queen: 2, double: 2, twin: 2, single: 1, bunk: 2, sofa_bed: 2, mattress: 1 };

const BED_SHORT: Record<string, string> = {
  king: 'King', queen: 'Queen', double: 'Double', twin: 'Twin', single: 'Single', bunk: 'Bunk', sofa_bed: 'Sofa-bed', mattress: 'Mattress',
};
const FEATURE_NAME: Record<string, string> = {
  balcony: 'with Balcony', sea_view: 'Sea View', mountain_view: 'Mountain View', lake_view: 'Lake View',
  river_view: 'River View', garden_view: 'Garden View', pool_view: 'Pool View', city_view: 'City View',
  private_pool: 'with Private Pool', jacuzzi: 'with Jacuzzi',
};

/** Same rules as stayCatalog.roomTypeName on the server. */
export function roomTypeName(rt: Partial<RoomType> = {}): string {
  if (rt.kind === 'entire_place') {
    const bedrooms = Number(rt.bedrooms) || 1;
    return bedrooms === 1 ? 'Entire place · 1 bedroom' : `Entire place · ${bedrooms} bedrooms`;
  }
  if (rt.kind === 'dorm') {
    const beds = Number(rt.beds) || 0;
    return [beds ? `${beds}-Bed` : null, rt.ac === false ? 'Non-AC' : null, 'Dorm'].filter(Boolean).join(' ');
  }
  const features = rt.features || [];
  const view = features.find((f) => FEATURE_NAME[f] && !FEATURE_NAME[f].startsWith('with'));
  const extra = features.find((f) => FEATURE_NAME[f]?.startsWith('with'));
  return [
    rt.ac === false ? 'Non-AC' : 'AC',
    BED_SHORT[rt.bedType || ''] || 'Double',
    'Room',
    view ? `· ${FEATURE_NAME[view]}` : null,
    extra ? FEATURE_NAME[extra] : null,
  ]
    .filter(Boolean)
    .join(' ');
}

// A Mongo ObjectId made on the phone, so a new room type has its id before the
// first save (its photos point at it). 4-byte timestamp + 5 random bytes + a
// 3-byte counter, like the real thing; the server keeps ids it's sent.
let idCounter = Math.floor(Math.random() * 0xffffff);
const hex = (n: number, len: number) => n.toString(16).padStart(len, '0').slice(-len);
export function newObjectId(): string {
  const ts = Math.floor(Date.now() / 1000);
  let rand = '';
  for (let i = 0; i < 5; i++) rand += hex(Math.floor(Math.random() * 256), 2);
  idCounter = (idCounter + 1) % 0xffffff;
  return hex(ts, 8) + rand + hex(idCounter, 6);
}

export function newRoomType(kind: RoomKind = 'private'): RoomType {
  const base: Partial<RoomType> =
    kind === 'dorm'
      ? { kind, ac: true, bedType: 'bunk', beds: 6, bathroom: 'shared', baseOccupancy: 1, maxOccupancy: 1 }
      : kind === 'entire_place'
        ? { kind, ac: true, bedType: 'double', beds: 2, bedrooms: 2, bathrooms: 2, bathroom: 'attached', baseOccupancy: 4, maxOccupancy: 6 }
        : { kind, ac: true, bedType: 'double', beds: 1, bathroom: 'attached', baseOccupancy: 2, maxOccupancy: 3 };
  const rt: RoomType = {
    _id: newObjectId(),
    name: '',
    nameIsCustom: false,
    kind,
    ac: true,
    bedType: 'double',
    beds: 1,
    bathroom: 'attached',
    count: 1,
    sizeSqft: null,
    features: [],
    baseOccupancy: 2,
    maxOccupancy: 3,
    mealPlan: 'room_only',
    price: { perNight: null, extraPerson: null, weekendPerNight: null },
    isActive: true,
    ...base,
  };
  return { ...rt, name: roomTypeName(rt) };
}

/** A room type from the tariff-card import, ready for the wizard (with a fresh id). */
export function roomFromImport(r: Record<string, any>): RoomType {
  const kind: RoomKind = r?.kind === 'dorm' ? 'dorm' : 'private';
  const base = newRoomType(kind);
  const num = (v: unknown, fallback: number) => (Number(v) > 0 ? Math.round(Number(v)) : fallback);
  const money = (v: unknown) => (Number(v) > 0 ? Math.round(Number(v)) : null);
  const rt: RoomType = {
    ...base,
    ac: r?.ac !== false,
    bedType: BED_TYPES.some((b) => b.id === r?.bedType) ? r.bedType : base.bedType,
    beds: num(r?.beds, base.beds),
    bathroom: r?.bathroom === 'shared' ? 'shared' : r?.bathroom === 'attached' ? 'attached' : base.bathroom,
    count: num(r?.count, 1),
    baseOccupancy: num(r?.baseOccupancy, base.baseOccupancy),
    maxOccupancy: num(r?.maxOccupancy, base.maxOccupancy),
    mealPlan: MEAL_PLANS.some((m) => m.id === r?.mealPlan) ? r.mealPlan : 'room_only',
    features: Array.isArray(r?.features) ? r.features.filter((f: string) => ROOM_FEATURES.some((x) => x.id === f)) : [],
    price: {
      perNight: money(r?.price?.perNight),
      extraPerson: r?.price?.extraPerson == null ? null : Math.max(0, Math.round(Number(r.price.extraPerson)) || 0),
      weekendPerNight: money(r?.price?.weekendPerNight),
    },
    isActive: true,
  };
  if (rt.baseOccupancy > rt.maxOccupancy) rt.maxOccupancy = rt.baseOccupancy;
  const custom = typeof r?.name === 'string' && r.name.trim() && r?.nameIsCustom !== false;
  return custom ? { ...rt, name: r.name.trim().slice(0, 80), nameIsCustom: true } : { ...rt, name: roomTypeName(rt), nameIsCustom: false };
}

/** Gentle "check this" notes for a room type (never block saving). */
export function roomWarnings(rt: RoomType): string[] {
  const w: string[] = [];
  const price = Number(rt.price?.perNight) || 0;
  const max = Number(rt.maxOccupancy) || 0;
  if (rt.kind === 'private') {
    const fits = (BED_CAPACITY[rt.bedType] || 2) * (Number(rt.beds) || 1);
    if (max > fits + 1) {
      w.push(`${max} guests is a lot for ${rt.beds > 1 ? `${rt.beds} beds` : 'one bed'}. Add beds, or make sure the extra-bed charge covers it.`);
    }
  }
  if (rt.kind === 'entire_place') {
    const bedrooms = Number(rt.bedrooms) || 1;
    if (max > bedrooms * 4) w.push(`${max} guests in ${bedrooms} bedroom${bedrooms > 1 ? 's' : ''}? Check the numbers.`);
  }
  const size = Number(rt.sizeSqft) || 0;
  if (size && max && rt.kind !== 'dorm' && size / max < 35) w.push(`${size} sq ft is small for ${max} guests. Is the size right?`);
  if (price && price < 300) w.push('That price looks low. Is it per night?');
  if (rt.kind === 'dorm' && price > 5000) w.push('Dorm prices are per bed. Is this the price of one bed?');
  if (price > 100000) w.push('Please check the price.');
  return w;
}

export const sqftToSqm = (sqft?: number | null) => (sqft ? Math.round(Number(sqft) * 0.092903) : null);

// ─── Amenities, rules, policies ───────────────────────────────────────────────

export const AMENITIES = [
  { id: 'wifi', label: 'Free Wi-Fi', popular: true },
  { id: 'parking', label: 'Parking', popular: true },
  { id: 'ac', label: 'Air conditioning', popular: true },
  { id: 'power_backup', label: 'Power backup', popular: true },
  { id: 'hot_water', label: '24-hour hot water', popular: true },
  { id: 'front_desk_24h', label: '24-hour front desk', popular: true },
  { id: 'restaurant', label: 'Restaurant', popular: true },
  { id: 'room_service', label: 'Room service', popular: true },
  { id: 'pool', label: 'Swimming pool', popular: true },
  { id: 'lift', label: 'Lift', popular: true },
  { id: 'housekeeping', label: 'Daily housekeeping', popular: true },
  { id: 'breakfast_available', label: 'Breakfast available', popular: true },
  { id: 'airport_transfer', label: 'Airport / station pickup' },
  { id: 'gym', label: 'Gym' },
  { id: 'spa', label: 'Spa / massage' },
  { id: 'kitchen', label: 'Kitchen guests can use' },
  { id: 'laundry', label: 'Laundry' },
  { id: 'tv', label: 'TV' },
  { id: 'garden', label: 'Garden / lawn' },
  { id: 'bonfire', label: 'Bonfire' },
  { id: 'kids_play_area', label: "Kids' play area" },
  { id: 'wheelchair_access', label: 'Wheelchair accessible' },
  { id: 'cctv', label: 'CCTV in common areas' },
  { id: 'first_aid', label: 'First aid' },
  { id: 'ev_charging', label: 'EV charging' },
  { id: 'lockers', label: 'Lockers' },
  { id: 'common_area', label: 'Common lounge' },
  { id: 'workspace', label: 'Workspace / co-working' },
  { id: 'bar', label: 'Bar' },
  { id: 'conference_hall', label: 'Conference / banquet hall' },
  { id: 'doctor_on_call', label: 'Doctor on call' },
  { id: 'travel_desk', label: 'Tour & travel desk' },
  { id: 'bike_rental', label: 'Bike / scooter rental' },
  { id: 'home_cooked_meals', label: 'Home-cooked meals' },
  { id: 'pure_veg', label: 'Pure-veg kitchen' },
  { id: 'jain_food', label: 'Jain food on request' },
  { id: 'terrace', label: 'Terrace / rooftop' },
  { id: 'games_room', label: 'Games room' },
];

export const HOUSE_RULES = [
  { id: 'coupleFriendly', label: 'Unmarried couples welcome', hint: 'Guests search for "couple-friendly".' },
  { id: 'localIdAccepted', label: 'Local ID accepted', hint: 'Guests from the same city can check in.' },
  { id: 'foreignersAccepted', label: 'Foreign guests welcome', hint: "You'll need to file Form C for them." },
  { id: 'petsAllowed', label: 'Pets allowed' },
  { id: 'smokingAllowed', label: 'Smoking allowed in rooms' },
  { id: 'alcoholAllowed', label: 'Alcohol allowed' },
  { id: 'outsideFoodAllowed', label: 'Outside food allowed' },
  { id: 'partiesAllowed', label: 'Parties or events allowed' },
];

export const CANCELLATION_POLICIES = [
  { id: 'free_1d', label: 'Free cancellation until 1 day before', hint: 'Most popular with guests. Later than that, the guest pays the full amount.', popular: true },
  { id: 'free_3d', label: 'Free cancellation until 3 days before', hint: 'Later than that, the guest pays the full amount.' },
  { id: 'free_7d', label: 'Free cancellation until 7 days before', hint: 'Common for villas and peak season. Later than that, the guest pays the full amount.' },
  { id: 'non_refundable', label: 'Non-refundable', hint: 'No refund if the guest cancels. Fewer guests book these.' },
];

export const EXPERIENCE_SUGGESTIONS = [
  'Bonfire', 'Guided trek', 'Cooking class', 'Jeep safari', 'Bird watching', 'Village walk',
  'Plantation tour', 'Yoga session', 'Cycling', 'Kayaking', 'Stargazing', 'Fishing',
];
export const MAX_EXPERIENCES = 12;

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? '30' : '00';
  const value = `${String(h).padStart(2, '0')}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value, label: `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}` };
});
export const timeLabel = (v?: string | null) => TIME_OPTIONS.find((t) => t.value === v)?.label || v || '';

// ─── Photos ───────────────────────────────────────────────────────────────────

export const PROPERTY_PHOTO_SLOTS = [
  { id: 'exterior', label: 'Outside / building', hint: 'The front of the property in daylight.' },
  { id: 'reception', label: 'Entrance or reception', hint: 'Where guests arrive.' },
  { id: 'common', label: 'Common areas', hint: 'Lobby, lounge, garden, terrace.' },
  { id: 'view', label: 'The view', hint: 'What guests see from the property.' },
  { id: 'dining', label: 'Dining or kitchen', hint: 'Restaurant, dining room or kitchen.' },
  { id: 'pool', label: 'Pool or activities', hint: 'Pool, play area, bonfire spot.' },
];
export const ROOM_PHOTO_SLOTS = [
  { id: 'room', label: 'Room', hint: 'Shoot from the door, lights on, bed made.' },
  { id: 'bathroom', label: 'Bathroom', hint: 'Clean, dry and well lit.' },
];
export const MIN_PROPERTY_PHOTOS = 3;
export const MIN_PHOTO_WIDTH = 800;
export const MIN_PHOTO_HEIGHT = 600;
export const MAX_PHOTOS_PER_UPLOAD = 10;

// ─── Owner & licences ─────────────────────────────────────────────────────────

export const OWNERSHIP_TYPES = [
  { id: 'own', label: 'I own it', hint: 'You or your company own the property.' },
  { id: 'lease', label: "I've leased it", hint: 'You rent the property and run it.' },
  { id: 'manage', label: 'I manage it for the owner', hint: "You're a property manager." },
];

export const LICENCE_TYPES = [
  { id: 'trade_licence', label: 'Trade licence', hint: 'From your municipality / panchayat.', proof: true },
  { id: 'homestay_registration', label: 'Homestay / B&B registration', hint: 'From your state tourism department.', proof: true },
  { id: 'tourism_registration', label: 'Hotel / tourism registration', hint: 'State tourism or Ministry of Tourism.', proof: true },
  { id: 'property_proof', label: 'Property tax receipt or electricity bill', hint: "If you don't have a licence yet.", proof: true },
  { id: 'fire_noc', label: 'Fire safety NOC' },
  { id: 'fssai', label: 'FSSAI food licence', hint: 'If you serve food.' },
  { id: 'police_noc', label: 'Police verification / NOC' },
  { id: 'pollution_noc', label: 'Pollution control consent' },
  { id: 'other', label: 'Other document' },
];
export const MAX_LICENCE_BYTES = 10 * 1024 * 1024;

// States and union territories with their GST state code (first two digits of
// a GSTIN). A GSTIN is per state, so a property needs one from its own state.
export const INDIAN_STATES = [
  ['Andaman and Nicobar Islands', '35'], ['Andhra Pradesh', '37'], ['Arunachal Pradesh', '12'],
  ['Assam', '18'], ['Bihar', '10'], ['Chandigarh', '04'], ['Chhattisgarh', '22'],
  ['Dadra and Nagar Haveli and Daman and Diu', '26'], ['Delhi', '07'], ['Goa', '30'],
  ['Gujarat', '24'], ['Haryana', '06'], ['Himachal Pradesh', '02'], ['Jammu and Kashmir', '01'],
  ['Jharkhand', '20'], ['Karnataka', '29'], ['Kerala', '32'], ['Ladakh', '38'],
  ['Lakshadweep', '31'], ['Madhya Pradesh', '23'], ['Maharashtra', '27'], ['Manipur', '14'],
  ['Meghalaya', '17'], ['Mizoram', '15'], ['Nagaland', '13'], ['Odisha', '21'],
  ['Puducherry', '34'], ['Punjab', '03'], ['Rajasthan', '08'], ['Sikkim', '11'],
  ['Tamil Nadu', '33'], ['Telangana', '36'], ['Tripura', '16'], ['Uttar Pradesh', '09'],
  ['Uttarakhand', '05'], ['West Bengal', '19'],
].map(([name, gstCode]) => ({ name, gstCode }));

const norm = (s?: string | null) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
export const stateByName = (name?: string | null) => INDIAN_STATES.find((s) => norm(s.name) === norm(name)) || null;
export const stateByGstin = (gstin?: string | null) => INDIAN_STATES.find((s) => s.gstCode === String(gstin || '').slice(0, 2)) || null;

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// ─── Listing status (venue/program review model) ──────────────────────────────

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'default' },
  pending_review: { label: 'In review', variant: 'warning' },
  changes_requested: { label: 'Changes requested', variant: 'error' },
  published: { label: 'Live', variant: 'success' },
  suspended: { label: 'Taken down', variant: 'error' },
  archived: { label: 'Archived', variant: 'default' },
};

export function statusInfo(status?: string | null) {
  return STATUS[status || 'draft'] || { label: String(status || 'draft').replace(/_/g, ' '), variant: 'default' as BadgeVariant };
}

/** Live now, or approved before (so it has a calendar, bookings and reviews to run). */
export const hasOperations = (s?: { status?: string; moderation?: { approvedAt?: string | null } | null } | null) =>
  !!s && (s.status === 'published' || !!s.moderation?.approvedAt);

/** One line saying what the status means and, when we sent it back, why. */
export function statusMessage(s: { status?: string; moderation?: { reason?: string | null; approvedAt?: string | null } | null }) {
  const reason = s?.moderation?.reason;
  switch (s?.status) {
    case 'changes_requested':
      return { tone: 'red' as const, text: `Changes requested: ${reason || 'see the email we sent you'}` };
    case 'suspended':
      return { tone: 'red' as const, text: `Taken down: ${reason || 'see the email we sent you'}` };
    case 'pending_review':
      return { tone: 'amber' as const, text: "In review — guests can book it once we approve it. We'll email you." };
    case 'published':
      return { tone: 'green' as const, text: 'Live — changes you save go live right away.' };
    case 'draft':
      return s?.moderation?.approvedAt
        ? { tone: 'gray' as const, text: 'Unpublished. You can publish it again at any time.' }
        : { tone: 'gray' as const, text: "Not live yet. Submit it for review when it's ready." };
    default:
      return null;
  }
}

/** The vendor's next step, if any: submit for review, or republish one we approved before. */
export function submitAction(s: Stay): { label: string } | null {
  const approvedBefore = !!s?.moderation?.approvedAt;
  if ((s.status === 'draft' || s.status === 'archived') && approvedBefore) return { label: 'Publish again' };
  if (['draft', 'archived', 'changes_requested', 'suspended'].includes(s.status)) {
    return { label: s.status === 'draft' || s.status === 'archived' ? 'Submit for review' : 'Resubmit for review' };
  }
  return null;
}

// ─── Draft ────────────────────────────────────────────────────────────────────

const clone = <T,>(v: T): T => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));

/** The editable fields of a stay, with safe defaults for anything missing. */
export function draftFrom(stay: Stay): StayDraft {
  const s = stay as Record<string, any>;
  const l = stay.legal || {};
  return {
    propertyType: s.propertyType || 'hotel',
    rentalMode: s.rentalMode || 'rooms',
    hostOnSite: s.hostOnSite ?? null,
    name: s.name || '',
    description: s.description || '',
    starRating: Number(s.starRating) || 0,
    location: clone(s.location) || {},
    google: clone(s.google) || null,
    guestContact: clone(s.guestContact) || {},
    roomTypes: (clone(s.roomTypes) || []).map((r: RoomType) => ({
      ...r,
      _id: String(r._id),
      features: r.features || [],
      price: {
        perNight: r.price?.perNight ?? null,
        extraPerson: r.price?.extraPerson ?? null,
        weekendPerNight: r.price?.weekendPerNight ?? null,
      },
    })),
    amenities: clone(s.amenities) || [],
    policies: { ...(clone(s.policies) || {}), houseRules: { ...(s.policies?.houseRules || {}) } },
    experiences: clone(s.experiences) || [],
    legal: {
      ownership: l.ownership || null,
      legalName: l.legalName || '',
      gstRegistered: l.gstRegistered ?? null,
      gstin: l.gstin || '',
    },
  };
}

/** The step a wizard opens on: where a draft left off, Review for anything submitted. */
export function initialStep(stay: Stay): StepId {
  if (stay.status !== 'draft') return 'review';
  const last = stay.onboarding?.lastStep;
  return isStepId(last) ? last : 'property';
}

// ─── Money, plurals, errors ───────────────────────────────────────────────────

export const rupees = (n?: number | null) =>
  n == null || Number.isNaN(Number(n)) ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a calendar unit is called for this room type: a dorm sells beds. */
export const unitNoun = (rt?: { kind?: string } | null) => (rt?.kind === 'dorm' ? 'bed' : rt?.kind === 'entire_place' ? 'unit' : 'room');

/** The server's own message from a failed call (makeAPICall puts it on error.message / error.data). */
export function apiError(e: unknown, fallback: string): string {
  const err = e as { name?: string; message?: string; data?: { message?: string } } | null;
  if (err?.name === 'AbortError') return 'That took too long. Check your connection and try again.';
  const msg = err?.data?.message || err?.message;
  if (!msg || /^HTTP error!/.test(msg) || /Network request failed/i.test(msg)) {
    return /Network request failed/i.test(String(msg)) ? 'No connection. Check your internet and try again.' : fallback;
  }
  if (/timed out/i.test(msg)) return 'That took too long. Check your connection and try again.';
  return msg;
}

/** wa.me wants the number with country code and no symbols; Indian numbers are often saved without +91. */
export function whatsappUrl(phone: string, text: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits.length === 11 && digits.startsWith('0') ? `91${digits.slice(1)}` : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** A picked file as FormData wants it: a real extension and a matching MIME type. */
export function toUploadFile(asset: { uri: string; fileName?: string | null; name?: string | null; mimeType?: string | null }, fallbackName: string): UploadFile {
  const fromUri = asset.uri.split('?')[0].split('/').pop() || '';
  const uriExt = (fromUri.includes('.') ? fromUri.split('.').pop() : '')?.toLowerCase() || '';
  const given = asset.fileName || asset.name || fromUri || fallbackName;
  const MIME: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heic', pdf: 'application/pdf',
  };
  // The file on disk wins: iOS re-encodes HEIC picks to JPEG but can keep the old name.
  const type = (uriExt && MIME[uriExt]) || asset.mimeType || MIME[(given.split('.').pop() || '').toLowerCase()] || 'image/jpeg';
  const ext = Object.entries(MIME).find(([, m]) => m === type)?.[0] || 'jpg';
  const baseName = given.includes('.') ? given.slice(0, given.lastIndexOf('.')) : given;
  return { uri: asset.uri, name: `${baseName || 'file'}.${ext === 'jpeg' ? 'jpg' : ext}`, type };
}

// ─── Dates ("YYYY-MM-DD" strings in India time) ───────────────────────────────
// Plain calendar math on the strings (in UTC, where a day is always 24 hours),
// formatted by hand so a device time zone or Intl quirk never shifts a date.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export function addDays(ymd: string, n: number): string {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Whole days from a to b (b later → positive). */
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
/** Today in India, whatever the phone's own time zone is. */
export const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
/** "Sat, 14 Nov" */
export const dayLabel = (ymd?: string | null) => {
  if (!ymd) return '';
  const d = toDate(ymd);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
/** "14 Nov 2026" */
export const longDate = (ymd?: string | null) => {
  if (!ymd) return '';
  const d = toDate(ymd);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const weekdayShort = (ymd: string) => WEEKDAYS[toDate(ymd).getUTCDay()];
export const dayOfMonth = (ymd: string) => toDate(ymd).getUTCDate();
/** "November 2026" */
export const monthLong = (ymd: string) => {
  const d = toDate(ymd);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** "12 Oct – 22 Nov 2026" */
export function rangeLabel(from?: string | null, to?: string | null) {
  if (!from || !to) return '';
  const f = toDate(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${f.getUTCDate()} ${MONTHS[f.getUTCMonth()]}${sameYear ? '' : ` ${f.getUTCFullYear()}`} – ${longDate(to)}`;
}
/** A timestamp (ISO) as "12 Oct, 3:00 pm" in India time. */
export function whenLabel(iso?: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 330 * 60000);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

// Expo Router treats every file under app/ as a route; a default export keeps
// this helper module from warning about a missing one.
export default { roomTypeName, newObjectId };
