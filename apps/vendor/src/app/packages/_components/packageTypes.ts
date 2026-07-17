// Shared contract for the holiday-package wizard (ported from the web partner
// portal's PackageWizard). This file is the single source of truth for the form
// shape, the API payload builder, and the edit-hydration mapper. Every step
// component imports its slice of `PackageFormValues` from here, and the wizard
// shell composes them — so the pieces stay decoupled and independently buildable.
//
// The web wizard sends the ENTIRE formData object to createPackage/updatePackage
// (the body carries itinerary[], variants[], departures[], and base64 images[]),
// so buildPackagePayload is mostly a faithful pass-through with a couple of
// derived fields (duration, primaryDestination). Field names match the web
// payload exactly — do not rename without checking the backend contract.

// ─── Sub-object schemas ─────────────────────────────────────────────────────

export interface Destination {
  name: string;
  city: string;
  state: string;
  country: string; // default 'India'
  nightsHere: number;
  order: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'full_day';

export interface ItineraryActivity {
  title: string;
  description: string;
  duration: { value: number; unit: 'hours' };
  timeOfDay: TimeOfDay;
  isIncluded: boolean;
  isOptional: boolean;
  isSwappable: boolean;
  estimatedCost: number;
}

export interface MealSlot {
  included: boolean;
  venue?: string;
  type?: 'buffet' | 'set_menu' | 'a_la_carte' | null;
}

export interface ItineraryMeals {
  breakfast: MealSlot;
  lunch: MealSlot;
  dinner: MealSlot;
}

export interface ItineraryAccommodation {
  hotelName?: string;
  hotelCategory?: 'budget' | 'standard' | 'premium' | 'luxury';
  roomType?: string;
  checkIn?: boolean;
  checkOut?: boolean;
}

export interface ItineraryTransport {
  mode?: 'car' | 'bus' | 'train' | 'flight' | 'ferry' | 'self';
  fromLocation?: string;
  toLocation?: string;
  description?: string;
  estimatedDuration?: string;
  isIncluded?: boolean;
}

export interface ItineraryDay {
  dayNumber: number; // 1..N, contiguous
  title: string;
  description: string;
  destination: string;
  activities: ItineraryActivity[];
  meals: ItineraryMeals;
  accommodation: ItineraryAccommodation;
  transport: ItineraryTransport;
  notes: string;
}

export type HotelCategory = 'budget' | 'standard' | 'premium' | 'luxury';
export type MealPlan = 'EP' | 'CP' | 'MAP' | 'AP';

export interface VariantPricing {
  basePrice: number;
  childPrice: number | null; // null ⇒ auto 70% of base
  singleOccupancySupplement: number;
  priceType: 'per_person' | 'per_group';
  currency: 'INR';
}

export interface PackageVariant {
  name: 'Budget' | 'Standard' | 'Luxury' | 'Premium' | 'Custom';
  displayName: string;
  description: string;
  highlights: string[];
  pricing: VariantPricing;
  hotelCategory: HotelCategory;
  hotelName: string;
  mealPlan: MealPlan;
  transportType: string;
  roomType: string;
  inclusions: string[];
  exclusions: string[];
  maxGroupSize: number;
  minGroupSize: number;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface GroupDiscount {
  minPeople: number;
  maxPeople: number;
  discountPercent: number;
}

export interface EarlyBirdDiscount {
  enabled: boolean;
  daysBeforeTravel: number;
  discountPercent: number;
}

export interface SeasonalPricing {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  priceModifier: number; // multiplier, e.g. 1.2
  isActive: boolean;
}

export interface DateOverride {
  date: string;
  price: number;
  reason?: string;
}

export interface BlackoutDate {
  startDate: string;
  endDate: string;
  reason: string;
}

export interface PackagePricingRules {
  seasonalPricing: SeasonalPricing[];
  dateOverrides: DateOverride[];
  blackoutDates: BlackoutDate[];
  groupDiscounts: GroupDiscount[];
  earlyBirdDiscount: EarlyBirdDiscount;
}

export interface CancellationRule {
  daysBeforeTravel: number;
  refundPercent: number;
}

export interface CancellationPolicy {
  type: 'flexible' | 'moderate' | 'strict' | 'non_refundable';
  rules: CancellationRule[];
}

export interface VendorStory {
  headline: string;
  narrative: string;
  localInsights: string[];
}

export interface PackageImage {
  url: string; // https URL or base64 data URL
  caption: string;
  isPrimary: boolean;
  order: number;
  _isFile?: boolean; // local pick flagged for upload/serialization
}

export type DepartureStatus = 'open' | 'filling_fast' | 'sold_out' | 'cancelled';

export interface Departure {
  startDate: string; // YYYY-MM-DD
  endDate: string; // auto-computed = startDate + nights
  availableSlots: number;
  bookedSlots: number;
  status: DepartureStatus;
}

export interface PackageAvailability {
  availableFrom: string;
  availableTo: string;
  advanceBookingDays: number;
  maxBookingsPerDay: number;
}

export interface PackageSEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

// ─── Master form values ─────────────────────────────────────────────────────

export interface PackageFormValues {
  title: string;
  description: string;
  shortDescription: string;
  packageType: 'fixed' | 'customizable' | 'dynamic';
  category: string[];
  tags: string[];
  difficulty: 'easy' | 'moderate' | 'challenging';
  nights: number; // days derived = nights + 1
  destinations: Destination[];
  startPoint: string;
  endPoint: string;
  itinerary: ItineraryDay[];
  variants: PackageVariant[];
  pricing: PackagePricingRules;
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: CancellationPolicy;
  vendorStory: VendorStory;
  images: PackageImage[];
  departures: Departure[];
  availability: PackageAvailability;
  seo: PackageSEO;
  // Any loaded fields we don't map onto the form are preserved and re-spread on save.
  legacy: Record<string, any>;
}

// Shared prop contract every wizard sub-step receives.
export interface StepProps {
  values: PackageFormValues;
  onChange: (updates: Partial<PackageFormValues>) => void;
}

// ─── Factories / defaults ───────────────────────────────────────────────────

export function makeDefaultVariant(): PackageVariant {
  return {
    name: 'Standard',
    displayName: 'Standard Package',
    description: '',
    highlights: [],
    pricing: {
      basePrice: 0,
      childPrice: null,
      singleOccupancySupplement: 0,
      priceType: 'per_person',
      currency: 'INR',
    },
    hotelCategory: 'standard',
    mealPlan: 'MAP',
    hotelName: '',
    transportType: 'Private sedan',
    roomType: '',
    inclusions: [],
    exclusions: [],
    maxGroupSize: 20,
    minGroupSize: 1,
    isDefault: true,
    isActive: true,
    displayOrder: 0,
  };
}

export function makeEmptyMeals(): ItineraryMeals {
  return {
    breakfast: { included: false },
    lunch: { included: false },
    dinner: { included: false },
  };
}

export const EMPTY_PACKAGE: PackageFormValues = {
  title: '',
  description: '',
  shortDescription: '',
  packageType: 'fixed',
  category: [],
  tags: [],
  difficulty: 'easy',
  nights: 2,
  destinations: [
    { name: '', city: '', state: '', country: 'India', nightsHere: 1, order: 0 },
  ],
  startPoint: '',
  endPoint: '',
  itinerary: [],
  variants: [makeDefaultVariant()],
  pricing: {
    seasonalPricing: [],
    dateOverrides: [],
    blackoutDates: [],
    groupDiscounts: [],
    earlyBirdDiscount: { enabled: false, daysBeforeTravel: 30, discountPercent: 10 },
  },
  inclusions: [],
  exclusions: [],
  cancellationPolicy: { type: 'moderate', rules: [] },
  vendorStory: { headline: '', narrative: '', localInsights: [] },
  images: [],
  departures: [],
  availability: {
    availableFrom: '',
    availableTo: '',
    advanceBookingDays: 7,
    maxBookingsPerDay: 10,
  },
  seo: { metaTitle: '', metaDescription: '', keywords: [] },
  legacy: {},
};

// ─── Payload builder (form → API body) ──────────────────────────────────────

export function buildPackagePayload(v: PackageFormValues): Record<string, any> {
  const nights = Math.max(1, parseInt(String(v.nights), 10) || 1);
  const primaryDestination =
    v.destinations.find((d) => d.city || d.name)?.city ||
    v.destinations.find((d) => d.city || d.name)?.name ||
    '';

  return {
    // Unmapped loaded fields ride back untouched; mapped keys below win.
    ...v.legacy,
    title: v.title.trim(),
    description: v.description.trim(),
    shortDescription: v.shortDescription.trim(),
    packageType: v.packageType,
    category: v.category,
    tags: v.tags,
    difficulty: v.difficulty,
    duration: { nights, days: nights + 1 },
    primaryDestination,
    destinations: v.destinations
      .filter((d) => d.name || d.city)
      .map((d, i) => ({
        name: d.name || d.city,
        city: d.city || d.name,
        state: d.state || '',
        country: d.country || 'India',
        nightsHere: Math.max(0, parseInt(String(d.nightsHere), 10) || 0),
        order: i,
      })),
    startPoint: v.startPoint,
    endPoint: v.endPoint,
    itinerary: v.itinerary.map((day, i) => ({ ...day, dayNumber: i + 1 })),
    variants: v.variants.map((variant, i) => ({
      ...variant,
      displayOrder: i,
      pricing: {
        ...variant.pricing,
        basePrice: parseFloat(String(variant.pricing.basePrice)) || 0,
        childPrice:
          variant.pricing.childPrice == null
            ? null
            : parseFloat(String(variant.pricing.childPrice)) || 0,
        singleOccupancySupplement:
          parseFloat(String(variant.pricing.singleOccupancySupplement)) || 0,
        currency: 'INR',
      },
    })),
    pricing: v.pricing,
    inclusions: v.inclusions,
    exclusions: v.exclusions,
    cancellationPolicy: v.cancellationPolicy,
    vendorStory: v.vendorStory,
    images: v.images.map((img, i) => ({
      url: img.url,
      caption: img.caption || '',
      isPrimary: img.isPrimary,
      order: i,
    })),
    departures:
      v.packageType === 'fixed'
        ? v.departures.map((d) => ({
            startDate: d.startDate,
            endDate: d.endDate,
            availableSlots: Math.max(1, parseInt(String(d.availableSlots), 10) || 1),
            bookedSlots: Math.max(0, parseInt(String(d.bookedSlots), 10) || 0),
            status: d.status,
          }))
        : [],
    availability: v.packageType === 'fixed' ? {} : v.availability,
    seo: v.seo,
  };
}

// ─── Edit hydration (API object → form) ─────────────────────────────────────
// Defensive against BOTH shapes: the rich shape this wizard writes, and the
// legacy flat shape the old 4-step vendor form saved (single variant, no
// itinerary/departures/media). Nothing is dropped: fields we don't map are
// stashed in `legacy` and re-spread by buildPackagePayload on the next save.

const MAPPED_TOP_KEYS = new Set([
  'title', 'description', 'shortDescription', 'packageType', 'category', 'tags',
  'difficulty', 'duration', 'primaryDestination', 'destinations', 'startPoint',
  'endPoint', 'itinerary', 'variants', 'pricing', 'inclusions', 'exclusions',
  'cancellationPolicy', 'vendorStory', 'images', 'departures', 'availability', 'seo',
]);

export function packageToFormValues(pkg: any): PackageFormValues {
  const base = EMPTY_PACKAGE;

  const category: string[] = Array.isArray(pkg?.category)
    ? pkg.category
    : pkg?.category
    ? [pkg.category]
    : [];

  const nights =
    pkg?.duration?.nights ??
    (typeof pkg?.duration === 'number' ? pkg.duration : undefined) ??
    base.nights;

  const destinations: Destination[] =
    Array.isArray(pkg?.destinations) && pkg.destinations.length > 0
      ? pkg.destinations.map((d: any, i: number) => ({
          name: d?.name || d?.city || '',
          city: d?.city || d?.name || '',
          state: d?.state || '',
          country: d?.country || 'India',
          nightsHere: d?.nightsHere ?? 1,
          order: d?.order ?? i,
        }))
      : base.destinations;

  const variants: PackageVariant[] =
    Array.isArray(pkg?.variants) && pkg.variants.length > 0
      ? pkg.variants.map((raw: any, i: number) => {
          const d = makeDefaultVariant();
          const p = raw?.pricing || {};
          return {
            ...d,
            name: raw?.name || d.name,
            displayName: raw?.displayName || `${raw?.name || d.name} Package`,
            description: raw?.description || '',
            highlights: raw?.highlights || [],
            pricing: {
              basePrice: p.basePrice ?? raw?.basePrice ?? 0,
              childPrice: p.childPrice ?? null,
              singleOccupancySupplement: p.singleOccupancySupplement ?? 0,
              priceType: p.priceType || raw?.priceType || 'per_person',
              currency: 'INR',
            },
            hotelCategory: raw?.hotelCategory || d.hotelCategory,
            hotelName: raw?.hotelName || '',
            mealPlan: raw?.mealPlan || d.mealPlan,
            transportType: raw?.transportType || '',
            roomType: raw?.roomType || '',
            inclusions: raw?.inclusions || [],
            exclusions: raw?.exclusions || [],
            maxGroupSize: raw?.maxGroupSize ?? d.maxGroupSize,
            minGroupSize: raw?.minGroupSize ?? d.minGroupSize,
            isDefault: raw?.isDefault ?? i === 0,
            isActive: raw?.isActive ?? true,
            displayOrder: raw?.displayOrder ?? i,
          };
        })
      : base.variants;

  // Legacy flat pricing (old form stored basePrice/priceType/mealPlan/hotelCategory
  // at pricing root). Fold into the first variant if no variants[] came back.
  if (
    (!Array.isArray(pkg?.variants) || pkg.variants.length === 0) &&
    pkg?.pricing &&
    (pkg.pricing.basePrice != null || pkg.pricing.adultPrice != null)
  ) {
    variants[0] = {
      ...variants[0],
      pricing: {
        ...variants[0].pricing,
        basePrice: pkg.pricing.basePrice ?? pkg.pricing.adultPrice ?? 0,
        priceType: pkg.pricing.priceType || 'per_person',
      },
      mealPlan: pkg.pricing.mealPlan || variants[0].mealPlan,
      hotelCategory: pkg.pricing.hotelCategory || variants[0].hotelCategory,
    };
  }

  const pricingRules: PackagePricingRules = {
    seasonalPricing: pkg?.pricing?.seasonalPricing || [],
    dateOverrides: pkg?.pricing?.dateOverrides || [],
    blackoutDates: pkg?.pricing?.blackoutDates || [],
    groupDiscounts: pkg?.pricing?.groupDiscounts || [],
    earlyBirdDiscount:
      pkg?.pricing?.earlyBirdDiscount || base.pricing.earlyBirdDiscount,
  };

  const legacy: Record<string, any> = {};
  if (pkg && typeof pkg === 'object') {
    for (const k of Object.keys(pkg)) {
      if (!MAPPED_TOP_KEYS.has(k)) legacy[k] = pkg[k];
    }
  }

  return {
    title: pkg?.title || '',
    description: pkg?.description || '',
    shortDescription: pkg?.shortDescription || '',
    packageType: pkg?.packageType || base.packageType,
    category,
    tags: pkg?.tags || [],
    difficulty: pkg?.difficulty || base.difficulty,
    nights,
    destinations,
    startPoint: pkg?.startPoint || '',
    endPoint: pkg?.endPoint || '',
    itinerary: Array.isArray(pkg?.itinerary) ? pkg.itinerary : [],
    variants,
    pricing: pricingRules,
    inclusions: pkg?.inclusions || [],
    exclusions: pkg?.exclusions || [],
    cancellationPolicy:
      pkg?.cancellationPolicy && typeof pkg.cancellationPolicy === 'object'
        ? {
            type: pkg.cancellationPolicy.type || 'moderate',
            rules: pkg.cancellationPolicy.rules || [],
          }
        : { type: 'moderate', rules: [] },
    vendorStory: pkg?.vendorStory || base.vendorStory,
    images: Array.isArray(pkg?.images)
      ? pkg.images.map((img: any, i: number) =>
          typeof img === 'string'
            ? { url: img, caption: '', isPrimary: i === 0, order: i }
            : {
                url: img?.url || '',
                caption: img?.caption || '',
                isPrimary: img?.isPrimary ?? i === 0,
                order: img?.order ?? i,
              }
        )
      : [],
    departures: Array.isArray(pkg?.departures) ? pkg.departures : [],
    availability: pkg?.availability || base.availability,
    seo: pkg?.seo || base.seo,
    legacy,
  };
}
