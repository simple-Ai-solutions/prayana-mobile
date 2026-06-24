// @prayana/shared-hooks - Barrel export for all shared hooks

// Auth
export { AuthProvider, useAuth } from './useAuth';

// Network status (React Native adapted)
export { useOnlineStatus } from './useOnlineStatus';

// Utility hooks
export { useDebounce } from './useDebounce';

// Itinerary hooks
export { useItinerary } from './useItinerary';
export {
  useItineraryGeneration,
  useItineraryActions,
  useTabSystem,
} from './useItineraryGeneration';

// Collaboration hooks
export { useCollaboration } from './useCollaboration';
export { useFieldPresence } from './useFieldPresence';

// Data enrichment
export { useEnrichmentPolling } from './useEnrichmentPolling';
export { useImageEnrichment } from './useImageEnrichment';
export { useCoordinateEnrichment } from './useCoordinateEnrichment';

// Location detection
export { useAutoLocationDetection } from './useAutoLocationDetection';

// Search
export { useTripPlannerSearch } from './useTripPlannerSearch';
