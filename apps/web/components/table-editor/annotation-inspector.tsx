import type { Annotation } from "@/lib/layout";

type AnnotationInspectorProps = {
  annotation: Annotation;
  onTextChange: (value: string) => void;
};

/** Edits the selected annotation's label (arrow, line) or text. */
export function AnnotationInspector({ annotation, onTextChange }: AnnotationInspectorProps) {
  const isText = annotation.kind === "text";
  const value = isText ? annotation.text : (annotation.label ?? "");
  const name = { arrow: "Arrow", line: "Line", text: "Text" }[annotation.kind];
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="annotation-inspector">
      <span className="font-medium">{name}</span>
      <label className="flex items-center gap-1">
        {isText ? "Text" : "Label"}
        <input
          // Re-created when another annotation is selected or its text changes elsewhere.
          key={`${annotation.id}:${value}`}
          defaultValue={value}
          maxLength={80}
          // New text annotations start as "Note"; select it so typing replaces it.
          autoFocus={isText}
          onFocus={(event) => event.currentTarget.select()}
          className="w-56 rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
          onBlur={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          data-testid="annotation-text"
        />
      </label>
    </div>
  );
}
