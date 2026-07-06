import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useCreateMode } from "@/api/hooks";
import { ModeEditor } from "./editor/ModeEditor";
import {
  emptyEditorMode,
  toPutPayload,
  type EditorMode,
} from "./editor/types";
import { useDirtyGuard } from "./editor/useDirtyGuard";

const MODE_NAME_PATTERN = /^[a-z0-9-]{1,32}$/;
const RESERVED_NAMES = new Set(["new", "create", "delete"]);

export function ModeCreatePage() {
  const navigate = useNavigate();
  const create = useCreateMode();

  const [editorValue, setEditorValue] = useState<EditorMode>(() =>
    emptyEditorMode(""),
  );
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useDirtyGuard(dirty);

  const nameError = (() => {
    const n = editorValue.name;
    if (!n) return null; // empty is fine until save
    if (!MODE_NAME_PATTERN.test(n))
      return "lowercase letters, digits, hyphens; up to 32 chars";
    if (RESERVED_NAMES.has(n)) return `"${n}" is reserved`;
    return null;
  })();

  const canSave =
    !!editorValue.name && !nameError && !create.isPending;

  const handleChange = (next: EditorMode) => {
    setEditorValue(next);
    setDirty(true);
    if (saveError) setSaveError(null);
  };

  const handleName = (name: string) => {
    handleChange({ ...editorValue, name });
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaveError(null);
    try {
      const payload = toPutPayload(editorValue);
      await create.mutateAsync({
        name: editorValue.name,
        ...payload,
      });
      setDirty(false);
      navigate(`/modes/${editorValue.name}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCancel = () => {
    if (dirty) {
      const ok = window.confirm("Discard this new mode?");
      if (!ok) return;
    }
    navigate("/modes");
  };

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
              new mode
            </span>
            {dirty && (
              <span className="inline-flex items-center rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-warning">
                unsaved
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">
            {editorValue.name || "unnamed"}
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
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded border border-primary/40 bg-primary/10 text-sm text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" />
            {create.isPending ? "creating…" : "create"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive whitespace-pre-wrap break-all">
          {saveError}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card/40 p-4 space-y-2">
        <label className="block text-xs text-muted-foreground">
          mode name{" "}
          <span className="text-[10px]">
            (permanent — can't be renamed later)
          </span>
        </label>
        <input
          type="text"
          value={editorValue.name}
          onChange={(e) => handleName(e.target.value.toLowerCase())}
          maxLength={32}
          placeholder="dating"
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-mono"
        />
        {nameError && (
          <p className="text-[11px] text-destructive font-mono">{nameError}</p>
        )}
      </div>

      <ModeEditor value={editorValue} onChange={handleChange} />
    </div>
  );
}