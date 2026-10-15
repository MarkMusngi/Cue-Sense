import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered components between tests (no-op for node-only tests).
afterEach(() => {
  cleanup();
});
