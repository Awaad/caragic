import { X } from "lucide-react";
import type { EditorOption } from "./types";
import { IconButton } from "./IconButton";

interface Props {
  value: EditorOption;
  onChange: (next: EditorOption) => void;
  onRemove: () => void;
  canRemove: boolean;
  index: number;
}

export function OptionEditor({
  value,
  onChange,
  onRemove,
  canRemove,
  index,
}: Props) {
  const patch = <K extends keyof EditorOption>(k: K, v: EditorOption[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            option {index + 1}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            id: {value.id}
          </span>
        </div>
        <IconButton
          icon={X}
          label={`remove option ${index + 1}`}
          onClick={onRemove}
          disabled={!canRemove}
          danger
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          label
        </label>
        <input
          type="text"
          value={value.label}
          onChange={(e) => patch("label", e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          placeholder="what they see on the button"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          reveal text
        </label>
        <textarea
          value={value.revealText}
          onChange={(e) => patch("revealText", e.target.value)}
          rows={2}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-y"
          placeholder="what appears after they pick this"
        />
      </div>
    </div>
  );
}