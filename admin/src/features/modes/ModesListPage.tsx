import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Filter, ChevronDown, Plus } from "lucide-react";
import { useModes, useTransitionModeStatus, usePurgeMode } from "@/api/hooks";
import { ModeStatusBadge } from "./ModeStatusBadge";
import { cn } from "@/lib/utils";

/**
 * Modes inbox. Read + status transitions, the editor for a mode's
 * rounds/reveal lives on the detail page and have edit
 *
 * "Show archived" is a toggle rather than a full multi-select filter —
 * modes are few, filtering is overkill.
 */
export function ModesListPage() {
  const [showArchived, setShowArchived] = useState(false);

  const statuses = showArchived
    ? ["active", "inactive", "archived"]
    : ["active", "inactive"];

  const { data, isLoading, error } = useModes(statuses);

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Question sets your card can serve.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Filter className="h-3.5 w-3.5" />
          filter
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground font-mono cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          show archived
        </label>
        <Link
            to="/modes/new"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-primary/40 bg-primary/10 text-sm text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            new mode
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
        {isLoading ? (
          <TableEmpty message="loading…" />
        ) : error ? (
          <TableEmpty message="couldn't load modes" tone="error" />
        ) : !data || data.modes.length === 0 ? (
          <TableEmpty message="no modes" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <Th>Name</Th>
                <Th>Status</Th>
                <Th className="text-right">Rounds</Th>
                <Th>Updated</Th>
                <Th className="text-right" />
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.modes.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  <Td>
                    <span className="font-mono text-sm">{m.name}</span>
                  </Td>
                  <Td>
                    <ModeStatusBadge status={m.status} />
                  </Td>
                  <Td className="text-right text-muted-foreground font-mono text-xs">
                    {m.round_count}
                  </Td>
                  <Td className="text-muted-foreground font-mono text-xs">
                    {new Date(m.updated_at).toLocaleDateString()}
                  </Td>
                  <Td className="text-right">
                    <ActionsMenu mode={m.name} status={m.status} />
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/modes/${m.name}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      open
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * Per-row actions dropdown. Transitions the backend allows:
 *   active   → inactive, archived
 *   inactive → active, archived
 *   archived → active, purge (permanent)
 *
 * Purge is destructive and terminal; guarded by a two-step confirm inside
 * the menu itself so the row doesn't need a separate expanded state.
 */
function ActionsMenu({
  mode,
  status,
}: {
  mode: string;
  status: "active" | "inactive" | "archived";
}) {
  const [open, setOpen] = useState(false);
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  const transition = useTransitionModeStatus();
  const purge = usePurgeMode();

  const close = () => {
    setOpen(false);
    setConfirmingPurge(false);
  };

  const runTransition = (target: "active" | "inactive" | "archived") => {
    close();
    transition.mutate({ name: mode, status: target });
  };

  const runPurge = () => {
    purge.mutate({ name: mode }, { onSettled: close });
  };

  const items: {
    key: string;
    label: string;
    onClick: () => void;
    tone?: "destructive";
    disabled?: boolean;
    hint?: string;
  }[] = [];

  if (status !== "active") {
    items.push({
      key: "activate",
      label: "Activate",
      onClick: () => runTransition("active"),
    });
  }
  if (status === "active") {
    items.push({
      key: "deactivate",
      label: "Deactivate",
      onClick: () => runTransition("inactive"),
    });
  }
  if (status !== "archived") {
    items.push({
      key: "archive",
      label: "Archive",
      onClick: () => runTransition("archived"),
    });
  }
  if (status === "archived") {
    items.push({
      key: "purge",
      label: confirmingPurge ? "Confirm purge" : "Purge",
      onClick: () => {
        if (confirmingPurge) runPurge();
        else setConfirmingPurge(true);
      },
      tone: "destructive",
      hint: confirmingPurge ? "this cannot be undone" : undefined,
    });
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen((s) => !s)}
        disabled={transition.isPending || purge.isPending}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors",
          "hover:bg-accent hover:text-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "bg-accent",
        )}
      >
        {transition.isPending || purge.isPending ? "…" : "actions"}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          {/* click-outside catcher */}
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-border bg-popover shadow-lg shadow-black/40 py-1 z-20 animate-fade-in">
            {items.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-muted-foreground/60 font-mono">
                no actions
              </div>
            ) : (
              items.map((it) => (
                <button
                  key={it.key}
                  onClick={it.onClick}
                  disabled={it.disabled}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs transition-colors block",
                    it.disabled
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : it.tone === "destructive"
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-foreground hover:bg-accent/50",
                  )}
                >
                  <div>{it.label}</div>
                  {it.hint && (
                    <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                      {it.hint}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}

function TableEmpty({
  message,
  tone,
}: {
  message: string;
  tone?: "error";
}) {
  return (
    <div
      className={cn(
        "py-16 text-center text-sm font-mono",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {message}
    </div>
  );
}