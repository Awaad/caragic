import { X, ChevronUp, ChevronDown } from "lucide-react";
import type {
  EditorRound,
  EditorRoundData,
  EditorChoiceData,
  EditorCaptureData,
} from "./types";
import { ChoiceRoundEditor } from "./ChoiceRoundEditor";
import { CaptureRoundEditor } from "./CaptureRoundEditor";
import { IconButton } from "./IconButton";

interface Props {
  value: EditorRound;
  onChange: (next: EditorRound) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  position: number;
}

const SLUG_PATTERN = /^[a-z0-9-]*$/;

export function RoundEditor({
  value,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  canRemove,
  position,
}: Props) {
  const patchData = (next: EditorRoundData) =>
    onChange({ ...value, data: next });

  // Capture round is structural — no move/remove controls. Parent
  // still passes handlers, but the can* flags are false, hiding
  // every button in the capture row's header.
  const isCapture = value.roundType === "capture";
  const showControls = !isCapture;

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            #{position + 1}
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-primary">
            {value.roundType}
          </span>
          {isCapture && (
            <span className="text-[10px] text-muted-foreground italic">
              — pinned last
            </span>
          )}
        </div>
        {showControls && (
          <div className="flex items-center gap-1">
            <IconButton
              icon={ChevronUp}
              label={`move round ${position + 1} up`}
              onClick={onMoveUp}
              disabled={!canMoveUp}
            />
            <IconButton
              icon={ChevronDown}
              label={`move round ${position + 1} down`}
              onClick={onMoveDown}
              disabled={!canMoveDown}
            />
            <IconButton
              icon={X}
              label={`remove round ${position + 1}`}
              onClick={onRemove}
              disabled={!canRemove}
              danger
            />
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          slug
        </label>
        <input
          type="text"
          value={value.slug}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
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