import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Link2,
  Layers,
  Settings,
  Sparkles,
  X,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubmissionStats } from "@/api/hooks";
import { useAdminConversations } from "@/api/hooks";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/submissions", label: "Submissions", icon: Inbox },
  { to: "/tokens", label: "Tokens", icon: Link2 },
  { to: "/modes", label: "Modes", icon: Layers },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Backdrop — mobile only, dims scene when drawer open */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        />
      )}

      {/* The sidebar itself.
          - md+: static column, always visible (matches original layout)
          - <md: fixed drawer, slides in when mobileOpen */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card/90 backdrop-blur-sm",
          "md:static md:w-60 md:translate-x-0 md:shadow-none",
          "fixed inset-y-0 left-0 z-50 w-64 shadow-2xl transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="h-16 px-6 flex items-center justify-between gap-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.5} />
            <span className="text-sm font-semibold tracking-tight">Caragic</span>
            <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              admin
            </span>
          </div>
          {/* Close only on mobile drawer */}
          <button
            onClick={onClose}
            className="md:hidden text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              onClick={onClose}
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
              <span className="flex-1">{label}</span>
              {to === "/submissions" && <PendingPill />}
              {to === "/chats" && <ChatUnreadPill />}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            v0.1.0 · dev
          </p>
        </div>
      </aside>
    </>
  );
}

function PendingPill() {
  const { data } = useSubmissionStats();
  if (!data || data.pending === 0) return null;
  
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary tabular-nums">
      {data.pending}
    </span>
  );
}

function ChatUnreadPill() {
  const { data } = useAdminConversations(true);
  if (!data || data.conversations.length === 0) return null;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary tabular-nums">
      {data.conversations.length}
    </span>
  );
}