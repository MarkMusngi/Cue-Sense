"use client";

import {
  readsAs,
  SCORING_FIELDS,
  SCORING_KINDS,
  scoringFieldLabel,
  type DrillForm,
} from "@/lib/drill-form";
import type { ScoringKind } from "@/lib/api-client";

import { TextField } from "../ui/text-field";

type ScoringFieldsProps = {
  form: DrillForm;
  onChange: (patch: Partial<DrillForm>) => void;
  /** The first problem for a field key such as scoring.pass_threshold. */
  errorFor: (key: string) => string | undefined;
  /** For the "past sets keep vN's rule" note; leave out for a new drill. */
  currentVersionNumber?: number;
};

/** The rule and its numbers. Only the fields of the chosen rule are shown. */
export function ScoringFields({ form, onChange, errorFor, currentVersionNumber }: ScoringFieldsProps) {
  const fields = SCORING_FIELDS[form.scoring_kind];
  return (
    <div className="flex flex-col gap-3" data-testid="drill-editor-scoring">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="drill-editor-scoring-kind" className="text-[13px] font-medium">
          Rule
        </label>
        <select
          id="drill-editor-scoring-kind"
          value={form.scoring_kind}
          data-testid="drill-editor-scoring-kind"
          data-field="scoring.kind"
          className="min-h-11 rounded-[10px] border border-control bg-surface px-2.5 text-[15px] text-text"
          onChange={(event) => onChange({ scoring_kind: event.target.value as ScoringKind })}
        >
          {SCORING_KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <TextField
            key={field}
            label={scoringFieldLabel(form.scoring_kind, field)}
            inputMode="numeric"
            autoComplete="off"
            value={String(form[field])}
            error={errorFor(`scoring.${field}`)}
            data-testid={`drill-editor-scoring-${field}`}
            data-field={`scoring.${field}`}
            className="[&_input]:font-mono"
            onChange={(event) => onChange({ [field]: event.target.value } as Partial<DrillForm>)}
          />
        ))}
      </div>

      <p className="text-[13px] text-muted" data-testid="drill-editor-reads-as">
        {readsAs(form)}
        {currentVersionNumber !== undefined &&
          ` Changing the rule starts v${currentVersionNumber + 1}; past sets keep v${currentVersionNumber}'s rule.`}
      </p>
    </div>
  );
}
