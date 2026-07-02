import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "./client";
import type {
  WhoAmIResponse,
  AdminSubmissionDetail,
  AdminSubmissionListResponse,
  AdminSubmissionSummary,
  SubmissionStatus,
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