import { Plus } from "lucide-react";
import type { EditorMode, EditorRound, EditorReveal } from "./types";
import { RoundEditor } from "./RoundEditor";
import { RevealEditor } from "./RevealEditor";
import { newChoiceRound } from "./types";

interface Props {
  value: EditorMode;
  onChange: (next: EditorMode) => void;
}

export function ModeEditor({ value, onChange }: Props) {
  const captureIdx = value.rounds.findIndex((r) => r.roundType === "capture");
  const choiceCount = value.rounds.filter((r) => r.roundType === "choice")
    .length;

  const patchRound = (i: number, next: EditorRound) => {
    onChange({
      ...value,
      rounds: value.rounds.map((r, idx) => (idx === i ? next : r)),
    });
  };

  const patchReveal = (next: EditorReveal) =>
    onChange({ ...value, reveal: next });

  const removeRound = (i: number) => {
    const target = value.rounds[i];
    if (target.roundType !== "choice") return; // capture is un-removable
    // If this is the only choice round left, confirm — a valid mode
    // requires ≥1 choice round, so save will fail until they add one.
    if (choiceCount <= 1) {
      const ok = window.confirm(
        "This is the only choice round. Removing it leaves the mode invalid — save will fail until you add another. Continue?",
      );
      if (!ok) return;
    }
    onChange({
      ...value,
      rounds: value.rounds.filter((_, idx) => idx !== i),
    });
  };

  const moveRound = (i: number, direction: -1 | 1) => {
    const j = i + direction;
    if (j < 0 || j >= value.rounds.length) return;
    // Neither the moved round nor the target can be capture. Capture
    // is always last, so this means: a choice round moves up freely,
    // and moves down only if the round below isn't capture.
    if (value.rounds[i].roundType === "capture") return;
    if (value.rounds[j].roundType === "capture") return;
    const next = [...value.rounds];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...value, rounds: next });
  };

  const addRound = () => {
    // Insert new choice round immediately before capture.
    const next = [...value.rounds];
    const insertAt = captureIdx === -1 ? next.length : captureIdx;
    next.splice(insertAt, 0, newChoiceRound());
    onChange({ ...value, rounds: next });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          rounds
        </h2>
        {value.rounds.map((r, i) => {
          const canMoveUp = r.roundType === "choice" && i > 0;
          const canMoveDown =
            r.roundType === "choice" &&
            i < value.rounds.length - 1 &&
            value.rounds[i + 1].roundType !== "capture";
          const canRemove = r.roundType === "choice";
          return (
            <RoundEditor
              key={r.key}
              value={r}
              onChange={(next) => patchRound(i, next)}
              onRemove={() => removeRound(i)}
              onMoveUp={() => moveRound(i, -1)}
              onMoveDown={() => moveRound(i, 1)}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              canRemove={canRemove}
              position={i}
            />
          );
        })}
        <button
          type="button"
          onClick={addRound}
          className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          add round
        </button>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          reveal
        </h2>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <RevealEditor value={value.reveal} onChange={patchReveal} />
        </div>
      </section>
    </div>
  );
}