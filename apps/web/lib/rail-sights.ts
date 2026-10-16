// Set progress shown as the table's diamond sights, one per attempt in the set.

export type RailMark = "success" | "fail" | "partial" | "pending" | "empty";

const WORDS: [RailMark, string][] = [
  ["success", "made"],
  ["fail", "missed"],
  ["partial", "partial"],
  ["pending", "being saved"],
  ["empty", "to go"],
];

/** What a screen reader hears for a row of sights, e.g. "2 made, 1 missed, 7 to go". */
export function describeRailSights(marks: readonly RailMark[]): string {
  const parts = WORDS.flatMap(([mark, word]) => {
    const count = marks.filter((m) => m === mark).length;
    return count > 0 ? [`${count} ${word}`] : [];
  });
  return parts.length > 0 ? parts.join(", ") : "No attempts";
}
