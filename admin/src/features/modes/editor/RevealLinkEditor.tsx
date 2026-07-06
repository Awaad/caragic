import { X, ChevronUp, ChevronDown } from "lucide-react";
import type { EditorRevealLink } from "./types";
import { IconButton } from "./IconButton";

interface Props {
  value: EditorRevealLink;
  onChange: (next: EditorRevealLink) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  index: number;
}

export function RevealLinkEditor({
  value,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  index,
}: Props) {
  const patch = <K extends keyof EditorRevealLink>(
    k: K,
    v: EditorRevealLink[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">
          link {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            icon={ChevronUp}
            label={`move link ${index + 1} up`}
            onClick={onMoveUp}
            disabled={!canMoveUp}
          />
          <IconButton
            icon={ChevronDown}
            label={`move link ${index + 1} down`}
            onClick={onMoveDown}
            disabled={!canMoveDown}
          />
          <IconButton
            icon={X}
            label={`remove link ${index + 1}`}
            onClick={onRemove}
            danger
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-2">
        <input
          type="text"
          value={value.label}
          onChange={(e) => patch("label", e.target.value)}
          placeholder="label"
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <input
          type="url"
          value={value.url}
          onChange={(e) => patch("url", e.target.value)}
          placeholder="https://..."
          className="rounded border border-border bg-background px-2 py-1 text-sm font-mono"
        />
      </div>
    </div>
  );
}