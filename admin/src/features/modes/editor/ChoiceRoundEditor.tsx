import { Plus } from "lucide-react";
import type { EditorChoiceData, EditorOption } from "./types";
import { OptionEditor } from "./OptionEditor";
import { newOption } from "./types";

interface Props {
  value: EditorChoiceData;
  onChange: (next: EditorChoiceData) => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

export function ChoiceRoundEditor({ value, onChange }: Props) {
  const patchOption = (i: number, next: EditorOption) => {
    onChange({
      ...value,
      options: value.options.map((o, idx) => (idx === i ? next : o)),
    });
  };

  const removeOption = (i: number) => {
    onChange({
      ...value,
      options: value.options.filter((_, idx) => idx !== i),
    });
  };

  const addOption = () => {
    onChange({ ...value, options: [...value.options, newOption()] });
  };

  const canRemove = value.options.length > MIN_OPTIONS;
  const canAdd = value.options.length < MAX_OPTIONS;

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
          options ({value.options.length} / {MAX_OPTIONS})
        </div>
        {value.options.map((o, i) => (
          <OptionEditor
            key={o.id}
            value={o}
            onChange={(next) => patchOption(i, next)}
            onRemove={() => removeOption(i)}
            canRemove={canRemove}
            index={i}
          />
        ))}
        <button
          type="button"
          onClick={addOption}
          disabled={!canAdd}
          className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          add option
        </button>
      </div>
    </div>
  );
}