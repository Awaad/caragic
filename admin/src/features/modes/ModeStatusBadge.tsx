import { cn } from "@/lib/utils";

type ModeStatus = "active" | "inactive" | "archived";

const STYLES: Record<ModeStatus, string> = {
  active: "border-success/40 bg-success/10 text-success",
  inactive: "border-muted-foreground/30 bg-muted/20 text-muted-foreground",
  archived: "border-warning/40 bg-warning/10 text-warning",
};

export function ModeStatusBadge({ status }: { status: ModeStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest",
        STYLES[status],
      )}
    >
      {status}
    </span>
  );
}