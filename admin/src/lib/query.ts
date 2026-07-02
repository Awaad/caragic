import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // 401/403/404/410/422 don't get better with retries
          if ([401, 403, 404, 410, 422].includes(error.status)) return false;
        }
        return failureCount < 2;
      },
    },
  },
});