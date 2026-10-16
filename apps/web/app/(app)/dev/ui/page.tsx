import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UiPreview } from "./ui-preview";

export const metadata: Metadata = { title: "UI primitives · Cue Sense" };

/** Every shared control in one place, for design review. Not served in production. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiPreview />;
}
