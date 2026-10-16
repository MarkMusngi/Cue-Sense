"use client";

import { MAX_DESCRIPTION, MAX_INSTRUCTIONS, MAX_TITLE, type DrillForm } from "@/lib/drill-form";
import { cx } from "@/lib/cx";

import { TextArea } from "../ui/text-area";
import { TextField } from "../ui/text-field";

type FieldProps = {
  form: DrillForm;
  onChange: (patch: Partial<DrillForm>) => void;
  errorFor: (key: string) => string | undefined;
};

/** Title, description and difficulty. Tags have their own picker. */
export function DetailFields({ form, onChange, errorFor }: FieldProps) {
  return (
    <div className="flex flex-col gap-3.5" data-testid="drill-editor-details">
      <TextField
        label="Title"
        value={form.title}
        maxLength={MAX_TITLE}
        autoComplete="off"
        error={errorFor("title")}
        data-testid="drill-editor-title"
        data-field="title"
        onChange={(event) => onChange({ title: event.target.value })}
      />
      <TextArea
        label="Description"
        rows={2}
        value={form.description}
        maxLength={MAX_DESCRIPTION}
        error={errorFor("description")}
        data-testid="drill-editor-description"
        data-field="description"
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[13px] font-medium">Difficulty</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((level) => {
            const isSelected = form.difficulty === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={isSelected}
                data-testid={`drill-editor-difficulty-${level}`}
                data-field={level === form.difficulty ? "difficulty" : undefined}
                className={cx(
                  "min-h-11 rounded-lg border text-[15px]",
                  isSelected
                    ? "border-chalk bg-chalk-soft font-semibold text-chalk"
                    : "border-control bg-transparent text-muted hover:text-text",
                )}
                onClick={() => onChange({ difficulty: level })}
              >
                {level}
              </button>
            );
          })}
        </div>
        {errorFor("difficulty") && (
          <p className="text-xs text-miss" data-testid="drill-editor-difficulty-error">
            {errorFor("difficulty")}
          </p>
        )}
      </fieldset>
    </div>
  );
}

/** What to do at the table: the drill's written instructions. */
export function InstructionsField({ form, onChange, errorFor }: FieldProps) {
  return (
    <TextArea
      label="Instructions"
      rows={6}
      value={form.instructions}
      maxLength={MAX_INSTRUCTIONS}
      error={errorFor("instructions")}
      hint="What to do at the table, in your own words."
      data-testid="drill-editor-instructions"
      data-field="instructions"
      onChange={(event) => onChange({ instructions: event.target.value })}
    />
  );
}
