"use server";

// Server Actions for practice sessions, drill runs and attempts. Like the drill actions,
// they exist because the web client is server-only: each forwards to api-client.ts and
// returns its result, error code included, as plain data.

import { revalidatePath } from "next/cache";

import {
  createAttempt,
  endDrillRun,
  finishSession,
  getSessions,
  setAttemptVoided,
  startDrillRun,
  startSession,
  type ApiResult,
  type AttemptInput,
  type AttemptRead,
  type PracticeSessionRead,
} from "@/lib/api-client";

/** Where a started drill run is: the screen needs both ids for its address. */
export type StartedRun = { session_id: string; run_id: string };

/** The owner's open session, or a new one. The newest session is the only one that can be open. */
async function openSession(): Promise<ApiResult<PracticeSessionRead>> {
  const newest = await getSessions(1, 0);
  if (!newest.ok) return newest;
  const [latest] = newest.data.items;
  if (latest && latest.ended_at === null) return { ok: true, data: latest };
  return startSession();
}

export async function startSessionAction(): Promise<ApiResult<PracticeSessionRead>> {
  const result = await startSession();
  if (result.ok) revalidatePath("/sessions");
  return result;
}

/** "Start drill run" on a drill: joins the open session, or starts one first. */
export async function startDrillRunAction(drillId: string): Promise<ApiResult<StartedRun>> {
  const session = await openSession();
  if (!session.ok) return session;
  const run = await startDrillRun(session.data.id, drillId);
  if (!run.ok) return run;
  revalidatePath("/sessions");
  return { ok: true, data: { session_id: session.data.id, run_id: run.data.id } };
}

/** Add a drill run to a session the person is already looking at. */
export async function startRunInSessionAction(
  sessionId: string,
  drillId: string,
): Promise<ApiResult<StartedRun>> {
  const run = await startDrillRun(sessionId, drillId);
  if (!run.ok) return run;
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, data: { session_id: sessionId, run_id: run.data.id } };
}

export async function logAttemptAction(
  runId: string,
  idempotencyKey: string,
  input: AttemptInput,
): Promise<ApiResult<AttemptRead>> {
  return createAttempt(runId, idempotencyKey, input);
}

/** Undo an attempt now. The time is the server's, so a phone with a wrong clock cannot skew it. */
export async function voidAttemptAction(attemptId: string): Promise<ApiResult<AttemptRead>> {
  return setAttemptVoided(attemptId, new Date().toISOString());
}

export async function endRunAction(runId: string, sessionId: string): Promise<ApiResult<unknown>> {
  const result = await endDrillRun(runId, new Date().toISOString());
  if (result.ok) revalidatePath(`/sessions/${sessionId}`);
  return result;
}

export async function finishSessionAction(sessionId: string): Promise<ApiResult<PracticeSessionRead>> {
  const result = await finishSession(sessionId, new Date().toISOString());
  if (result.ok) {
    revalidatePath("/sessions");
    revalidatePath(`/sessions/${sessionId}`);
  }
  return result;
}
