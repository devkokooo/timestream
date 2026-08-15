import { describe, expect, it } from "vitest";
import {
  actionLabel,
  fileAction,
  fileDisplayPath,
  pairHunkLines,
} from "./diffView";
import type { DiffLine } from "./types";

function line(
  kind: DiffLine["kind"],
  text: string,
  oldNo: number | null,
  newNo: number | null,
): DiffLine {
  return { kind, text, oldNo, newNo };
}

describe("fileAction", () => {
  it.each([
    ["modified", "modified"],
    ["typechange", "modified"],
    ["added", "added"],
    ["untracked", "added"],
    ["deleted", "deleted"],
    ["moved", "moved"],
    ["renamed", "moved"],
    ["copied", "moved"],
  ] as const)("maps %s to %s", (status, action) => {
    expect(fileAction(status)).toBe(action);
  });
});

describe("actionLabel", () => {
  it("stamps each variance class", () => {
    expect(actionLabel("added")).toBe("ADDED");
    expect(actionLabel("deleted")).toBe("DELETED");
    expect(actionLabel("moved")).toBe("MOVED");
    expect(actionLabel("modified")).toBe("MODIFIED");
  });
});

describe("fileDisplayPath", () => {
  it("keeps a single path for ordinary changes", () => {
    expect(fileDisplayPath({ path: "a.rs", oldPath: null, status: "modified" })).toBe("a.rs");
  });

  it("shows the origin when a file is moved", () => {
    expect(
      fileDisplayPath({ path: "b.rs", oldPath: "a.rs", status: "moved" }),
    ).toBe("a.rs → b.rs");
  });
});

describe("pairHunkLines", () => {
  it("mirrors context onto both columns", () => {
    const rows = pairHunkLines([line("context", "keep", 1, 1)]);
    expect(rows).toEqual([
      {
        left: { no: 1, text: "keep", kind: "context" },
        right: { no: 1, text: "keep", kind: "context" },
      },
    ]);
  });

  it("pairs a replacement on one row", () => {
    const rows = pairHunkLines([
      line("deletion", "old", 2, null),
      line("addition", "new", null, 2),
    ]);
    expect(rows).toEqual([
      {
        left: { no: 2, text: "old", kind: "deletion" },
        right: { no: 2, text: "new", kind: "addition" },
      },
    ]);
  });

  it("leaves unmatched deletions and additions on their own side", () => {
    const rows = pairHunkLines([
      line("deletion", "gone", 3, null),
      line("deletion", "also", 4, null),
      line("addition", "fresh", null, 3),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].right).toEqual({ no: 3, text: "fresh", kind: "addition" });
    expect(rows[1].left).toEqual({ no: 4, text: "also", kind: "deletion" });
    expect(rows[1].right).toBeNull();
  });
});
