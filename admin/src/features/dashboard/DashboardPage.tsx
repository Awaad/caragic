import { Link } from "react-router-dom";
import { useSubmissionsList } from "@/api/hooks";
import { Inbox, ChevronRight } from "lucide-react";

export function DashboardPage() {
  const pending = useSubmissionsList({ statuses: ["pending"], limit: 1 });

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your card activity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/submissions?status=pending"
          className="group rounded-lg border border-border bg-card/40 p-5 hover:bg-card/70 hover:border-primary/40 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <Inbox className="h-4 w-4 text-primary" />
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {pending.isLoading
              ? "—"
              : pending.data
                ? pending.data.submissions.length +
                  (pending.data.next_cursor ? "+" : "")
                : "0"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            pending submissions
          </p>
        </Link>

        <div className="rounded-lg border border-border bg-card/40 p-5 opacity-40">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            —
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            funnel · Coming Soon
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-5 opacity-40">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            —
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            active mode · Coming Soon
          </p>
        </div>
      </div>
    </div>
  );
}