/**
 * API response envelope and pagination type definitions for Prayana AI mobile app.
 * Generic wrappers for all API calls.
 */

// ---------------------------------------------------------------------------
// API Response Envelopes
// ---------------------------------------------------------------------------

/** Standard success response from the API */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/** Standard error response from the API */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Validation errors keyed by field name */
  errors?: Record<string, string>;
  /** Stack trace (development only) */
  stack?: string;
}

/** Union of success or error response */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  message?: string;
}

// ---------------------------------------------------------------------------
// List / Filter helpers
// ---------------------------------------------------------------------------

export interface SortOption {
  field: string;
  order: 'asc' | 'desc';
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** Generic filter for list endpoints */
export interface ListFilters {
  search?: string;
  page?: number;
  limit?: number;
  sort?: SortOption;
  dateRange?: DateRange;
  status?: string;
  category?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// API request helpers
// ---------------------------------------------------------------------------

/** Shape for mutation request bodies (create/update) */
export interface MutationRequest<T = unknown> {
  data: T;
}

/** Shape for ID-based operations */
export interface IdParam {
  id: string;
}

// ---------------------------------------------------------------------------
// Real-time / WebSocket types
// ---------------------------------------------------------------------------

export type SocketEventName = string;

export interface SocketEvent<T = unknown> {
  event: SocketEventName;
  data: T;
  timestamp: string;
}

/** Collaboration update broadcast payload */
export interface CollaborationUpdate<T = unknown> {
  tripId: string;
  userId: string;
  userName?: string;
  field: string;
  data: T;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Health check / Meta
// ---------------------------------------------------------------------------

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  timestamp: string;
}
