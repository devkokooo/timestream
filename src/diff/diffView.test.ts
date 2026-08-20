import { describe, expect, it } from "vitest";
import {
  actionLabel,
  actionMark,
  actionTone,
  DIFF_HEADER_HEIGHT,
  estimateDiffRowSize,
  fileAction,
  fileBaseName,
  fileDisplayName,
  fileDisplayPath,
  flattenDiffRows,
  hunkHeaderStarts,
  hunkKey,
  hunkLineCounts,
  overlayHunkHeaders,
  pairHunkLines,
  splitHeaderOverlay,
} from "@/diff/diffView";
import { cullListWindow, prefixSums, cullListWindowVariable } from "@/ui/cull";
import type { DiffHunk, DiffLine } from "./types";

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

describe("actionMark", () => {
  it.each([
    ["modified", "M"],
    ["typechange", "M"],
    ["renamed", "R"],
    ["moved", "R"],
    ["copied", "R"],
    ["deleted", "D"],
    ["added", "A"],
    ["untracked", "U"],
  ] as const)("marks %s as %s", (status, mark) => {
    expect(actionMark(status)).toBe(mark);
  });
});

describe("actionTone", () => {
  it("keeps untracked distinct from added", () => {
    expect(actionTone("untracked")).toBe("untracked");
    expect(actionTone("added")).toBe("added");
  });
});

describe("fileBaseName", () => {
  it("returns the last segment of a nested path", () => {
    expect(fileBaseName("src/components/ReviewMode.tsx")).toBe("ReviewMode.tsx");
  });

  it("keeps a bare file name", () => {
    expect(fileBaseName("README.md")).toBe("README.md");
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

describe("fileDisplayName", () => {
  it("labels nested files by name", () => {
    expect(
      fileDisplayName({ path: "src/lib/diffView.ts", oldPath: null, status: "modified" }),
    ).toBe("diffView.ts");
  });

  it("shows both names when a file is moved", () => {
    expect(
      fileDisplayName({
        path: "src/components/ReviewMode.tsx",
        oldPath: "src/components/AnomalyDock.tsx",
        status: "moved",
      }),
    ).toBe("AnomalyDock.tsx → ReviewMode.tsx");
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

describe("hunkKey", () => {
  it("identifies a hunk by range and header, not by walk order", () => {
    const hunk = {
      oldStart: 10,
      newStart: 12,
      header: "@@ -10,4 +12,6 @@ fn load()",
    };
    expect(hunkKey(hunk)).toBe("10:12:@@ -10,4 +12,6 @@ fn load()");
    expect(hunkKey(hunk)).toBe(hunkKey({ ...hunk }));
  });
});

describe("hunkLineCounts", () => {
  it("counts additions and deletions, ignoring context", () => {
    const hunk: Pick<DiffHunk, "lines"> = {
      lines: [
        line("context", "keep", 1, 1),
        line("deletion", "old", 2, null),
        line("deletion", "gone", 3, null),
        line("addition", "new", null, 2),
        line("meta", "\\ No newline", null, null),
      ],
    };
    expect(hunkLineCounts(hunk)).toEqual({ added: 1, deleted: 2 });
  });
});

function sampleHunk(extra: Partial<DiffHunk> = {}): DiffHunk {
  return {
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 3,
    header: "@@ -1,3 +1,3 @@",
    lines: [
      line("context", "keep", 1, 1),
      line("deletion", "old", 2, null),
      line("addition", "new", null, 2),
    ],
    ...extra,
  };
}

describe("flattenDiffRows", () => {
  it("emits a header then each inline line", () => {
    const hunk = sampleHunk();
    const rows = flattenDiffRows([hunk], "inline", new Set());
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ type: "header", hunkIndex: 0 });
    expect(rows[1]).toMatchObject({ type: "inline", lineIndex: 0 });
    expect(rows[2]).toMatchObject({ type: "inline", lineIndex: 1 });
    expect(rows[3]).toMatchObject({ type: "inline", lineIndex: 2 });
    expect(estimateDiffRowSize(rows[0])).toBe(36);
    expect(estimateDiffRowSize(rows[1])).toBe(19);
    expect(estimateDiffRowSize(undefined)).toBe(19);
  });

  it("omits lines when the hunk is marked read", () => {
    const hunk = sampleHunk();
    const rows = flattenDiffRows([hunk], "inline", new Set([hunkKey(hunk)]));
    expect(rows).toEqual([{ type: "header", hunkIndex: 0, key: hunkKey(hunk) }]);
  });

  it("pairs split rows instead of listing every inline line", () => {
    const hunk = sampleHunk();
    const rows = flattenDiffRows([hunk], "split", new Set());
    expect(rows[0]).toMatchObject({ type: "header" });
    expect(rows.slice(1).every((row) => row.type === "split")).toBe(true);
    expect(rows).toHaveLength(1 + pairHunkLines(hunk.lines).length);
  });
});

describe("splitHeaderOverlay", () => {
  it("keeps one connected header sticky while its lines are in view", () => {
    const hunk = sampleHunk();
    const rows = flattenDiffRows([hunk], "split", new Set());
    const overlay = splitHeaderOverlay(rows, DIFF_HEADER_HEIGHT + 8, 200);
    expect(overlay).toHaveLength(1);
    expect(overlay[0].sticky).toBe(true);
    expect(overlay[0].top).toBe(0);
    expect(overlay[0].hunkIndex).toBe(0);
  });

  it("places the header at its natural offset at the top of the file", () => {
    const hunk = sampleHunk();
    const rows = flattenDiffRows([hunk], "split", new Set());
    const overlay = splitHeaderOverlay(rows, 0, 200);
    expect(overlay).toHaveLength(1);
    expect(overlay[0].sticky).toBe(false);
    expect(overlay[0].top).toBe(0);
  });

  it("culls headers in a 4_000-hunk file without walking every row", () => {
    const hunks = Array.from({ length: 4_000 }, (_, i) =>
      sampleHunk({
        oldStart: i * 8,
        newStart: i * 8,
        header: `@@ -${i * 8},3 +${i * 8},3 @@`,
      }),
    );
    const rows = flattenDiffRows(hunks, "inline", new Set());
    expect(rows.length).toBeGreaterThan(12_000);

    const sizes = rows.map((row) => estimateDiffRowSize(row));
    const offsets = prefixSums(sizes);
    const win = cullListWindowVariable({
      offsets,
      scroll: offsets[6_000],
      viewport: 400,
      overscan: 8,
    });
    expect(win.end - win.start).toBeLessThan(50);

    const starts = hunkHeaderStarts(rows);
    expect(starts).toHaveLength(4_000);
    const scroll = offsets[6_000] + 20;
    const overlay = overlayHunkHeaders(starts, scroll, 400);
    expect(overlay.length).toBeGreaterThan(0);
    expect(overlay.length).toBeLessThan(30);
    expect(overlay.filter((h) => h.sticky)).toHaveLength(1);

    const naive = splitHeaderOverlay(rows, scroll, 400);
    expect(overlay.map((h) => h.key)).toEqual(naive.map((h) => h.key));
  });

  it("windows 10_000 flattened diff lines to the viewport", () => {
    const win = cullListWindow({
      count: 10_000,
      itemSize: 19,
      scroll: 19 * 4_000,
      viewport: 380,
      overscan: 6,
    });
    expect(win.end - win.start).toBeLessThan(40);
    expect(win.start).toBeGreaterThan(3_900);
    expect(win.end).toBeLessThan(4_100);
  });
});
