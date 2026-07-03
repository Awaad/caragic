import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Layers } from "lucide-react";
import {
  useActiveMode,
  useModesList,
  useSetActiveMode,
} from "@/api/hooks";
import { cn } from "@/lib/utils";

/**
 * Persistent header dropdown. Shows the currently active mode; opens a menu
 * of active modes; clicking one calls set_active_mode and closes.
 *
 * The active mode is the daily-use switcher — you flip it constantly from
 * your phone. Kept close-at-hand in the header for that reason.
 */
export function ActiveModeSwitcher() {
  const active = useActiveMode();
  const modes = useModesList(["active"]);
  const setActive = useSetActiveMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentMode = active.data?.mode ?? "…";
  const availableModes = modes.data?.modes ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        disabled={setActive.isPending}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs transition-colors",
          "hover:bg-accent hover:text-foreground",
          "disabled:opacity-50",
          open && "bg-accent",
        )}
      >
        <Layers className="h-3 w-3 text-primary" />
        <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest hidden sm:inline">
          mode
        </span>
        <span className="font-mono font-medium tabular-nums">
          {setActive.isPending ? "…" : currentMode}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-border bg-popover shadow-lg shadow-black/40 py-1 animate-fade-in z-30">
          <div className="px-3 py-1.5 border-b border-border/50 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            Active mode
          </div>
          {availableModes.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground/60 font-mono">
              no active modes
            </div>
          ) : (
            availableModes.map((m) => {
              const isCurrent = m.name === currentMode;
              return (
                <button
                  key={m.name}
                  onClick={() => {
                    setOpen(false);
                    if (!isCurrent) {
                      setActive.mutate({ mode: m.name });
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors",
                    isCurrent
                      ? "text-primary"
                      : "text-foreground hover:bg-accent/50",
                  )}
                >
                  <span className="font-mono">{m.name}</span>
                  {isCurrent && <Check className="h-3 w-3" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}