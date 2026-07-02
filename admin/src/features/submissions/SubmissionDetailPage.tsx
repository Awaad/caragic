import { useParams } from "react-router-dom";

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Submission</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{id}</p>
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground font-mono">chunk C</p>
      </div>
    </div>
  );
}