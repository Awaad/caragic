import type { EditorCaptureData } from "./types";

interface Props {
  value: EditorCaptureData;
  onChange: (next: EditorCaptureData) => void;
}

export function CaptureRoundEditor({ value, onChange }: Props) {
  const patch = <K extends keyof EditorCaptureData>(
    k: K,
    v: EditorCaptureData[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          prompt
        </label>
        <textarea
          value={value.prompt}
          onChange={(e) => patch("prompt", e.target.value)}
          rows={2}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-y"
          placeholder="ask for their contact"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            accept label
          </label>
          <input
            type="text"
            value={value.acceptLabel}
            onChange={(e) => patch("acceptLabel", e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            decline label
          </label>
          <input
            type="text"
            value={value.declineLabel}
            onChange={(e) => patch("declineLabel", e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          decline message
        </label>
        <textarea
          value={value.declineMessage}
          onChange={(e) => patch("declineMessage", e.target.value)}
          rows={2}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-y"
          placeholder="shown if the visitor declines"
        />
      </div>
    </div>
  );
}