import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useModeDetail, useUpdateMode } from "@/api/hooks";
import { ModeEditor } from "./editor/ModeEditor";
import { toEditorValue, toPutPayload, type EditorMode } from "./editor/types";
import { useDirtyGuard } from "./editor/useDirtyGuard";

export function ModeEditPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useModeDetail(name);
  const update = useUpdateMode();

  const [editorValue, setEditorValue] = useState<EditorMode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed the editor from server data once. Subsequent server refetches
  // don't clobber in-progress edits.
  useEffect(() => {
    if (data && editorValue === null) {
      setEditorValue(toEditorValue(data));
    }
  }, [data, editorValue]);

  useDirtyGuard(dirty);

  const handleChange = (next: EditorMode) => {
    setEditorValue(next);
    setDirty(true);
    if (saveError) setSaveError(null);
  };

  const handleSave = async () => {
    if (!editorValue || !name) return;
    setSaveError(null);
    try {
      await update.mutateAsync({
        name,
        payload: toPutPayload(editorValue),
      });
      setDirty(false);
      navigate(`/modes/${name}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCancel = () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    navigate(`/modes/${name}`);
  };

  if (isLoading || !editorValue) {
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
        onClick={handleCancel}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        {dirty ? "discard & back" : "back"}
      </button>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              editing
            </span>
            {dirty && (
              <span className="inline-flex items-center rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-warning">
                unsaved
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">
            {data.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={update.isPending || !dirty}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-primary/40 bg-primary/10 text-sm text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" />
            {update.isPending ? "saving…" : "save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive whitespace-pre-wrap break-all">
          {saveError}
        </div>
      )}

      <ModeEditor value={editorValue} onChange={handleChange} />
    </div>
  );
}