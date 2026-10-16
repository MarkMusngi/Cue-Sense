import { useSyncExternalStore } from "react";

// Below Tailwind's md breakpoint (768 px), where the editor's settings are tabs.
const PHONE_QUERY = "(max-width: 767.98px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;
}

/** Whether the screen is phone width. False on the server, so the page renders all sections first. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
