"use client";

import { useEffect, useState } from "react";

/** The day and month in UTC: the same on the server and in the browser. */
function utcDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * A date and time in the reader's own timezone. The server does not know it, so the first
 * render is the UTC day and the browser fills in the local day and time after it loads.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState(() => utcDay(iso));
  useEffect(() => {
    setText(
      new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [iso]);
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
