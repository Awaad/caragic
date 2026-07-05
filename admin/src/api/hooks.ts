import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "./client";
import type {
  WhoAmIResponse,
  AdminSubmissionDetail,
  AdminSubmissionListResponse,
  AdminSubmissionSummary,
  SubmissionStatus,
  NotificationsConfigOut, 
  NotificationsConfigIn,
  TestNotificationRequest, 
  TestNotificationResponse,
  TokenListResponse,
  TokenSummary,
  TokenStatus,
  CreateTokenResponse,
  ActiveModeResponse,
  ModeListResponse,
  AdminSubmissionStatsResponse,
  OwnerStatusOut,
  OwnerStatus,
  AdminConversationListResponse,
  ChatMessage,
  MessageListResponse,
} from "./types";


export interface SubmissionsListFilters {
  mode?: string;
  outcome?: "submitted" | "declined";
  statuses?: SubmissionStatus[];
  limit?: number;
  before_id?: string;
}

interface LoginRequest {
  username: string;
  password: string;
  totp_code: string;
}

// Tokens 

export interface TokensListFilters {
  statuses?: TokenStatus[];
  mode?: string;
  kind?: "card" | "link";
  limit?: number;
  before_id?: string;
}

export interface MintTokenRequest {
  mode: string;
  label: string | null;
}



/** Auth probe. Powers AuthGuard. 401 → not logged in (React Query treats it
 *  as an error; guard reads that as the redirect signal). */
export function useWhoAmI() {
  return useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiFetch<WhoAmIResponse>("/admin/whoami"),
    staleTime: 5 * 60 * 1000, // 5 min — auth doesn't churn
    retry: (failureCount, error) => {
      // 401 is a definitive answer, don't retry
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
  });
}



/** Login → sets HttpOnly cookie server-side. On success, we invalidate whoami
 *  so the guard re-fetches and unblocks. */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation<WhoAmIResponse, Error, LoginRequest>({
    mutationFn: (body) =>
      apiFetch<WhoAmIResponse>("/admin/login", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whoami"] });
    },
  });
}

/** Logout → server clears the cookie. Wipe all cached queries so nothing
 *  leaks across sessions (submission PII especially). */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () =>
      apiFetch<void>("/admin/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.clear();
    },
  });
}


/**
 * Encode filters as a URLSearchParams. `status` is repeated per value
 * (matches FastAPI's list-query parsing). Undefined filters are omitted.
 */
function filtersToQuery(filters: SubmissionsListFilters): string {
  const p = new URLSearchParams();
  if (filters.mode) p.set("mode", filters.mode);
  if (filters.outcome) p.set("outcome", filters.outcome);
  if (filters.statuses) filters.statuses.forEach((s) => p.append("status", s));
  if (filters.limit) p.set("limit", String(filters.limit));
  if (filters.before_id) p.set("before_id", filters.before_id);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function useSubmissionsList(filters: SubmissionsListFilters) {
  const query = filtersToQuery(filters);
  return useQuery({
    queryKey: ["submissions", filters],
    queryFn: () =>
      apiFetch<AdminSubmissionListResponse>(`/admin/submissions${query}`),
    // Poll every 30s so a new submission shows up without a manual refresh.
    // Cheap query (metadata-only, no PII decrypt).
    refetchInterval: 30_000,
  });
}

export function useSubmissionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["submissions", "detail", id],
    queryFn: () =>
      apiFetch<AdminSubmissionDetail>(`/admin/submissions/${id}`),
    enabled: !!id,
    // Detail is a PII fetch — don't background-refetch it. If the admin
    // wants fresh data, they navigate back and forward again.
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransitionSubmissionStatus() {
  const qc = useQueryClient();
  return useMutation<
    AdminSubmissionSummary,
    Error,
    { id: string; status: SubmissionStatus }
  >({
    mutationFn: ({ id, status }) =>
      apiFetch<AdminSubmissionSummary>(`/admin/submissions/${id}/status`, {
        method: "POST",
        body: { status },
      }),
    onSuccess: (data) => {
      // Update the detail cache in place
      qc.setQueryData<AdminSubmissionDetail | undefined>(
        ["submissions", "detail", data.id],
        (old) => (old ? { ...old, status: data.status } : old),
      );
      // And bust every list query so the badge updates everywhere
      qc.invalidateQueries({ queryKey: ["submissions"], exact: false });
    },
  });
}

export function useFinalizeErasure() {
  const qc = useQueryClient();
  return useMutation<
    { id: string; status: SubmissionStatus; finalized_at: string; finalized_by: string },
    Error,
    { id: string }
  >({
    mutationFn: ({ id }) =>
      apiFetch(`/admin/submissions/${id}/erase`, { method: "POST" }),
    onSuccess: (data) => {
      // Detail cache — replace the identity fields with null to match the DB.
      qc.setQueryData<AdminSubmissionDetail | undefined>(
        ["submissions", "detail", data.id],
        (old) =>
          old
            ? {
                ...old,
                status: data.status,
                name: null,
                phone: null,
                phone_hash: null,
              }
            : old,
      );
      qc.invalidateQueries({ queryKey: ["submissions"], exact: false });
    },
  });
}

export function useNotificationsConfig() {
  return useQuery({
    queryKey: ["settings", "notifications"],
    queryFn: () =>
      apiFetch<NotificationsConfigOut>("/admin/settings/notifications"),
    staleTime: 60_000,
  });
}

export function useUpdateNotificationsConfig() {
  const qc = useQueryClient();
  return useMutation<
    NotificationsConfigOut,
    Error,
    NotificationsConfigIn
  >({
    mutationFn: (body) =>
      apiFetch<NotificationsConfigOut>("/admin/settings/notifications", {
        method: "PUT",
        body,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["settings", "notifications"], data);
    },
  });
}

export function useTestNotification() {
  return useMutation<
    TestNotificationResponse,
    Error,
    TestNotificationRequest
  >({
    mutationFn: (body) =>
      apiFetch<TestNotificationResponse>(
        "/admin/settings/notifications/test",
        { method: "POST", body },
      ),
  });
}

// Tokens 

function tokenFiltersToQuery(f: TokensListFilters): string {
  const p = new URLSearchParams();
  if (f.statuses) f.statuses.forEach((s) => p.append("status", s));
  if (f.mode) p.set("mode", f.mode);
  if (f.kind) p.set("kind", f.kind);
  if (f.limit) p.set("limit", String(f.limit));
  if (f.before_id) p.set("before_id", f.before_id);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function useTokensList(filters: TokensListFilters) {
  return useQuery({
    queryKey: ["tokens", filters],
    queryFn: () =>
      apiFetch<TokenListResponse>(`/admin/tokens${tokenFiltersToQuery(filters)}`),
    staleTime: 30_000,
  });
}


export function useSubmissionStats() {
  return useQuery({
    queryKey: ["submissions", "stats"],
    queryFn: () =>
      apiFetch<AdminSubmissionStatsResponse>("/admin/submissions/stats"),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}


export function useMintLinkToken() {
  const qc = useQueryClient();
  return useMutation<CreateTokenResponse, Error, MintTokenRequest>({
    mutationFn: (body) =>
      apiFetch<CreateTokenResponse>("/admin/tokens", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tokens"], exact: false });
    },
  });
}

export function useTransitionTokenStatus() {
  const qc = useQueryClient();
  return useMutation<
    TokenSummary,
    Error,
    { id: string; status: TokenStatus; reason?: string }
  >({
    mutationFn: ({ id, status, reason }) =>
      apiFetch<TokenSummary>(`/admin/tokens/${id}/status`, {
        method: "POST",
        body: { status, reason: reason ?? null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tokens"], exact: false });
    },
  });
}

// Modes (read-only for now — needed by tokens page + active-mode switcher)

export function useModesList(statuses?: string[]) {
  const p = new URLSearchParams();
  statuses?.forEach((s) => p.append("status", s));
  const q = p.toString();
  return useQuery({
    queryKey: ["modes", statuses ?? []],
    queryFn: () =>
      apiFetch<ModeListResponse>(`/admin/modes${q ? `?${q}` : ""}`),
    staleTime: 60_000,
  });
}

// Active mode

export function useActiveMode() {
  return useQuery({
    queryKey: ["active-mode"],
    queryFn: () => apiFetch<ActiveModeResponse>("/admin/mode/active"),
    staleTime: 30_000,
  });
}

export function useSetActiveMode() {
  const qc = useQueryClient();
  return useMutation<ActiveModeResponse, Error, { mode: string }>({
    mutationFn: (body) =>
      apiFetch<ActiveModeResponse>("/admin/mode/active", {
        method: "POST",
        body,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["active-mode"], data);
    },
  });
}



export function useModes(statuses?: string[]) {
  return useQuery({
    queryKey: ["admin-modes", statuses ?? []],
    queryFn: async () => {
      const params = new URLSearchParams();
      (statuses ?? []).forEach((s) => params.append("status", s));
      const qs = params.toString();
      const res = await fetch(
        `/api/admin/modes${qs ? `?${qs}` : ""}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("failed to load modes");
      return (await res.json()) as ModeListResponse;
    },
  });
}

export function useTransitionModeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      name: string;
      status: "active" | "inactive" | "archived";
    }) => {
      const res = await fetch(`/api/admin/modes/${v.name}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: v.status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-modes"] }),
  });
}

export function usePurgeMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string }) => {
      const res = await fetch(
        `/api/admin/modes/${v.name}?confirm=true`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      return null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-modes"] }),
  });
}



export function useAdminConversations(unreadOnly = false) {
  const p = new URLSearchParams();
  if (unreadOnly) p.set("unread_only", "true");
  return useQuery({
    queryKey: ["admin-conversations", unreadOnly],
    queryFn: () =>
      apiFetch<AdminConversationListResponse>(
        `/admin/chat/conversations${p.toString() ? `?${p}` : ""}`,
      ),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useAdminMessages(id: string | undefined, beforeId?: string) {
  const p = new URLSearchParams();
  p.set("limit", "50");
  if (beforeId) p.set("before_id", beforeId);
  return useQuery({
    queryKey: ["admin-messages", id, beforeId],
    queryFn: () =>
      apiFetch<MessageListResponse>(
        `/admin/chat/conversations/${id}/messages?${p.toString()}`,
      ),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useAdminSendMessage(id: string | undefined) {
  return useMutation<{ message: ChatMessage }, Error, { content: string }>({
    mutationFn: (body) =>
      apiFetch<{ message: ChatMessage }>(
        `/admin/chat/conversations/${id}/messages`,
        { method: "POST", body },
      ),
  });
}

export function useAdminMarkRead(id: string | undefined) {
  return useMutation<{ marked: number }, Error, { message_ids: string[] }>({
    mutationFn: (body) =>
      apiFetch<{ marked: number }>(
        `/admin/chat/conversations/${id}/read`,
        { method: "POST", body },
      ),
  });
}

export function useAdminTyping(id: string | undefined) {
  return useMutation<{ ok: boolean }, Error, { is_typing: boolean }>({
    mutationFn: ({ is_typing }) =>
      apiFetch<{ ok: boolean }>(
        `/admin/chat/conversations/${id}/typing?is_typing=${is_typing}`,
        { method: "POST" },
      ),
  });
}

export function useToggleReceipts(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<any, Error, { enabled: boolean }>({
    mutationFn: (body) =>
      apiFetch(
        `/admin/chat/conversations/${id}/receipts`,
        { method: "POST", body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
    },
  });
}

export function useOwnerStatus() {
  return useQuery({
    queryKey: ["owner-status"],
    queryFn: () => apiFetch<OwnerStatusOut>("/admin/chat/status"),
    staleTime: 30_000,
  });
}

export function useSetOwnerStatus() {
  const qc = useQueryClient();
  return useMutation<OwnerStatusOut, Error, { status: OwnerStatus }>({
    mutationFn: (body) =>
      apiFetch<OwnerStatusOut>("/admin/chat/status", { method: "PUT", body }),
    onSuccess: (data) => {
      qc.setQueryData(["owner-status"], data);
    },
  });
}