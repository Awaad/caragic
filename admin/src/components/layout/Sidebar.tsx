import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Link2,
  Layers,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/submissions", label: "Submissions", icon: Inbox },
  { to: "/tokens", label: "Tokens", icon: Link2 },
  { to: "/modes", label: "Modes", icon: Layers },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 flex-col border-r border-border bg-card/40 backdrop-blur-sm">
      {/* Brand */}
      <div className="h-16 px-6 flex items-center gap-2 border-b border-border">
        <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.5} />
        <span className="text-sm font-semibold tracking-tight">Caragic</span>
        <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                isActive &&
                  "bg-accent text-foreground font-medium shadow-sm shadow-primary/5",
              )
            }
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
          v0.1.0 · dev
        </p>
      </div>
    </aside>
  );
}