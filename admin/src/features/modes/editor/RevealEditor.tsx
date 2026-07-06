import { Plus } from "lucide-react";
import type { EditorReveal, EditorRevealLink } from "./types";
import { RevealLinkEditor } from "./RevealLinkEditor";
import { newRevealLink } from "./types";

interface Props {
  value: EditorReveal;
  onChange: (next: EditorReveal) => void;
}

export function RevealEditor({ value, onChange }: Props) {
  const patchLink = (i: number, next: EditorRevealLink) => {
    onChange({
      ...value,
      links: value.links.map((l, idx) => (idx === i ? next : l)),
    });
  };

  const removeLink = (i: number) => {
    onChange({
      ...value,
      links: value.links.filter((_, idx) => idx !== i),
    });
  };

  const moveLink = (i: number, direction: -1 | 1) => {
    const j = i + direction;
    if (j < 0 || j >= value.links.length) return;
    const next = [...value.links];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...value, links: next });
  };

  const addLink = () => {
    onChange({ ...value, links: [...value.links, newRevealLink()] });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          name{" "}
          <span className="text-[10px]">({value.name.length} / 255)</span>
        </label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          maxLength={255}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          tagline{" "}
          <span className="text-[10px]">
            ({value.tagline.length} / 1024)
          </span>
        </label>
        <textarea
          value={value.tagline}
          onChange={(e) => onChange({ ...value, tagline: e.target.value })}
          rows={2}
          maxLength={1024}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-y"
        />
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          links ({value.links.length})
        </div>
        {value.links.length === 0 && (
          <div className="text-xs text-muted-foreground italic">
            no links yet
          </div>
        )}
        {value.links.map((l, i) => (
          <RevealLinkEditor
            key={l.key}
            value={l}
            onChange={(next) => patchLink(i, next)}
            onRemove={() => removeLink(i)}
            onMoveUp={() => moveLink(i, -1)}
            onMoveDown={() => moveLink(i, 1)}
            canMoveUp={i > 0}
            canMoveDown={i < value.links.length - 1}
            index={i}
          />
        ))}
        <button
          type="button"
          onClick={addLink}
          className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          add link
        </button>
      </div>
    </div>
  );
}