export function DashboardPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your card activity.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground font-mono">
          coming soon — stats, funnel, recent activity
        </p>
      </div>
    </div>
  );
}