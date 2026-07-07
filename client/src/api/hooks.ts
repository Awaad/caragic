import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client';
import type { 
  ContentResponse,
  ConversationSummary,
  MessageListResponse,
 } from './types';

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


export function useGetOrCreateConversation(enabled: boolean) {
  return useQuery({
    queryKey: ["conversation"],
    queryFn: async () => {
      const res = await apiFetch<{ conversation: ConversationSummary }>(
        "/visitor/conversations",
        { method: "POST" },
      );
      return res.conversation;
    },
    enabled,
    staleTime: Infinity, // conversation identity doesn't change
  });
}

export function useMessagesQuery(
  conversationId: string | undefined,
  beforeId: string | undefined,
) {
  const p = new URLSearchParams();
  if (beforeId) p.set("before_id", beforeId);
  p.set("limit", "50");
  return useQuery({
    queryKey: ["messages", conversationId, beforeId],
    queryFn: () =>
      apiFetch<MessageListResponse>(
        `/visitor/conversations/${conversationId}/messages?${p.toString()}`,
      ),
    enabled: !!conversationId,
    staleTime: 0,
  });
}


export function useOwnerStatus() {
  return useQuery({
    queryKey: ["owner-status"],
    queryFn: () => apiFetch<{ status: string; updated_at: string | null }>(
      "/visitor/conversations/status",
    ),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}