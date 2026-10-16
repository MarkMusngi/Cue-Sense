"use server";

// Server Actions for the drill screens. The browser cannot reach the API directly (the
// web client is server-only, and the API is on the Docker network), so each save goes
// through the Next.js server. Each action forwards to api-client.ts and returns its
// result, error details included, as plain data for the screen to show.

import { revalidatePath } from "next/cache";

import {
  changeDrillStatus,
  createDrill,
  createTag,
  duplicateDrill,
  updateDrill,
  type ApiResult,
  type DrillContent,
  type DrillRead,
  type DrillStatus,
  type DrillUpdate,
  type TagRead,
} from "@/lib/api-client";

export async function createDrillAction(content: DrillContent): Promise<ApiResult<DrillRead>> {
  const result = await createDrill(content);
  if (result.ok) revalidatePath("/drills");
  return result;
}

export async function updateDrillAction(
  id: string,
  body: DrillUpdate,
): Promise<ApiResult<DrillRead>> {
  const result = await updateDrill(id, body);
  if (result.ok) {
    revalidatePath("/drills");
    revalidatePath(`/drills/${id}`);
  }
  return result;
}

export async function duplicateDrillAction(id: string): Promise<ApiResult<DrillRead>> {
  const result = await duplicateDrill(id);
  if (result.ok) revalidatePath("/drills");
  return result;
}

export async function changeStatusAction(
  id: string,
  status: DrillStatus,
): Promise<ApiResult<DrillRead>> {
  const result = await changeDrillStatus(id, status);
  if (result.ok) {
    revalidatePath("/drills");
    revalidatePath(`/drills/${id}`);
  }
  return result;
}

export async function createTagAction(name: string): Promise<ApiResult<TagRead>> {
  return createTag(name);
}
