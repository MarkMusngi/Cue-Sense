import { afterEach, describe, expect, it, vi } from "vitest";

import { newKey } from "@/lib/uuid";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newKey", () => {
  it("is a version 4 UUID", () => {
    expect(newKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is different every time", () => {
    const keys = new Set(Array.from({ length: 1000 }, () => newKey()));
    expect(keys.size).toBe(1000);
  });

  it("works where crypto.randomUUID does not exist, as on a plain http address", () => {
    const { getRandomValues } = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: getRandomValues.bind(globalThis.crypto) });

    expect(globalThis.crypto.randomUUID).toBeUndefined();
    expect(newKey()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
