import { Link } from "react-router-dom";
import { useSubmissionsList, useActiveMode, useTokensList, useSubmissionStats, } from "@/api/hooks";
import { Inbox, ChevronRight, Layers, Link2 } from "lucide-react";

export function DashboardPage() {
  const stats = useSubmissionStats();
  const activeMode = useActiveMode();
  const activeTokens = useTokensList({ statuses: ["active"] });

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your card activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          to="/submissions?status=pending"
          icon={Inbox}
          value={stats.isLoading ? "—" : String(stats.data?.pending ?? 0)}

          label="pending submissions"
        />

        <StatCard
          to="/tokens?status=active"
          icon={Link2}
          value={
            activeTokens.isLoading
              ? "—"
              : String(activeTokens.data?.tokens.length ?? 0)
          }
          label="active tokens"
        />

        <StatCard
          to="/modes"
          icon={Layers}
          value={activeMode.data?.mode ?? "—"}
          label="active mode"
          mono
        />
      </div>
    </div>
  );
}

function StatCard({
  to,
  icon: Icon,
  value,
  label,
  mono,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  mono?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-card/40 p-5 hover:bg-card/70 hover:border-primary/40 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
      </div>
      <div
        className={
          mono
            ? "text-2xl font-semibold tracking-tight font-mono"
            : "text-2xl font-semibold tracking-tight tabular-nums"
        }
      >
        {value}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </Link>
  );
}
