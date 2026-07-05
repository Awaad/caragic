import type { EditorRevealLink } from "./types";

interface Props {
  value: EditorRevealLink;
  onChange: (next: EditorRevealLink) => void;
  index: number;
}

export function RevealLinkEditor({ value, onChange, index }: Props) {
  const patch = <K extends keyof EditorRevealLink>(
    k: K,
    v: EditorRevealLink[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 space-y-2">
      <div className="text-xs text-muted-foreground font-mono">
        link {index + 1}
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