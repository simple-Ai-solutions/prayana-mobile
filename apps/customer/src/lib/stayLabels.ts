// stayLabels — labels for the keys a stay listing stores (property types,
// amenities, house rules, meal plans, cancellation policies, beds, room
// features) and check-in times.
//
// Ported from the web's components/business/stays/stayConfig.js, which in
// turn mirrors server/services/stayCatalog.js. Keep the three in step: a key
// missing here shows up as a raw id (or not at all) on the phone.
import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export type StayCategoryId = 'hotel' | 'home' | 'unique';

export const STAY_CATEGORIES: { id: StayCategoryId; label: string }[] = [
  { id: 'hotel', label: 'Hotel, resort or hostel' },
  { id: 'home', label: 'Home or homestay' },
  { id: 'unique', label: 'Something different' },
];

type PropertyType = { category: StayCategoryId; label: string; common?: boolean };

// Grouped like the web's filter panel shows them: the common ones first.
export const PROPERTY_TYPES: Record<string, PropertyType> = {
  hotel: { category: 'hotel', label: 'Hotel', common: true },
  resort: { category: 'hotel', label: 'Resort', common: true },
  hostel: { category: 'hotel', label: 'Hostel', common: true },
  guest_house: { category: 'hotel', label: 'Guest house / lodge', common: true },
  heritage_hotel: { category: 'hotel', label: 'Heritage hotel', common: true },
  serviced_apartment: { category: 'hotel', label: 'Serviced apartment' },
  lodge: { category: 'hotel', label: 'Jungle or mountain lodge' },
  bnb: { category: 'hotel', label: 'Bed & breakfast' },
  motel: { category: 'hotel', label: 'Highway motel' },
  capsule_hotel: { category: 'hotel', label: 'Capsule / pod hotel' },

  homestay: { category: 'home', label: 'Homestay', common: true },
  villa: { category: 'home', label: 'Villa', common: true },
  apartment: { category: 'home', label: 'Apartment / flat', common: true },
  cottage: { category: 'home', label: 'Cottage', common: true },
  bungalow: { category: 'home', label: 'Bungalow' },
  farmhouse: { category: 'home', label: 'Farmhouse' },

  houseboat: { category: 'unique', label: 'Houseboat', common: true },
  glamping: { category: 'unique', label: 'Glamping / tents', common: true },
  treehouse: { category: 'unique', label: 'Treehouse', common: true },
  farm_stay: { category: 'unique', label: 'Farm stay', common: true },
  campsite: { category: 'unique', label: 'Campsite' },
  eco_lodge: { category: 'unique', label: 'Eco stay' },
};

export const propertyTypeLabel = (id?: string | null): string =>
  (id && PROPERTY_TYPES[id]?.label) || 'Stay';

export const typesIn = (category: StayCategoryId) =>
  Object.entries(PROPERTY_TYPES)
    .filter(([, t]) => t.category === category)
    .map(([id, t]) => ({ id, ...t }));

export const BED_TYPES: { id: string; label: string }[] = [
  { id: 'king', label: 'King' },
  { id: 'queen', label: 'Queen' },
  { id: 'double', label: 'Double' },
  { id: 'twin', label: 'Twin (2 singles)' },
  { id: 'single', label: 'Single' },
  { id: 'bunk', label: 'Bunk' },
  { id: 'sofa_bed', label: 'Sofa-bed' },
  { id: 'mattress', label: 'Floor mattress' },
];
export const BED_LABEL: Record<string, string> = Object.fromEntries(BED_TYPES.map((b) => [b.id, b.label]));

export const MEAL_PLANS: { id: string; label: string; hint: string }[] = [
  { id: 'room_only', label: 'Room only', hint: 'No meals' },
  { id: 'breakfast', label: 'With breakfast', hint: 'Breakfast included' },
  { id: 'half_board', label: 'Breakfast + dinner', hint: 'Two meals included' },
  { id: 'full_board', label: 'All meals', hint: 'Breakfast, lunch and dinner' },
];
export const MEAL_LABEL: Record<string, string> = Object.fromEntries(MEAL_PLANS.map((m) => [m.id, m.label]));
export const mealPlanLabel = (id?: string | null): string => (id && MEAL_LABEL[id]) || 'Room only';

export const ROOM_FEATURES: { id: string; label: string }[] = [
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
export const FEATURE_LABEL: Record<string, string> = Object.fromEntries(ROOM_FEATURES.map((f) => [f.id, f.label]));

export const AMENITIES: { id: string; label: string; popular?: boolean; icon: IconName }[] = [
  { id: 'wifi', label: 'Free Wi-Fi', popular: true, icon: 'wifi-outline' },
  { id: 'parking', label: 'Parking', popular: true, icon: 'car-outline' },
  { id: 'ac', label: 'Air conditioning', popular: true, icon: 'snow-outline' },
  { id: 'power_backup', label: 'Power backup', popular: true, icon: 'flash-outline' },
  { id: 'hot_water', label: '24-hour hot water', popular: true, icon: 'water-outline' },
  { id: 'front_desk_24h', label: '24-hour front desk', popular: true, icon: 'time-outline' },
  { id: 'restaurant', label: 'Restaurant', popular: true, icon: 'restaurant-outline' },
  { id: 'room_service', label: 'Room service', popular: true, icon: 'notifications-outline' },
  { id: 'pool', label: 'Swimming pool', popular: true, icon: 'water-outline' },
  { id: 'lift', label: 'Lift', popular: true, icon: 'swap-vertical-outline' },
  { id: 'housekeeping', label: 'Daily housekeeping', popular: true, icon: 'sparkles-outline' },
  { id: 'breakfast_available', label: 'Breakfast available', popular: true, icon: 'cafe-outline' },
  { id: 'airport_transfer', label: 'Airport / station pickup', icon: 'airplane-outline' },
  { id: 'gym', label: 'Gym', icon: 'barbell-outline' },
  { id: 'spa', label: 'Spa / massage', icon: 'flower-outline' },
  { id: 'kitchen', label: 'Kitchen guests can use', icon: 'restaurant-outline' },
  { id: 'laundry', label: 'Laundry', icon: 'shirt-outline' },
  { id: 'tv', label: 'TV', icon: 'tv-outline' },
  { id: 'garden', label: 'Garden / lawn', icon: 'leaf-outline' },
  { id: 'bonfire', label: 'Bonfire', icon: 'bonfire-outline' },
  { id: 'kids_play_area', label: "Kids' play area", icon: 'happy-outline' },
  { id: 'wheelchair_access', label: 'Wheelchair accessible', icon: 'accessibility-outline' },
  { id: 'cctv', label: 'CCTV in common areas', icon: 'videocam-outline' },
  { id: 'first_aid', label: 'First aid', icon: 'medkit-outline' },
  { id: 'ev_charging', label: 'EV charging', icon: 'battery-charging-outline' },
  { id: 'lockers', label: 'Lockers', icon: 'lock-closed-outline' },
  { id: 'common_area', label: 'Common lounge', icon: 'people-outline' },
  { id: 'workspace', label: 'Workspace / co-working', icon: 'laptop-outline' },
  { id: 'bar', label: 'Bar', icon: 'wine-outline' },
  { id: 'conference_hall', label: 'Conference / banquet hall', icon: 'business-outline' },
  { id: 'doctor_on_call', label: 'Doctor on call', icon: 'medical-outline' },
  { id: 'travel_desk', label: 'Tour & travel desk', icon: 'map-outline' },
  { id: 'bike_rental', label: 'Bike / scooter rental', icon: 'bicycle-outline' },
  { id: 'home_cooked_meals', label: 'Home-cooked meals', icon: 'restaurant-outline' },
  { id: 'pure_veg', label: 'Pure-veg kitchen', icon: 'nutrition-outline' },
  { id: 'jain_food', label: 'Jain food on request', icon: 'nutrition-outline' },
  { id: 'terrace', label: 'Terrace / rooftop', icon: 'sunny-outline' },
  { id: 'games_room', label: 'Games room', icon: 'game-controller-outline' },
];
export const AMENITY_BY_ID: Record<string, (typeof AMENITIES)[number]> = Object.fromEntries(
  AMENITIES.map((a) => [a.id, a]),
);
/** The first eight "popular" amenities: the ones guests filter by most. */
export const AMENITY_FILTERS = AMENITIES.filter((a) => a.popular).slice(0, 8);

export type HouseRuleId =
  | 'coupleFriendly'
  | 'localIdAccepted'
  | 'foreignersAccepted'
  | 'petsAllowed'
  | 'smokingAllowed'
  | 'alcoholAllowed'
  | 'outsideFoodAllowed'
  | 'partiesAllowed';

export const HOUSE_RULES: { id: HouseRuleId; label: string }[] = [
  { id: 'coupleFriendly', label: 'Unmarried couples welcome' },
  { id: 'localIdAccepted', label: 'Local ID accepted' },
  { id: 'foreignersAccepted', label: 'Foreign guests welcome' },
  { id: 'petsAllowed', label: 'Pets allowed' },
  { id: 'smokingAllowed', label: 'Smoking allowed in rooms' },
  { id: 'alcoholAllowed', label: 'Alcohol allowed' },
  { id: 'outsideFoodAllowed', label: 'Outside food allowed' },
  { id: 'partiesAllowed', label: 'Parties or events allowed' },
];

/** "Pets allowed" → "Pets not allowed"; every rule label ends in one of these. */
export function ruleText(label: string, yes: boolean): string {
  if (yes) return label;
  return label.replace(/ (allowed|welcome|accepted)\b/, ' not $1');
}

export type CancellationId = 'free_1d' | 'free_3d' | 'free_7d' | 'non_refundable';

export const CANCELLATION_POLICIES: { id: CancellationId; label: string }[] = [
  { id: 'free_1d', label: 'Free cancellation until 1 day before' },
  { id: 'free_3d', label: 'Free cancellation until 3 days before' },
  { id: 'free_7d', label: 'Free cancellation until 7 days before' },
  { id: 'non_refundable', label: 'Non-refundable' },
];

export const cancellationPolicy = (id?: string | null) =>
  CANCELLATION_POLICIES.find((c) => c.id === id) ||
  CANCELLATION_POLICIES.find((c) => c.id === 'non_refundable')!;

/**
 * The guest-facing sentence for a policy. The stayConfig hints are written for
 * hosts, so guests get their own line. Free cancellation runs until N days
 * before the check-in time (server: stayBookingService.freeCancellationUntil).
 */
export function cancellationDetail(id?: string | null): string | null {
  if (id === 'non_refundable') return 'No refund if you cancel.';
  const days = Number(/^free_(\d+)d$/.exec(id || '')?.[1]);
  if (!days) return null;
  return `Full refund if you cancel at least ${days === 1 ? '24 hours' : `${days} days`} before check-in time. After that, there's no refund.`;
}

/** Every half hour of the day: { value: "14:30", label: "2:30 PM" }. */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? '30' : '00';
  const value = `${String(h).padStart(2, '0')}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value, label: `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}` };
});

/** "14:00" → "2:00 PM". Unknown values come back as they are. */
export const timeLabel = (v?: string | null): string =>
  TIME_OPTIONS.find((t) => t.value === v)?.label || v || '';

export const TRIP_TYPES: { id: 'family' | 'couple' | 'solo' | 'friends' | 'business'; label: string; icon: IconName }[] = [
  { id: 'family', label: 'Family', icon: 'people-outline' },
  { id: 'couple', label: 'Couple', icon: 'heart-outline' },
  { id: 'solo', label: 'Solo', icon: 'person-outline' },
  { id: 'friends', label: 'Friends', icon: 'beer-outline' },
  { id: 'business', label: 'Business', icon: 'briefcase-outline' },
];

export const REVIEW_ASPECTS: { id: 'cleanliness' | 'location' | 'value' | 'staff' | 'comfort'; label: string }[] = [
  { id: 'cleanliness', label: 'Cleanliness' },
  { id: 'location', label: 'Location' },
  { id: 'value', label: 'Value for money' },
  { id: 'staff', label: 'Staff & host' },
  { id: 'comfort', label: 'Comfort' },
];
