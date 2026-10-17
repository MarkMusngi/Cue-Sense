// Time shown on the session screens. No React.

/** 42:15, or 1:02:15 from an hour up. Negative or invalid input reads 0:00. */
export function formatElapsed(milliseconds: number): string {
  const total = Number.isFinite(milliseconds) ? Math.max(0, Math.floor(milliseconds / 1000)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/** Seconds typed into the time field as milliseconds, or null if it is not a number of 0 or more. */
export function parseSeconds(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.round(value * 1000) : null;
}
