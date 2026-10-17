// A typed view of the shared stays client (@prayana/shared-services
// staysAPI.js) for the vendor screens. The client is plain JS, so TypeScript
// infers its option objects from their defaults (e.g. `{ dimensions = [] } = {}`
// becomes `{ dimensions?: never[] }`) and rejects the other fields. Same
// object, same calls — only the types are spelled out here.

import { staysAPI as client } from '@prayana/shared-services';
import type { Stay, UploadFile } from './stayConfig';

/** What every stays endpoint answers with (makeAPICall throws on non-2xx). */
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

export interface CalendarChange {
  roomTypeIds: string[] | 'all';
  from: string;
  to: string;
  closed?: boolean;
  priceOverride?: number | null;
  blocked?: number;
}

/** POST /stays/import: fill a draft from the owner's listing on another site. */
export interface ImportListingRequest {
  /** The listing's link. Optional when there are screenshots. */
  url?: string;
  /** The owner says the property and its photos are theirs to use; the server refuses without it. */
  confirmOwnership: true;
  /** Copy the listing's photos too (default true). */
  importPhotos?: boolean;
  /** Retry on this draft instead of starting a new one. */
  stayId?: string;
  /** Screenshots of the listing (up to 8), for sites that won't let the server read the page. */
  screenshots?: UploadFile[];
}

interface VendorStaysAPI {
  listMine(): Promise<ApiResponse>;
  getMine(id: string): Promise<ApiResponse>;
  create(propertyType: string): Promise<ApiResponse>;
  update(id: string, patch: Record<string, unknown>): Promise<ApiResponse>;
  submit(id: string): Promise<ApiResponse>;
  remove(id: string): Promise<ApiResponse>;
  uploadPhotos(
    id: string,
    files: UploadFile[],
    opts: { slot?: string; roomTypeId?: string; dimensions?: { width?: number; height?: number }[] },
  ): Promise<ApiResponse>;
  updatePhoto(id: string, photoId: string, patch: { isCover?: boolean; slot?: string; roomTypeId?: string | null; caption?: string }): Promise<ApiResponse>;
  deletePhoto(id: string, photoId: string): Promise<ApiResponse>;
  uploadLicence(id: string, licence: { file: UploadFile; type: string; number?: string }): Promise<ApiResponse>;
  deleteLicence(id: string, licenceId: string): Promise<ApiResponse>;
  priceEstimate(body: { prices: number[]; gstRegistered: boolean; gstin: string | null }): Promise<ApiResponse>;
  importTariff(id: string, file: UploadFile): Promise<ApiResponse>;
  /**
   * 202 with the draft (`data.importJob.status` "running"); poll getMine(id)
   * until it's "done" or "failed". 400: no ownership confirmation, a bad or
   * private link, or nothing to read. 429: 10 imports a day. 409: one is
   * already running for stayId.
   */
  importListing(body: ImportListingRequest): Promise<ApiResponse<Stay>>;
  getCalendar(id: string, opts: { from?: string; days?: number }): Promise<ApiResponse>;
  updateCalendar(id: string, change: CalendarChange): Promise<ApiResponse>;
  vendorBookings(opts: { bucket?: string; stayId?: string; page?: number }): Promise<ApiResponse>;
  vendorCancelBooking(bookingId: string, reason: string): Promise<ApiResponse>;
  vendorMarkNoShow(bookingId: string): Promise<ApiResponse>;
  vendorReviews(opts: { stayId?: string; filter?: 'unreplied' | 'all'; page?: number }): Promise<ApiResponse>;
  replyToReview(reviewId: string, body: string): Promise<ApiResponse>;
  flagReview(reviewId: string, reason: string): Promise<ApiResponse>;
  getCalendarSync(id: string): Promise<ApiResponse>;
  addCalendarImport(id: string, body: { roomTypeId: string; url: string; label: string }): Promise<ApiResponse>;
  removeCalendarImport(id: string, importId: string): Promise<ApiResponse>;
  syncCalendarsNow(id: string): Promise<ApiResponse>;
}

export const staysAPI = client as unknown as VendorStaysAPI;

// Expo Router treats every file under app/ as a route; a default export keeps
// this module from warning about a missing one.
export default staysAPI;
