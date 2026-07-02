import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useWhoAmI } from "@/api/hooks";
import { ApiError } from "@/api/client";
import { Sparkles } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Blocks the shell until whoami resolves. Three states:
 *   - loading  → brand-consistent spinner
 *   - 401      → redirect to /login, preserving intended path for post-login redirect
 *   - success  → render children
 * Any other error (500, network) also redirects to login rather than trap the
 * user in a broken shell — login page itself will surface the real error.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { data, isLoading, error } = useWhoAmI();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          <span className="text-sm font-mono">checking session…</span>
        </div>
      </div>
    );
  }

  if (error) {
    const isUnauth = error instanceof ApiError && error.status === 401;
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          reason: isUnauth ? "unauth" : "error",
        }}
      />
    );
  }

  if (!data) {
    // Shouldn't hit either loading/error/data. Defensive.
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
