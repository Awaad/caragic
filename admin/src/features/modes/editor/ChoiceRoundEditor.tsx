import type { EditorChoiceData, EditorOption } from "./types";
import { OptionEditor } from "./OptionEditor";

interface Props {
  value: EditorChoiceData;
  onChange: (next: EditorChoiceData) => void;
}

export function ChoiceRoundEditor({ value, onChange }: Props) {
  const patchOption = (i: number, next: EditorOption) => {
    onChange({
      ...value,
      options: value.options.map((o, idx) => (idx === i ? next : o)),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          question{" "}
          <span className="text-[10px]">
            ({value.question.length} / 1024)
          </span>
        </label>
        <textarea
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
          rows={2}
          maxLength={1024}
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-y"
        />
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          options ({value.options.length} / 4)
        </div>
        {value.options.map((o, i) => (
          <OptionEditor
            key={o.id}
            value={o}
            onChange={(next) => patchOption(i, next)}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}