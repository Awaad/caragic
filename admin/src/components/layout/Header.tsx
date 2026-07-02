import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useWhoAmI, useLogout } from "@/api/hooks";
import { cn } from "@/lib/utils";

export function Header() {
  const whoami = useWhoAmI();
  const logout = useLogout();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        navigate("/login", { replace: true });
      },
      onError: () => {
        // Even if the logout call fails, force the guard to re-check by
        // navigating — next request will 401 and land the user on login.
        navigate("/login", { replace: true });
      },
    });
  };

  return (
    <header className="h-16 border-b border-border bg-card/30 backdrop-blur-sm">
      <div className="h-full px-6 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-4">
          {/* Chunk D slot: active mode switcher */}

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((s) => !s)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                menuOpen && "bg-accent text-foreground",
              )}
            >
              <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                <User className="h-3 w-3 text-primary" />
              </div>
              <span className="font-mono text-xs">
                {whoami.data?.username ?? "…"}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-border bg-popover shadow-lg shadow-black/40 py-1 animate-fade-in">
                <button
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{logout.isPending ? "signing out…" : "sign out"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
