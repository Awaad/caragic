import { useSearchParams, Link } from "react-router-dom";
import { useSubmissionsList } from "@/api/hooks";
import type { SubmissionStatus } from "@/api/types";
import { OutcomeBadge, StatusBadge, ModeBadge } from "./badges";
import { cn } from "@/lib/utils";
import { ChevronRight, Filter, Inbox as InboxIcon } from "lucide-react";

const ALL_STATUSES: SubmissionStatus[] = [
  "pending",
  "read",
  "archived",
  "erase_requested",
  "erased",
];

const ALL_MODES = ["dating", "friendship", "professional", "mix"];

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - then) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SubmissionsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get("mode") ?? undefined;
  const outcome = (searchParams.get("outcome") as
    | "submitted"
    | "declined"
    | null) ?? undefined;
  const statuses = searchParams.getAll("status") as SubmissionStatus[];
  const before_id = searchParams.get("before_id") ?? undefined;

  const { data, isLoading, error } = useSubmissionsList({
    mode,
    outcome,
    statuses: statuses.length ? statuses : undefined,
    before_id,
    limit: 50,
  });

  // Update one filter key; clears cursor since filter change invalidates pagination. 
  const updateFilter = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("before_id"); // pagination cursor tied to old filters
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  };

  // Multi-value filter (statuses). 
  const toggleStatus = (s: SubmissionStatus) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("before_id");
      const current = prev.getAll("status");
      if (current.includes(s)) {
        next.delete("status");
        current.filter((x) => x !== s).forEach((x) => next.append("status", x));
      } else {
        next.append("status", s);
      }
      return next;
    });
  };

  const nextPage = () => {
    if (!data?.next_cursor) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("before_id", data.next_cursor!);
      return next;
    });
  };

  const resetToFirstPage = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("before_id");
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasFilters =
    !!mode ||
    !!outcome ||
    statuses.length > 0 ||
    !!before_id;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everyone who's tapped your card.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-start gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Filter className="h-3.5 w-3.5" />
          filter
        </div>

        <FilterGroup label="mode">
          <FilterChip
            active={!mode}
            onClick={() => updateFilter("mode", null)}
          >
            all
          </FilterChip>
          {ALL_MODES.map((m) => (
            <FilterChip
              key={m}
              active={mode === m}
              onClick={() => updateFilter("mode", m)}
            >
              {m}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="outcome">
          <FilterChip
            active={!outcome}
            onClick={() => updateFilter("outcome", null)}
          >
            all
          </FilterChip>
          <FilterChip
            active={outcome === "submitted"}
            onClick={() => updateFilter("outcome", "submitted")}
          >
            submitted
          </FilterChip>
          <FilterChip
            active={outcome === "declined"}
            onClick={() => updateFilter("outcome", "declined")}
          >
            declined
          </FilterChip>
        </FilterGroup>

        <FilterGroup label="status">
          {ALL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statuses.includes(s)}
              onClick={() => toggleStatus(s)}
            >
              {s.replace("_", " ")}
            </FilterChip>
          ))}
        </FilterGroup>

        {hasFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 self-center"
          >
            clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
        {isLoading ? (
          <TableEmpty message="loading…" />
        ) : error ? (
          <TableEmpty message="couldn't load submissions" tone="error" />
        ) : !data || data.submissions.length === 0 ? (
          <TableEmpty
            message={
              hasFilters
                ? "no submissions match these filters"
                : "no submissions yet"
            }
            icon
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <Th>When</Th>
                <Th>Mode</Th>
                <Th>Outcome</Th>
                <Th>Status</Th>
                <Th className="text-right">Answers</Th>
                <Th className="text-right">Attempt</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  <Td className="text-muted-foreground">
                    {formatRelative(s.created_at)}
                  </Td>
                  <Td>
                    <ModeBadge mode={s.mode} />
                  </Td>
                  <Td>
                    <OutcomeBadge outcome={s.outcome} />
                  </Td>
                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                  <Td className="text-right text-muted-foreground font-mono text-xs">
                    {s.answer_count}
                  </Td>
                  <Td className="text-right text-muted-foreground font-mono text-xs">
                    #{s.attempt_number}
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={{
                        pathname: `/submissions/${s.id}`,
                        search: searchParams.toString(),
                      }}
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

      {/* Pagination */}
      {data && data.submissions.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {before_id ? (
              <button
                onClick={resetToFirstPage}
                className="hover:text-foreground underline decoration-dotted underline-offset-4"
              >
                ← first page
              </button>
            ) : (
              <span>page 1</span>
            )}
          </div>
          {data.next_cursor && (
            <button
              onClick={nextPage}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              next page
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Local primitives

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest mr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded text-[11px] font-mono uppercase tracking-wider border transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-muted-foreground/40",
      )}
    >
      {children}
    </button>
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
  icon,
  tone,
}: {
  message: string;
  icon?: boolean;
  tone?: "error";
}) {
  return (
    <div
      className={cn(
        "py-16 text-center text-sm font-mono",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {icon && (
        <InboxIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
      )}
      {message}
    </div>
  );
}