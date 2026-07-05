import type {
  EditorRound,
  EditorRoundData,
  EditorChoiceData,
  EditorCaptureData,
} from "./types";
import { ChoiceRoundEditor } from "./ChoiceRoundEditor";
import { CaptureRoundEditor } from "./CaptureRoundEditor";

interface Props {
  value: EditorRound;
  onChange: (next: EditorRound) => void;
  position: number;
}

const SLUG_PATTERN = /^[a-z0-9-]*$/;

export function RoundEditor({ value, onChange, position }: Props) {
  const patchData = (next: EditorRoundData) =>
    onChange({ ...value, data: next });

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          #{position + 1}
        </span>
        <span className="text-xs font-mono uppercase tracking-wider text-primary">
          {value.roundType}
        </span>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">slug</label>
        <input
          type="text"
          value={value.slug}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
            // Enforce the ^[a-z0-9-]+$ pattern at input time — invalid
            // characters are silently rejected rather than showing an
            // error, since there's no ambiguity about what's allowed.
            if (SLUG_PATTERN.test(v)) onChange({ ...value, slug: v });
          }}
          maxLength={64}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-mono"
          placeholder="lowercase-with-hyphens"
        />
      </div>
      {value.roundType === "choice" ? (
        <ChoiceRoundEditor
          value={value.data as EditorChoiceData}
          onChange={patchData}
        />
      ) : (
        <CaptureRoundEditor
          value={value.data as EditorCaptureData}
          onChange={patchData}
        />
      )}
    </div>
  );
}