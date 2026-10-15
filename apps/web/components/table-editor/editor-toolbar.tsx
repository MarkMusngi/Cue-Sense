import type { ReactNode } from "react";

export type EditorTool = "select" | "ball";

type EditorToolbarProps = {
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  canAddBall: boolean;
  canDelete: boolean;
  onDelete: () => void;
};

export function EditorToolbar({
  tool,
  onToolChange,
  canAddBall,
  canDelete,
  onDelete,
}: EditorToolbarProps) {
  return (
    <div role="toolbar" aria-label="Table editor tools" className="flex flex-wrap gap-2">
      <ToolbarButton
        isPressed={tool === "select"}
        onClick={() => onToolChange("select")}
        testId="tool-select"
      >
        Select
      </ToolbarButton>
      <ToolbarButton
        isPressed={tool === "ball"}
        onClick={() => onToolChange("ball")}
        isDisabled={!canAddBall}
        title={canAddBall ? "Click the table to place a ball" : "A layout has at most 15 object balls"}
        testId="tool-ball"
      >
        Add ball
      </ToolbarButton>
      <ToolbarButton
        onClick={onDelete}
        isDisabled={!canDelete}
        title="Delete the selected ball (Delete key)"
        testId="delete-selected"
      >
        Delete
      </ToolbarButton>
    </div>
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
