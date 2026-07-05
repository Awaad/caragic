import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Hash, MessageSquare, UserPlus, Sparkles } from "lucide-react";
import { useModeDetail } from "@/api/hooks";
import { ModeStatusBadge } from "./ModeStatusBadge";
import type {
  RoundDetail,
  ChoiceRoundData,
  CaptureRoundData,
  RevealDetail,
} from "@/api/types";
import { cn } from "@/lib/utils";

/**
 * Read-only view of a mode's full content: header + rounds + reveal.
 *
 * The edit affordance is intentionally absent — inline editing is a
 * separate feature. This page is complete on its own as
 * an inspector for what the visitor sees.
 */
export function ModeDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useModeDetail(name);

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
          onClick={() => navigate("/modes")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          back to modes
        </button>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          couldn't load mode {name}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate("/modes")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        back to modes
      </button>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ModeStatusBadge status={data.status} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {data.rounds.length} round{data.rounds.length !== 1 && "s"}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">
            {data.name}
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            updated {new Date(data.updated_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Rounds" contentClassName="!p-0">
            {data.rounds.length === 0 ? (
              <p className="p-6 text-xs text-muted-foreground font-mono text-center">
                no rounds
              </p>
            ) : (
              <ol className="divide-y divide-border/50">
                {data.rounds.map((r, i) => (
                  <RoundRow key={r.id} round={r} index={i} />
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card title="Reveal">
            <RevealBlock reveal={data.reveal} />
          </Card>

          <Card title="Trace">
            <TraceField label="mode id" value={data.id} />
            <TraceField label="created" value={new Date(data.created_at).toLocaleString()} />
            <TraceField label="updated" value={new Date(data.updated_at).toLocaleString()} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function RoundRow({ round, index }: { round: RoundDetail; index: number }) {
  const isChoice = round.round_type === "choice";
  return (
    <li className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
          <Hash className="h-3 w-3" />
          round {index + 1}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest",
            isChoice
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          {isChoice ? (
            <MessageSquare className="h-2.5 w-2.5" />
          ) : (
            <UserPlus className="h-2.5 w-2.5" />
          )}
          {round.round_type}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/50">
          slug: {round.slug}
        </span>
      </div>

      {isChoice ? (
        <ChoiceRoundView data={round.data as ChoiceRoundData} />
      ) : (
        <CaptureRoundView data={round.data as CaptureRoundData} />
      )}
    </li>
  );
}

function ChoiceRoundView({ data }: { data: ChoiceRoundData }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">{data.question}</p>
      <div className="space-y-2">
        {data.options.map((o) => (
          <div
            key={o.id}
            className="pl-3 border-l-2 border-primary/40 space-y-1"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-primary font-medium">
                {o.label}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {o.id}
              </span>
            </div>
            <p className="text-xs text-muted-foreground italic">
              "{o.revealText}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaptureRoundView({ data }: { data: CaptureRoundData }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">{data.prompt}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
            accept
          </div>
          <div className="text-primary">{data.acceptLabel}</div>
        </div>
        <div className="rounded border border-border bg-muted/20 px-3 py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
            decline
          </div>
          <div className="text-foreground">{data.declineLabel}</div>
        </div>
      </div>
      <div>
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
          decline message
        </div>
        <p className="text-xs text-muted-foreground italic">
          "{data.declineMessage}"
        </p>
      </div>
    </div>
  );
}

function RevealBlock({ reveal }: { reveal: RevealDetail }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            name
          </div>
          <p className="text-sm text-foreground">{reveal.name}</p>
        </div>
      </div>
      {reveal.tagline && (
        <div className="pl-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            tagline
          </div>
          <p className="text-xs text-muted-foreground italic">
            "{reveal.tagline}"
          </p>
        </div>
      )}
      <div className="pl-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
          links
        </div>
        {reveal.links.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50 font-mono italic">
            no links
          </p>
        ) : (
          <pre className="text-[11px] text-muted-foreground font-mono bg-muted/10 border border-border/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(reveal.links, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function TraceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-0.5">
        {label}
      </div>
      <div className="text-xs font-mono text-foreground truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

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