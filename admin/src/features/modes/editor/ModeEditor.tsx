import type { EditorMode, EditorRound, EditorReveal } from "./types";
import { RoundEditor } from "./RoundEditor";
import { RevealEditor } from "./RevealEditor";

interface Props {
  value: EditorMode;
  onChange: (next: EditorMode) => void;
}

export function ModeEditor({ value, onChange }: Props) {
  const patchRound = (i: number, next: EditorRound) => {
    onChange({
      ...value,
      rounds: value.rounds.map((r, idx) => (idx === i ? next : r)),
    });
  };
  const patchReveal = (next: EditorReveal) =>
    onChange({ ...value, reveal: next });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          rounds
        </h2>
        {value.rounds.map((r, i) => (
          <RoundEditor
            key={r.key}
            value={r}
            onChange={(next) => patchRound(i, next)}
            position={i}
          />
        ))}
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