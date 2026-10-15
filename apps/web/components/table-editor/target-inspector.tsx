import type { Layout, Target } from "@/lib/layout";

type TargetInspectorProps = {
  layout: Layout;
  target: Target;
  onBallChange: (ballId: string | undefined) => void;
  onLabelChange: (label: string) => void;
};

/** Settings for the selected target: which ball it is for, and a zone's label. */
export function TargetInspector({ layout, target, onBallChange, onLabelChange }: TargetInspectorProps) {
  const isZone = target.kind === "zone";
  // Pocket targets name object balls only (docs/architecture.md section 4.3).
  const balls = [...(isZone ? [layout.cue_ball] : []), ...layout.object_balls];
  return (
    <div
      className="flex flex-wrap items-center gap-3 text-sm"
      data-testid="target-inspector"
    >
      <span className="font-medium">
        {isZone ? `${target.shape === "circle" ? "Circle" : "Rect"} zone` : "Pocket target"}
      </span>
      <label className="flex items-center gap-1">
        Ball
        <select
          className="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
          value={target.ball_id ?? ""}
          onChange={(event) => onBallChange(event.target.value || undefined)}
          data-testid="target-ball"
        >
          <option value="">Any ball</option>
          {balls.map((ball) => (
            <option key={ball.id} value={ball.id}>
              {"ball_in_hand" in ball
                ? "Cue ball"
                : ball.number !== undefined
                  ? `${ball.number} ball`
                  : ball.id}
            </option>
          ))}
        </select>
      </label>
      {isZone && (
        <label className="flex items-center gap-1">
          Label
          <input
            // Re-created when another zone is selected or the label changes elsewhere.
            key={`${target.id}:${target.label ?? ""}`}
            defaultValue={target.label ?? ""}
            maxLength={60}
            className="w-44 rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            onBlur={(event) => onLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            data-testid="target-label"
          />
        </label>
      )}
    </div>
  );
}
