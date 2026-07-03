import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient for the whole vendor app.
 *
 * Vendor screens skew toward write-heavy (listings, bookings management),
 * so we keep staleTime low (15s) for fresh dashboard data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
