/**
 * Chat and messaging type definitions for Prayana AI mobile app.
 * Derived from server/models/ChatSession.js and ChatMessage.js MongoDB schemas.
 */

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type ChatSessionStatus = 'active' | 'inactive' | 'archived';

export type ChatSessionView = 'home' | 'search' | 'itinerary' | 'place_details';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessageType =
  | 'message'
  | 'suggestion'
  | 'action_response'
  | 'error'
  | 'typing'
  | 'thinking';

export type ChatMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type InputMethod = 'text' | 'voice' | 'suggestion';

export type MessageSentiment = 'positive' | 'neutral' | 'negative';

export type ChatActionType =
  | 'open_modal'
  | 'quick_search'
  | 'place_details'
  | 'get_weather'
  | 'show_featured'
  | 'navigate';

export type DetectedIntent =
  | 'plan_trip'
  | 'check_weather'
  | 'find_hotels'
  | 'find_restaurants'
  | 'compare_options'
  | 'get_recommendations'
  | 'general_inquiry';

// ---------------------------------------------------------------------------
// ChatSession nested interfaces
// ---------------------------------------------------------------------------

export interface SearchResultMetadata {
  bestTimeToVisit?: string;
  streamingEnabled?: boolean;
  source?: string;
  dataQuality?: string;
  lastUpdated?: string;
  searchCount?: number;
  views?: number;
  permanentlyStored?: boolean;
}

export interface ChatSearchResult {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  rating?: number;
  image?: string;
  /** Can be a string or an object with area, city, and coordinates */
  location?: unknown;
  country?: string;
  highlights?: string[];
  entryFee?: string;
  openingHours?: string;
  duration?: string;
  tips?: string[];
  metadata?: SearchResultMetadata;
  stableId?: string;
}

export interface ChatSessionContext {
  currentView: ChatSessionView;
  destination?: string | null;
  searchLocation?: string | null;
  searchResults: ChatSearchResult[];
  itineraryId?: string | null;
  placeId?: string | null;
  activeFilters: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface SessionActionPerformed {
  actionType: string;
  timestamp: string;
  success: boolean;
}

export interface SessionAnalytics {
  topics: string[];
  mentionedPlaces: string[];
  actionsPerformed: SessionActionPerformed[];
  queries: string[];
  /** Duration in milliseconds */
  durationMs?: number;
  /** 0-100 engagement score */
  engagementScore?: number;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  timezone?: string;
  messageCount: number;
  userMessageCount: number;
  aiMessageCount: number;
  averageResponseTime?: number;
  totalTokensUsed: number;
  /** 1-5 rating */
  satisfactionRating?: number | null;
  feedback?: string;
  isTyping: boolean;
  lastTypingUpdate?: string;
}

// ---------------------------------------------------------------------------
// Main ChatSession interface
// ---------------------------------------------------------------------------

export interface ChatSession {
  _id: string;
  sessionId: string;
  userId?: string | null;
  startedAt: string;
  lastActivity: string;
  endedAt?: string | null;
  status: ChatSessionStatus;
  context: ChatSessionContext;
  metadata: SessionMetadata;
  analytics: SessionAnalytics;
  /** Virtual: computed duration in ms */
  duration?: number;
  createdAt: string;
  updatedAt: string;
}

/** Summary view of a chat session (virtual property) */
export interface ChatSessionSummary {
  id: string;
  sessionId: string;
  destination?: string | null;
  messageCount: number;
  duration: number;
  status: ChatSessionStatus;
  lastActivity: string;
}

// ---------------------------------------------------------------------------
// ChatMessage nested interfaces
// ---------------------------------------------------------------------------

export interface RelatedPlace {
  id?: string;
  name?: string;
  type?: string;
}

export interface ChatActionTaken {
  actionType: string;
  timestamp: string;
  success: boolean;
  data?: unknown;
}

export interface ChatMessageContext {
  currentView?: string;
  destination?: string;
  searchLocation?: string;
  relatedPlaces: RelatedPlace[];
  actionsTaken: ChatActionTaken[];
  metadata: Record<string, unknown>;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface SafetyRating {
  category: string;
  probability: string;
}

export interface AiData {
  model: string;
  tokens: TokenUsage;
  /** Response time in milliseconds */
  responseTime?: number;
  generatedAt: string;
  /** 0 to 1 */
  confidence?: number;
  safetyRatings: SafetyRating[];
}

export interface EditHistoryEntry {
  originalContent: string;
  editedAt: string;
}

export interface UserData {
  inputMethod: InputMethod;
  userAgent?: string;
  ipAddress?: string;
  typingStarted?: string;
  typingEnded?: string;
  editHistory: EditHistoryEntry[];
}

export interface ChatAction {
  type: ChatActionType;
  target?: string;
  text?: string;
  data?: unknown;
  clickCount: number;
  lastClicked?: string;
}

export interface ChatMessageMetadata {
  requestId?: string;
  /** For threaded conversations */
  parentMessageId?: string;
  sentiment?: MessageSentiment;
  intent?: string;
  entities: string[];
  /** 1-5 user feedback rating */
  rating?: number;
  feedback?: string;
  reportedIssue?: string;
  processingTime?: number;
  cacheHit?: boolean;
  flagged: boolean;
  flagReason?: string;
  moderationScore?: number;
}

// ---------------------------------------------------------------------------
// Main ChatMessage interface
// ---------------------------------------------------------------------------

export interface ChatMessage {
  _id: string;
  messageId: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  type: ChatMessageType;
  timestamp: string;
  context: ChatMessageContext;
  aiData: AiData;
  userData: UserData;
  actions: ChatAction[];
  status: ChatMessageStatus;
  isTemporary: boolean;
  isEdited: boolean;
  metadata: ChatMessageMetadata;
  createdAt: string;
  updatedAt: string;
}
