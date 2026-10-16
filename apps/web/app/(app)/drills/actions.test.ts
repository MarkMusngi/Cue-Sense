import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, client } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  client: {
    createDrill: vi.fn(),
    updateDrill: vi.fn(),
    duplicateDrill: vi.fn(),
    changeDrillStatus: vi.fn(),
    createTag: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api-client", () => client);

import {
  changeStatusAction,
  createDrillAction,
  createTagAction,
  duplicateDrillAction,
  updateDrillAction,
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

const OK = { ok: true, data: { id: "d1" } };
const FAILED = {
  ok: false,
  code: "validation_failed",
  error: "The drill is invalid.",
  details: [{ code: "balls_overlap", message: "m", path: ["layout", "object_balls", 1] }],
};

describe("drill actions", () => {
  it("creates and refreshes the library", async () => {
    client.createDrill.mockResolvedValue(OK);

    const result = await createDrillAction({ title: "T" } as never);

    expect(client.createDrill).toHaveBeenCalledWith({ title: "T" });
    expect(result).toBe(OK);
    expect(revalidatePath).toHaveBeenCalledWith("/drills");
  });

  it("updates and refreshes the library and the drill's page", async () => {
    client.updateDrill.mockResolvedValue(OK);

    await updateDrillAction("d1", { base_drill_version_id: "v1" } as never);

    expect(client.updateDrill).toHaveBeenCalledWith("d1", { base_drill_version_id: "v1" });
    expect(revalidatePath).toHaveBeenCalledWith("/drills");
    expect(revalidatePath).toHaveBeenCalledWith("/drills/d1");
  });

  it("returns the API's error and details untouched, without refreshing", async () => {
    client.updateDrill.mockResolvedValue(FAILED);

    const result = await updateDrillAction("d1", {} as never);

    expect(result).toBe(FAILED);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("duplicates and refreshes the library", async () => {
    client.duplicateDrill.mockResolvedValue(OK);

    await duplicateDrillAction("d1");

    expect(client.duplicateDrill).toHaveBeenCalledWith("d1");
    expect(revalidatePath).toHaveBeenCalledWith("/drills");
  });

  it("changes status and refreshes the library and the drill's page", async () => {
    client.changeDrillStatus.mockResolvedValue(OK);

    await changeStatusAction("d1", "archived");

    expect(client.changeDrillStatus).toHaveBeenCalledWith("d1", "archived");
    expect(revalidatePath).toHaveBeenCalledWith("/drills/d1");
  });

  it("creates a tag without touching any page", async () => {
    client.createTag.mockResolvedValue({ ok: true, data: { id: "t1" } });

    await createTagAction("Aim");

    expect(client.createTag).toHaveBeenCalledWith("Aim");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
