import { useState, useRef, useEffect } from "react";
import { ChevronDown, Circle } from "lucide-react";
import { useOwnerStatus, useSetOwnerStatus } from "@/api/hooks";
import type { OwnerStatus } from "@/api/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<OwnerStatus, string> = {
  available: "text-success",
  away: "text-warning",
  busy: "text-destructive",
  offline: "text-muted-foreground",
};

const OPTIONS: OwnerStatus[] = ["available", "away", "busy", "offline"];

export function OwnerStatusSwitcher() {
  const status = useOwnerStatus();
  const set = useSetOwnerStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const current = status.data?.status ?? "offline";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs transition-colors",
          "hover:bg-accent",
          open && "bg-accent",
        )}
      >
        <Circle className={cn("h-2 w-2 fill-current", STATUS_COLORS[current])} />
        <span className="font-mono">{current}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-40 rounded-md border border-border bg-popover shadow-lg py-1 z-30">
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                set.mutate({ status: opt });
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50"
            >
              <Circle className={cn("h-2 w-2 fill-current", STATUS_COLORS[opt])} />
              <span className="font-mono">{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}