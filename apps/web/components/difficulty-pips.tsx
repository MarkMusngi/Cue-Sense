export function DifficultyPips({ difficulty }: { difficulty: number }) {
  return (
    <span
      role="img"
      aria-label={`Difficulty ${difficulty} of 5`}
      className="flex items-center gap-[3px]"
      data-testid="difficulty-pips"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M5 0.5 L9.5 5 L5 9.5 L0.5 5 Z"
            fill={n <= difficulty ? "var(--chalk)" : "transparent"}
            stroke={n <= difficulty ? "var(--chalk)" : "var(--line)"}
          />
        </svg>
      ))}
    </span>
  );
}
