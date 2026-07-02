import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useSubmissionDetail,
  useTransitionSubmissionStatus,
  useFinalizeErasure,
} from "@/api/hooks";
import type { SubmissionStatus, SubmissionOutcome } from "@/api/types";
import { OutcomeBadge, StatusBadge, ModeBadge } from "./badges";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Check,
  Phone,
  User,
  Hash,
  Trash2,
} from "lucide-react";

const TRANSITIONS: {
  target: SubmissionStatus;
  label: string;
  disabledReason?: string;
}[] = [
  { target: "pending", label: "Mark as pending" },
  { target: "read", label: "Mark as read" },
  { target: "archived", label: "Archive" },
];

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data, isLoading, error } = useSubmissionDetail(id);
  const transition = useTransitionSubmissionStatus();

  const [copied, setCopied] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    },
    [],
  );

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopied(null), 1500);
  };

  const backToList = () => {
    const search = searchParams.toString();
    navigate(search ? `/submissions?${search}` : "/submissions");
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in text-sm text-muted-foreground font-mono">
        loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={backToList}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          back to submissions
        </button>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          couldn't load submission
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Back nav */}
      <button
        onClick={backToList}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        back to submissions
      </button>

      {/* Header row */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <OutcomeBadge outcome={data.outcome} />
            <StatusBadge status={data.status} />
            <ModeBadge mode={data.mode} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.outcome === "submitted" && data.name
              ? data.name
              : "Declined submission"}
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {new Date(data.created_at).toLocaleString()} · attempt #
            {data.attempt_number}
          </p>
        </div>

        <StatusMenu
          current={data.status}
          onSelect={(target) =>
            transition.mutate({ id: data.id, status: target })
          }
          isPending={transition.isPending}
        />
      </div>

      {/* Body — two columns on wide, stacked on narrow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — identity + IDs */}
        <div className="lg:col-span-1 space-y-4">
          {data.outcome === "submitted" ? (
            <Card title="Identity">
              <Field
                icon={User}
                label="name"
                value={data.name ?? "—"}
                onCopy={data.name ? () => copy(data.name!, "name") : undefined}
                copied={copied === "name"}
              />
              <Field
                icon={Phone}
                label="phone"
                value={data.phone ?? "—"}
                onCopy={
                  data.phone ? () => copy(data.phone!, "phone") : undefined
                }
                copied={copied === "phone"}
                mono
              />
            </Card>
          ) : (
            <Card title="Identity">
              <p className="text-xs text-muted-foreground font-mono">
                no identity — visitor declined
              </p>
            </Card>
          )}

          <Card title="Trace">
            <Field
              icon={Hash}
              label="submission id"
              value={data.id}
              onCopy={() => copy(data.id, "id")}
              copied={copied === "id"}
              mono
              truncate
            />
            <Field
              icon={Hash}
              label="visitor id"
              value={data.visitor_id}
              onCopy={() => copy(data.visitor_id, "visitor")}
              copied={copied === "visitor"}
              mono
              truncate
            />
            <Field
              icon={Hash}
              label="session id"
              value={data.session_id}
              onCopy={() => copy(data.session_id, "session")}
              copied={copied === "session"}
              mono
              truncate
            />
            <Field
              icon={Hash}
              label="token id"
              value={data.token_id}
              onCopy={() => copy(data.token_id, "token")}
              copied={copied === "token"}
              mono
              truncate
            />
          </Card>

          {data.status !== "erased" && (
            <EraseButton
              submissionId={data.id}
              status={data.status}
              outcome={data.outcome}
            />
          )}
        </div>

        {/* Right column — answers */}
        <div className="lg:col-span-2">
          <Card title="Answers" contentClassName="!p-0">
            {data.answers.length === 0 ? (
              <p className="p-6 text-xs text-muted-foreground font-mono text-center">
                no answers recorded
              </p>
            ) : (
              <ol className="divide-y divide-border/50">
                {data.answers.map((a, i) => (
                  <li key={i} className="p-5">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">
                      round {i + 1} · {a.round_id}
                    </div>
                    {a.question ? (
                      <p className="text-sm text-foreground mb-3">
                        {a.question}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mb-3">
                        question unavailable
                      </p>
                    )}
                    <div className="pl-3 border-l-2 border-primary/40 space-y-2">
                      <p className="text-sm text-primary font-medium">
                        {a.option_label ?? (
                          <span className="text-muted-foreground/50 italic">
                            {a.option_id} — label unavailable
                          </span>
                        )}
                      </p>
                      {a.reveal_text && (
                        <p className="text-xs text-muted-foreground italic">
                          "{a.reveal_text}"
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Local primitives

function Card({
  title,
  children,
  contentClassName,
}: {
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/70 bg-muted/10">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className={cn("p-4 space-y-3", contentClassName)}>{children}</div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onCopy,
  copied,
  mono,
  truncate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-0.5">
          {label}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "text-sm text-foreground min-w-0",
              mono && "font-mono text-xs",
              truncate && "truncate",
            )}
            title={truncate ? value : undefined}
          >
            {value}
          </span>
          {onCopy && (
            <button
              onClick={onCopy}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="copy"
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusMenu({
  current,
  onSelect,
  isPending,
}: {
  current: SubmissionStatus;
  onSelect: (target: SubmissionStatus) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
          "hover:bg-accent hover:text-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "bg-accent",
        )}
      >
        {isPending ? "updating…" : "actions"}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-border bg-popover shadow-lg shadow-black/40 py-1 animate-fade-in z-10">
          {TRANSITIONS.map((t) => {
            const isCurrent = t.target === current;
            const disabled = isCurrent || !!t.disabledReason;
            return (
              <button
                key={t.target}
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onSelect(t.target);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                  disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-foreground hover:bg-accent/50",
                )}
              >
                <span>{t.label}</span>
                {isCurrent && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                    current
                  </span>
                )}
                {t.disabledReason && !isCurrent && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">
                    {t.disabledReason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EraseButton({
  submissionId,
  status,
  outcome,
}: {
  submissionId: string;
  status: SubmissionStatus;
  outcome: SubmissionOutcome;
}) {
  const erase = useFinalizeErasure();
  const [confirming, setConfirming] = useState(false);

  const isRequested = status === "erase_requested";
  const isDeclined = outcome === "declined";

  const label = isRequested ? "Finalize erasure" : "Erase identity";
  const helper = isRequested
    ? isDeclined
      ? "visitor requested erasure — finalize to mark this record as erased"
      : "visitor requested erasure — finalize to null identity fields"
    : isDeclined
      ? "mark this declined submission as erased. no PII to null."
      : "null name, phone, phone_hash. keeps answers + outcome.";

  if (confirming) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
        <p className="text-xs text-destructive font-medium">
          this cannot be undone.
        </p>
        <p className="text-[11px] text-muted-foreground">
          identity fields will be nulled. an audit log entry records the event.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() =>
              erase.mutate(
                { id: submissionId },
                { onSuccess: () => setConfirming(false) },
              )
            }
            disabled={erase.isPending}
            className="flex-1 rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-destructive/90 disabled:opacity-50 transition-opacity"
          >
            {erase.isPending ? "erasing…" : "confirm erase"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={erase.isPending}
            className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            cancel
          </button>
        </div>
        {erase.isError && (
          <p className="text-[11px] text-destructive">
            {erase.error?.message ?? "erasure failed"}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={cn(
        "w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-wider transition-colors",
        isRequested
          ? "border border-warning/50 bg-warning/10 text-warning hover:bg-warning/20"
          : "border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10",
      )}
      title={helper}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
