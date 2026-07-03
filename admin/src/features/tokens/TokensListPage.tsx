import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Link2, Filter, MoreVertical } from "lucide-react";
import {
  useTokensList,
  useTransitionTokenStatus,
  useModesList,
} from "@/api/hooks";
import type { TokenStatus, TokenKind, TokenSummary } from "@/api/types";
import { TokenStatusBadge, TokenKindBadge } from "./badges";
import { ModeBadge } from "../submissions/badges";
import { MintTokenDialog } from "./MintTokenDialog";
import { cn } from "@/lib/utils";

const ALL_STATUSES: TokenStatus[] = ["active", "inactive", "revoked"];
const ALL_KINDS: TokenKind[] = ["card", "link"];

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function TokensListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mintOpen, setMintOpen] = useState(false);

  const kind = (searchParams.get("kind") as TokenKind | null) ?? undefined;
  const mode = searchParams.get("mode") ?? undefined;
  const statuses = searchParams.getAll("status") as TokenStatus[];

  const modes = useModesList();
  const tokens = useTokensList({
    kind,
    mode,
    statuses: statuses.length ? statuses : undefined,
  });

  const setFilter = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    });
  };

  const toggleStatus = (s: TokenStatus) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
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

  const clearFilters = () => setSearchParams(new URLSearchParams());
  const hasFilters = !!kind || !!mode || statuses.length > 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tokens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            NFC card tokens (minted on tap) and shareable link tokens.
          </p>
        </div>
        <button
          onClick={() => setMintOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          mint link
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-start gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Filter className="h-3.5 w-3.5" />
          filter
        </div>

        <FilterGroup label="kind">
          <FilterChip active={!kind} onClick={() => setFilter("kind", null)}>
            all
          </FilterChip>
          {ALL_KINDS.map((k) => (
            <FilterChip
              key={k}
              active={kind === k}
              onClick={() => setFilter("kind", k)}
            >
              {k}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="mode">
          <FilterChip active={!mode} onClick={() => setFilter("mode", null)}>
            all
          </FilterChip>
          {modes.data?.modes.map((m) => (
            <FilterChip
              key={m.name}
              active={mode === m.name}
              onClick={() => setFilter("mode", m.name)}
            >
              {m.name}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="status">
          {ALL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statuses.includes(s)}
              onClick={() => toggleStatus(s)}
            >
              {s}
            </FilterChip>
          ))}
        </FilterGroup>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 self-center"
          >
            clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
        {tokens.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground font-mono">
            loading…
          </div>
        ) : !tokens.data || tokens.data.tokens.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground font-mono">
            <Link2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            {hasFilters
              ? "no tokens match these filters"
              : "no tokens yet — mint one above"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <Th>Kind</Th>
                  <Th>Mode</Th>
                  <Th>Label</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Taps</Th>
                  <Th>Last used</Th>
                  <Th>Created</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {tokens.data.tokens.map((t) => (
                  <TokenRow key={t.id} token={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MintTokenDialog open={mintOpen} onClose={() => setMintOpen(false)} />
    </div>
  );
}

function TokenRow({ token }: { token: TokenSummary }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<TokenStatus | null>(null);
  const transition = useTransitionTokenStatus();

  const validTransitions: TokenStatus[] = (() => {
    // Revoked is terminal
    if (token.status === "revoked") return [];
    // Active → inactive or revoked
    if (token.status === "active") return ["inactive", "revoked"];
    // Inactive → active or revoked
    return ["active", "revoked"];
  })();

  return (
    <tr className="border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors">
      <Td>
        <TokenKindBadge kind={token.kind} />
      </Td>
      <Td>
        <ModeBadge mode={token.mode} />
      </Td>
      <Td className="text-muted-foreground">
        {token.label ?? <span className="text-muted-foreground/40">—</span>}
      </Td>
      <Td>
        <TokenStatusBadge status={token.status} />
      </Td>
      <Td className="text-right text-muted-foreground font-mono text-xs tabular-nums">
        {token.tap_count}
      </Td>
      <Td className="text-muted-foreground text-xs">
        {formatRelative(token.last_used_at)}
      </Td>
      <Td className="text-muted-foreground text-xs">
        {formatRelative(token.created_at)}
      </Td>
      <Td className="text-right relative">
        {confirming ? (
          <ConfirmChip
            target={confirming}
            onConfirm={() => {
              transition.mutate(
                { id: token.id, status: confirming },
                { onSuccess: () => setConfirming(null) },
              );
            }}
            onCancel={() => setConfirming(null)}
            isPending={transition.isPending}
          />
        ) : (
          validTransitions.length > 0 && (
            <div className="relative inline-block">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-md border border-border bg-popover shadow-lg py-1 z-20">
                    {validTransitions.map((target) => (
                      <button
                        key={target}
                        onClick={() => {
                          setMenuOpen(false);
                          if (target === "revoked") {
                            setConfirming(target);
                          } else {
                            transition.mutate({
                              id: token.id,
                              status: target,
                            });
                          }
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-xs transition-colors",
                          target === "revoked"
                            ? "text-destructive hover:bg-destructive/10"
                            : "text-foreground hover:bg-accent/50",
                        )}
                      >
                        {target === "revoked" ? "Revoke" : `Mark ${target}`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        )}
      </Td>
    </tr>
  );
}

function ConfirmChip({
  target,
  onConfirm,
  onCancel,
  isPending,
}: {
  target: TokenStatus;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-destructive mr-1">
        revoke?
      </span>
      <button
        onClick={onConfirm}
        disabled={isPending}
        className="rounded border border-destructive/50 bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider hover:bg-destructive/20 disabled:opacity-50"
      >
        {isPending ? "…" : "yes"}
      </button>
      <button
        onClick={onCancel}
        disabled={isPending}
        className="rounded border border-border text-muted-foreground px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider hover:text-foreground"
      >
        no
      </button>
    </div>
  );
}

// Local table primitives

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
