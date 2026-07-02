import { cn } from "@/lib/utils";
import type { SubmissionOutcome, SubmissionStatus } from "@/api/types";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

function BadgeBase({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: SubmissionOutcome }) {
  if (outcome === "submitted") {
    return (
      <BadgeBase className="border-success/40 bg-success/10 text-success">
        <span className="h-1 w-1 rounded-full bg-success" />
        submitted
      </BadgeBase>
    );
  }
  return (
    <BadgeBase className="border-muted-foreground/30 bg-muted/40 text-muted-foreground">
      <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
      declined
    </BadgeBase>
  );
}

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  pending: "border-primary/40 bg-primary/10 text-primary",
  read: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  archived: "border-muted-foreground/20 bg-muted/20 text-muted-foreground/70",
  erase_requested: "border-warning/40 bg-warning/10 text-warning",
  erased: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <BadgeBase className={STATUS_STYLES[status]}>
      {status.replace("_", " ")}
    </BadgeBase>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  // Neutral chip — mode isn't a semantic status, just a label
  return (
    <BadgeBase className="border-border bg-accent/40 text-foreground">
      {mode}
    </BadgeBase>
  );
}