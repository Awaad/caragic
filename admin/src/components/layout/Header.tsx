import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Menu } from "lucide-react";
import { useWhoAmI, useLogout } from "@/api/hooks";
import { cn } from "@/lib/utils";
import { ActiveModeSwitcher } from "./ActiveModeSwitcher";
import { OwnerStatusSwitcher } from "./OwnerStatusSwitcher";



export function Header({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const whoami = useWhoAmI();
  const logout = useLogout();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      onSuccess: () => navigate("/login", { replace: true }),
      onError: () => navigate("/login", { replace: true }),
    });
  };

  return (
    <header className="h-16 border-b border-border bg-card/30 backdrop-blur-sm">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-3">
        {/* Left — hamburger on mobile */}
        <button
          onClick={onOpenMobileNav}
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right — mode + user */}
        <div className="flex items-center gap-2 md:gap-4">
          <OwnerStatusSwitcher />
          <ActiveModeSwitcher />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((s) => !s)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 md:px-3 py-1.5 text-sm transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                menuOpen && "bg-accent text-foreground",
              )}
            >
              <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                <User className="h-3 w-3 text-primary" />
              </div>
              <span className="font-mono text-xs hidden sm:inline">
                {whoami.data?.username ?? "…"}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-border bg-popover shadow-lg shadow-black/40 py-1 animate-fade-in z-30">
                <div className="sm:hidden px-3 py-1.5 border-b border-border/50 text-xs font-mono text-muted-foreground">
                  {whoami.data?.username ?? "…"}
                </div>
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