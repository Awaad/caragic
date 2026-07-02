import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, KeyRound } from "lucide-react";
import { useLogin, useWhoAmI } from "@/api/hooks";
import { ApiError } from "@/api/client";

interface LocationState {
  from?: string;
  reason?: "unauth" | "error";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  // If already logged in, don't show the login page — bounce to intended dest.
  // Uses the same query; if it succeeded before mount, we redirect immediately.
  const whoami = useWhoAmI();
  const login = useLogin();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");

  if (whoami.data) {
    return <Navigate to={state?.from ?? "/dashboard"} replace />;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { username, password, totp_code: totp },
      {
        onSuccess: () => {
          navigate(state?.from ?? "/dashboard", { replace: true });
        },
      },
    );
  };

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? "invalid credentials or TOTP code"
        : login.error.message
      : login.error?.message;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Sparkles className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <span className="text-base font-semibold tracking-tight">
            Caragic
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            admin
          </span>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-6 shadow-xl shadow-primary/5">
          <div className="mb-6">
            <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Password and authenticator code required.
            </p>
          </div>

          {/* Redirect reason banner */}
          {state?.reason === "unauth" && !login.isError && (
            <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Session expired. Please sign in again.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
              />
            </div>

            <div>
              <label
                htmlFor="totp"
                className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              >
                <KeyRound className="h-3 w-3" />
                Authenticator code
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={(e) =>
                  setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoComplete="one-time-code"
                required
                placeholder="000000"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow font-mono tracking-[0.4em] text-center"
              />
            </div>

            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={
                login.isPending || !username || !password || totp.length !== 6
              }
              className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {login.isPending ? "signing in…" : "sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mt-6">
          authorized personnel only
        </p>
      </div>
    </div>
  );
}
