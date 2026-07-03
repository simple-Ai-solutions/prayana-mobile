import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient for the whole customer app.
 *
 * Defaults tuned for mobile:
 *  - staleTime 30s: avoids hammering the API on every screen focus, but keeps
 *    data fresh enough for booking/availability flows.
 *  - retry 2 with exponential backoff: handles flaky mobile networks.
 *  - refetchOnWindowFocus false: irrelevant on RN, keep noise down.
 *  - refetchOnReconnect true: when the user comes back online, sync.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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
