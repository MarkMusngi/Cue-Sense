import type { ReactNode } from "react";

export type EditorTool =
  | "select"
  | "ball"
  | "pocket_target"
  | "circle_zone"
  | "rect_zone"
  | "arrow"
  | "line"
  | "text";

const ANNOTATION_TOOLS = new Set<EditorTool>(["arrow", "line", "text"]);

const TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: "select", label: "Select", hint: "Select and drag balls and zones" },
  { tool: "ball", label: "Add ball", hint: "Click the table to place a ball" },
  {
    tool: "pocket_target",
    label: "Pocket target",
    hint: "Click a pocket; links the selected object ball if there is one",
  },
  { tool: "circle_zone", label: "Circle zone", hint: "Click to place a circle zone" },
  { tool: "rect_zone", label: "Rect zone", hint: "Click to place a rect zone's top-left corner" },
  {
    tool: "arrow",
    label: "Arrow",
    hint: "Click to add points; click the last point again or press Enter to finish",
  },
  {
    tool: "line",
    label: "Line",
    hint: "Click to add points; click the last point again or press Enter to finish",
  },
  { tool: "text", label: "Text", hint: "Click to place a note" },
];

/** A one-click command on the layout, such as undo or delete. */
export type ToolbarAction = {
  label: string;
  title: string;
  testId: string;
  onClick: () => void;
  isDisabled?: boolean;
  // Set for toggles, such as snapping.
  isPressed?: boolean;
};

type EditorToolbarProps = {
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  canAddBall: boolean;
  canAddAnnotation: boolean;
  actions: ToolbarAction[];
};

export function EditorToolbar({
  tool,
  onToolChange,
  canAddBall,
  canAddAnnotation,
  actions,
}: EditorToolbarProps) {
  return (
    <div role="toolbar" aria-label="Table editor tools" className="flex flex-wrap gap-x-4 gap-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tools">
        <ToolButtons
          tool={tool}
          onToolChange={onToolChange}
          canAddBall={canAddBall}
          canAddAnnotation={canAddAnnotation}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Actions">
        {actions.map((action) => (
          <ToolbarButton
            key={action.testId}
            onClick={action.onClick}
            isDisabled={action.isDisabled}
            isPressed={action.isPressed}
            title={action.title}
            testId={action.testId}
          >
            {action.label}
          </ToolbarButton>
        ))}
      </div>
    </div>
  );
}

function ToolButtons({
  tool,
  onToolChange,
  canAddBall,
  canAddAnnotation,
}: Omit<EditorToolbarProps, "actions">) {
  return (
    <>
      {TOOLS.map(({ tool: option, label, hint }) => {
        const fullMessage =
          option === "ball" && !canAddBall
            ? "A layout has at most 15 object balls"
            : ANNOTATION_TOOLS.has(option) && !canAddAnnotation
              ? "A layout has at most 20 annotations"
              : undefined;
        return (
          <ToolbarButton
            key={option}
            isPressed={tool === option}
            onClick={() => onToolChange(option)}
            isDisabled={fullMessage !== undefined}
            title={fullMessage ?? hint}
            testId={`tool-${option}`}
          >
            {label}
          </ToolbarButton>
        );
      })}
    </>
  );
}

type ToolbarButtonProps = {
  children: ReactNode;
  onClick: () => void;
  testId: string;
  isPressed?: boolean;
  isDisabled?: boolean;
  title?: string;
};

function ToolbarButton({
  children,
  onClick,
  testId,
  isPressed,
  isDisabled = false,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isPressed}
      title={title}
      data-testid={testId}
      className={[
        "rounded border px-3 py-1.5 text-sm font-medium",
        "disabled:cursor-not-allowed disabled:opacity-40",
        isPressed
          ? "border-sky-600 bg-sky-600 text-white"
          : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
