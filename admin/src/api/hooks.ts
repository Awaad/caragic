import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "./client";
import type { WhoAmIResponse } from "./types";

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

interface LoginRequest {
  username: string;
  password: string;
  totp_code: string;
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