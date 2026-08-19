import { describe, expect, it } from "vitest";
import { nextArchiveWindowLabel } from "@/shell/windows";

describe("nextArchiveWindowLabel", () => {
  it("uses a unique archive-* label Tauri can grant capabilities to", () => {
    const a = nextArchiveWindowLabel(1700000000000);
    const b = nextArchiveWindowLabel(1700000000000);
    expect(a).toMatch(/^archive-\d+-\d+$/);
    expect(b).toMatch(/^archive-\d+-\d+$/);
    expect(a).not.toBe(b);
  });
});
