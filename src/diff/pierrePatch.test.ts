import { describe, expect, it } from "vitest";
import { hunkKey } from "@/diff/diffView";
import {
  fileDiffToUnifiedPatch,
  filterHunks,
  linesIncludeOrigins,
  toPierreFileDiff,
} from "@/diff/pierrePatch";
import type { DiffHunk, DiffLine, FileDiff } from "@/diff/types";

function line(
  kind: DiffLine["kind"],
  text: string,
  oldNo: number | null,
  newNo: number | null,
): DiffLine {
  return { kind, text, oldNo, newNo };
}

function modifiedDiff(hunks: DiffHunk[]): FileDiff {
  return {
    path: "src/lib/graph.rs",
    oldPath: null,
    status: "modified",
    binary: false,
    hunks,
  };
}

describe("linesIncludeOrigins", () => {
  it("detects fixture-style prefixed lines", () => {
    expect(
      linesIncludeOrigins([
        line("context", " fn a()", 1, 1),
        line("deletion", "-  x", 2, null),
        line("addition", "+  y", null, 2),
      ]),
    ).toBe(true);
  });

  it("detects rust-style bare bodies", () => {
    expect(
      linesIncludeOrigins([
        line("context", "fn a()", 1, 1),
        line("deletion", "  x", 2, null),
        line("addition", "  y", null, 2),
      ]),
    ).toBe(false);
  });
});

describe("fileDiffToUnifiedPatch", () => {
  it("serializes modified hunks without double prefixes", () => {
    const diff = modifiedDiff([
      {
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        header: "@@ -1,2 +1,2 @@",
        lines: [
          line("context", "fn a()", 1, 1),
          line("deletion", "  x", 2, null),
          line("addition", "  y", null, 2),
        ],
      },
    ]);
    const patch = fileDiffToUnifiedPatch(diff);
    expect(patch).toContain("--- a/src/lib/graph.rs");
    expect(patch).toContain("+++ b/src/lib/graph.rs");
    expect(patch).toContain(" fn a()");
    expect(patch).toContain("-  x");
    expect(patch).toContain("+  y");
    expect(patch).not.toContain("--  x");
    expect(patch).not.toContain("++  y");
  });

  it("keeps fixture origin prefixes as-is", () => {
    const diff = modifiedDiff([
      {
        oldStart: 10,
        oldLines: 2,
        newStart: 10,
        newLines: 2,
        header: "@@ -10,2 +10,2 @@ fn",
        lines: [
          line("context", " fn a()", 10, 10),
          line("deletion", "-  x", 11, null),
          line("addition", "+  y", null, 11),
        ],
      },
    ]);
    const patch = fileDiffToUnifiedPatch(diff);
    expect(patch).toContain(" fn a()");
    expect(patch).toContain("-  x");
    expect(patch).toContain("+  y");
  });

  it("emits /dev/null for added files", () => {
    const diff: FileDiff = {
      path: "new.ts",
      oldPath: null,
      status: "added",
      binary: false,
      hunks: [
        {
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 1,
          header: "@@ -0,0 +1,1 @@",
          lines: [line("addition", "export {}", null, 1)],
        },
      ],
    };
    const patch = fileDiffToUnifiedPatch(diff);
    expect(patch).toContain("--- /dev/null");
    expect(patch).toContain("+++ b/new.ts");
    expect(patch).toContain("+export {}");
  });

  it("emits /dev/null for deleted files", () => {
    const diff: FileDiff = {
      path: "gone.ts",
      oldPath: null,
      status: "deleted",
      binary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 0,
          newLines: 0,
          header: "@@ -1,1 +0,0 @@",
          lines: [line("deletion", "export {}", 1, null)],
        },
      ],
    };
    const patch = fileDiffToUnifiedPatch(diff);
    expect(patch).toContain("--- a/gone.ts");
    expect(patch).toContain("+++ /dev/null");
    expect(patch).toContain("-export {}");
  });

  it("uses oldPath for renames", () => {
    const diff: FileDiff = {
      path: "src/b.ts",
      oldPath: "src/a.ts",
      status: "renamed",
      binary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          header: "@@ -1,1 +1,1 @@",
          lines: [
            line("deletion", "a", 1, null),
            line("addition", "b", null, 1),
          ],
        },
      ],
    };
    const patch = fileDiffToUnifiedPatch(diff);
    expect(patch).toContain("--- a/src/a.ts");
    expect(patch).toContain("+++ b/src/b.ts");
  });

  it("omits read hunks", () => {
    const hunkA: DiffHunk = {
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      header: "@@ -1,1 +1,1 @@ a",
      lines: [line("context", "a", 1, 1)],
    };
    const hunkB: DiffHunk = {
      oldStart: 5,
      oldLines: 1,
      newStart: 5,
      newLines: 2,
      header: "@@ -5,1 +5,2 @@ b",
      lines: [
        line("deletion", "x", 5, null),
        line("addition", "y", null, 5),
        line("addition", "z", null, 6),
      ],
    };
    const diff = modifiedDiff([hunkA, hunkB]);
    const patch = fileDiffToUnifiedPatch(diff, { omitHunkKeys: new Set([hunkKey(hunkA)]) });
    expect(patch).not.toContain("@@ -1,1 +1,1 @@ a");
    expect(patch).toContain("@@ -5,1 +5,2 @@ b");
    expect(filterHunks(diff, new Set([hunkKey(hunkA)])).map((h) => h.header)).toEqual([
      hunkB.header,
    ]);
  });

  it("returns empty string when all hunks omitted", () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      header: "@@ -1,1 +1,1 @@",
      lines: [line("context", "a", 1, 1)],
    };
    expect(fileDiffToUnifiedPatch(modifiedDiff([hunk]), { omitHunkKeys: new Set([hunkKey(hunk)]) })).toBe(
      "",
    );
  });
});

describe("toPierreFileDiff", () => {
  it("parses into FileDiffMetadata", () => {
    const diff = modifiedDiff([
      {
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        header: "@@ -1,2 +1,2 @@",
        lines: [
          line("context", "const x = 1;", 1, 1),
          line("deletion", "const y = 2;", 2, null),
          line("addition", "const y = 3;", null, 2),
        ],
      },
    ]);
    const meta = toPierreFileDiff(diff);
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe("src/lib/graph.rs");
    expect(meta!.hunks.length).toBeGreaterThan(0);
  });

  it("returns null for empty patch", () => {
    expect(toPierreFileDiff(modifiedDiff([]))).toBeNull();
  });
});
