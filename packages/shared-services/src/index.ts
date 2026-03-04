// @prayana/shared-services - Barrel export for all API services and config
// This package provides all API services, socket service, and configuration
// for the Prayana AI React Native monorepo.

// ===== Firebase =====
export { app, auth } from './firebase';

// ===== API Configuration =====
export {
  API_CONFIG,
  makeAPICall,
  makeItineraryAPICall,
  makeChatAPICall,
  replaceUrlParams,
  apiHelpers,
  setBaseURL,
  getBaseURL,
  setAuthTokenProvider,
  getAuthToken,
  getAuthHeaders,
} from './apiConfig';

// ===== Auth API =====
export {
  syncUserWithBackend,
  fetchUserProfile,
  updateUserProfile,
  saveEmailPreference,
  saveNotificationPreferences,
  saveFcmToken,
  deleteFcmToken,
} from './authAPI';

// ===== Socket Service =====
export { default as socketService } from './socketService';

// ===== API Services =====

// Activity Marketplace
export { activityMarketplaceAPI } from './api/activityMarketplaceAPI';

// Admin
export { adminAPI, setAdminStorage } from './api/adminAPI';

// Booking
export { bookingAPI } from './api/bookingAPI';

// Business
export { businessAPI } from './api/businessAPI';

// Country Content
export { default as countryContentAPI } from './api/countryContentAPI';

// Create Trip
export { createTripAPI } from './api/createTripAPI';

// Destination (with streaming support)
export {
  destinationAPI,
  hierarchicalSearch,
  streamingSearch,
  quickSearch,
  StreamingErrorTypes,
  StreamingConfig,
} from './api/destinationAPI';

// Dispute
export { default as disputeAPI, setDisputeAdminTokenGetter } from './api/disputeAPI';

// Favorites
export { default as favoritesAPI } from './api/favoritesAPI';

// Feedback
export { feedbackAPI } from './api/feedbackAPI';

// Hotel
export { default as hotelAPI, setHotelSearchAPIURL, setHotelSupplierAPIURL } from './api/hotelAPI';

// Centralized API index (destinationAPI, tripPlanningAPI, userAPI)
export { default as apiServices } from './api/index';

// Interest
export { interestAPI } from './api/interestAPI';

// Invoice
export { invoiceAPI } from './api/invoiceAPI';

// Message
export { messageAPI } from './api/messageAPI';

// Packing
export { getPackingList, updatePackingList, togglePackingItem } from './api/packingAPI';

// Payout
export { payoutAPI, setPayoutAdminTokenGetter } from './api/payoutAPI';

// Photo
export { uploadPhoto, getTripPhotos, likePhoto, addComment, deletePhoto } from './api/photoAPI';

// Poll
export { createPoll, getTripPolls, voteOnPoll, closePoll, deletePoll } from './api/pollAPI';

// Question
export { questionAPI } from './api/questionAPI';

// Route-Based Suggestions
export { routeBasedSuggestionsAPI } from './api/routeBasedSuggestionsAPI';

// Route Optimization
export {
  optimizeRoute,
  optimizeRouteWithAI,
  optimizeAllDays,
  calculateTravelTime,
  routeOptimizationAPI,
} from './api/routeOptimizationAPI';

// Share & Export
export {
  generateShareLink,
  generateICalendar,
  generatePDFHTML,
  requestPDFExport,
  shareExportAPI,
} from './api/shareExportAPI';

// Time Slot
export { timeSlotAPI } from './api/timeSlotAPI';

// Transportation
export { transportationAPI } from './api/transportationAPI';

// Trip Planning
export { tripPlanningAPI, setTripPlanningStorage } from './api/tripPlanningAPI';

// User
export { userAPI, setUserAPIStorage } from './api/userAPI';

// Variant
export { variantAPI } from './api/variantAPI';
