import { AnnotationInspector } from "@/components/table-editor/annotation-inspector";
import type { PendingPath } from "@/components/table-editor/annotation-layer";
import { TargetInspector } from "@/components/table-editor/target-inspector";
import type { Annotation, Layout, Target } from "@/lib/layout";

type InspectorRowProps = {
  layout: Layout;
  pending: PendingPath | null;
  selectedTarget: Target | undefined;
  selectedAnnotation: Annotation | undefined;
  onFinishPath: () => void;
  onCancelPath: () => void;
  onTargetBallChange: (ballId: string | undefined) => void;
  onZoneLabelChange: (label: string) => void;
  onAnnotationTextChange: (value: string) => void;
};

const BUTTON =
  "rounded border border-neutral-300 bg-white px-2 py-1 font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";

/**
 * The row under the toolbar: drawing help, or settings for the selection.
 * It has a fixed height so the table never moves under the pointer.
 */
export function InspectorRow(props: InspectorRowProps) {
  const { layout, pending, selectedTarget, selectedAnnotation } = props;
  return (
    <div className="flex min-h-9 items-center" data-testid="inspector-row">
      {pending ? (
        <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="drawing-help">
          <span>
            Drawing {pending.kind === "arrow" ? "an arrow" : "a line"} ({pending.points.length}{" "}
            {pending.points.length === 1 ? "point" : "points"}). Click the last point again or press
            Enter to finish.
          </span>
          <button
            type="button"
            className={BUTTON}
            disabled={pending.points.length < 2}
            onClick={props.onFinishPath}
            data-testid="finish-path"
          >
            Finish
          </button>
          <button type="button" className={BUTTON} onClick={props.onCancelPath}>
            Cancel
          </button>
        </div>
      ) : selectedTarget ? (
        <TargetInspector
          layout={layout}
          target={selectedTarget}
          onBallChange={props.onTargetBallChange}
          onLabelChange={props.onZoneLabelChange}
        />
      ) : selectedAnnotation ? (
        <AnnotationInspector
          annotation={selectedAnnotation}
          onTextChange={props.onAnnotationTextChange}
        />
      ) : (
        <p className="text-sm text-neutral-500">
          Select a target or annotation to change its settings.
        </p>
      )}
    </div>
  );
}
