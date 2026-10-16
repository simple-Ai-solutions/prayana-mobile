// The shapes the Isha chat works with: messages, the cards a reply carries,
// and the server's reply payload (see server/routes/chat.js /send and /stream).

export type ChatImage = string | { url?: string; mediumUrl?: string; imageUrl?: string; caption?: string };

export interface Place {
  id?: string;
  _id?: string;
  placeId?: string;
  name: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  s3Key?: string;
  images?: Array<string | { url?: string; mediumUrl?: string }>;
  rating?: number;
  reviews?: number;
  reviewCount?: number;
  category?: string;
  city?: string;
  state?: string;
  location?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
}

/** A real place from search_local, with its map link. */
export interface LocalPlace {
  placeId?: string;
  name: string;
  photoUrl?: string;
  rating?: number;
  reviews?: number;
  openNow?: boolean | null;
  address?: string;
  mapsUrl?: string;
}

export interface ChatMap {
  center?: { lat: number; lng: number };
  label?: string;
  pins?: Array<{ index: number; lat: number; lng: number }>;
}

/** Prayana's own bookable product the agent returns in `inventory[]`. */
export interface InventoryItem {
  kind: 'activity' | 'package' | 'transport' | 'cab' | 'captain_tour' | 'global_activity' | string;
  id?: string;
  slug?: string;
  title: string;
  image?: string | null;
  price?: number | null;
  currency?: string;
  priceSuffix?: string;
  offer?: { finalPrice: number; label?: string } | null;
  location?: string;
  duration?: string;
  nights?: number;
  days?: number;
  routeFrom?: string;
  routeTo?: string;
  distanceKm?: number;
  rating?: number;
  reviewCount?: number;
  bookings?: number;
  url?: string;
  external?: boolean;
}

export interface TripQuestion {
  id: string;
  label: string;
  options: string[];
  default?: string | string[] | null;
  multi?: boolean;
  optional?: boolean;
  type?: 'place' | string;
  hints?: Record<string, string>;
  note?: string;
}

/** One-tap prompts the agent sets up in `actionCards[]`. */
export interface ActionCard {
  type: 'confirm_booking' | 'book_cab' | 'buy_esim' | 'save_favorite' | 'view_itinerary' | 'trip_choices' | string;
  label: string;
  requiresAuth?: boolean;
  data?: any;
}

export interface EsimPlan {
  name: string;
  country?: string;
  countryCode?: string;
  data?: string;
  duration?: number | string;
  price?: number;
  currency?: string;
  speed?: string;
}

/** The plan generate_itinerary built, or what a saved chat keeps of it. */
export interface ItineraryRef {
  slug?: string | null;
  markdownItineraryId?: string | null;
  itineraryId?: string | null;
  destination?: string | null;
  duration?: number | string | null;
  transportMode?: string | null;
  title?: string | null;
  markdown?: string;
  images?: string[];
}

export interface ReplyStep {
  text: string;
  done: boolean;
}

export interface LegacyAction {
  type?: string;
  text: string;
  action?: string;
  target?: string;
  query?: string;
  placeId?: string;
  location?: string;
}

export type MessageType =
  | 'message'
  | 'response'
  | 'error'
  | 'suggestion'
  | 'loading'
  | 'itinerary_loading'
  | 'itinerary_preview'
  | 'trip_planner_form';

export interface TripFormData {
  destination: string;
  duration: number;
  startingPoint: string | null;
  transportMode: string;
  preferences?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type?: MessageType;
  content: string;
  timestamp: string;
  senderType?: 'ai' | 'agent';
  agentName?: string;
  isStreaming?: boolean;
  isTemporary?: boolean;
  statusText?: string;
  steps?: ReplyStep[];
  /** "failed": never reached Isha. "offline": waits for the connection. */
  deliveryStatus?: 'failed' | 'offline';
  interrupted?: boolean;
  stopped?: boolean;
  errorReason?: string | null;
  suggestions?: Array<{ text: string; type?: string }>;
  actions?: LegacyAction[];
  relatedPlaces?: Array<{ id?: string; name: string }>;
  topPlaces?: Place[];
  images?: ChatImage[];
  coverImages?: ChatImage[];
  localPlaces?: LocalPlace[];
  map?: ChatMap | null;
  destinationData?: any;
  detectedDestination?: string | null;
  esimPlans?: EsimPlan[];
  actionCards?: ActionCard[];
  itinerary?: ItineraryRef | null;
  itineraryRef?: ItineraryRef | null;
  inventory?: InventoryItem[];
  itineraryData?: { markdown?: any; structured?: any; data?: any } | null;
  requestData?: Partial<TripFormData> | null;
  metadata?: Record<string, unknown>;
}

/** A finished reply, whether it came over /send or /stream. */
export interface ChatResponse {
  message: string | null;
  mode: 'ai' | 'queued' | 'human' | 'resolved' | string;
  streamed?: boolean;
  actions?: LegacyAction[];
  relatedPlaces?: Array<{ id?: string; name: string }>;
  topPlaces?: Place[];
  localPlaces?: LocalPlace[];
  map?: ChatMap | null;
  images?: ChatImage[];
  suggestions?: Array<{ text: string }>;
  destinationData?: any;
  detectedDestination?: string | null;
  esimPlans?: EsimPlan[];
  actionCards?: ActionCard[];
  itinerary?: ItineraryRef | null;
  inventory?: InventoryItem[];
  contextUpdates?: Record<string, unknown> | null;
  offerHandoff?: boolean;
  handoffReason?: string | null;
  metadata?: Record<string, unknown> & { gated?: boolean };
}

/** The place's photos, sent by /stream before the words. */
export interface MediaEvent {
  images?: ChatImage[];
  detectedDestination?: string | null;
  topPlaces?: Array<{ city?: string; name?: string }>;
}

export interface SavedConversation {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  messages: ChatMessage[];
  context: { destination?: string | null };
  sessionId: string | null;
  sessionKey: string | null;
  pinned?: boolean;
}

export type HandoffMode = 'ai' | 'queued' | 'human' | 'resolved';

export interface PageEntity {
  kind: 'destination' | 'package' | 'activity' | 'vehicle' | 'captain tour' | 'pilgrimage package' | string;
  name: string;
}

export interface ChatContext {
  destination: string | null;
  pageEntity: PageEntity | null;
  currentView: string;
  userLocation: { lat?: number; lng?: number; city?: string | null; country?: string | null } | null;
  [key: string]: unknown;
}
