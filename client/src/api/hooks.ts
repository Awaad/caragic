import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client';
import type { ContentResponse } from './types';

/**
 * Single source of truth for visitor content.
 * - 401: no session (visitor hasn't tapped a card)
 * - 410: mode was deactivated after session minted (treat like 401 for now)
 * - 200: returns content for the session's bound mode, including the mode name
 *
 * Backend caches via ETag + Cache-Control: private, max-age=300.
 * React Query staleTime matches so we don't refetch within that window.
 */
export function useContent() {
  return useQuery({
    queryKey: ['content'],
    queryFn: () => apiFetch<ContentResponse>('/content'),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError) {
        // No session, gone, forbidden — none of these get better with retries
        if ([401, 403, 410].includes(error.status)) return false;
      }
      return failureCount < 2;
    },
  });
}