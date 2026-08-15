import { describe, expect, it } from "vitest";
import {
  assertViewConsistent,
  boxesOverlap,
  columnTone,
  easeOutCubic,
  edgePath,
  focusCamera,
  INCURSION_ID,
  laneGapFor,
  layoutTimelineView,
  lerpCamera,
  placeLabels,
} from "./timelineView";
import { crowdedTipsTimeline, linearTimeline, mixedRefTimeline } from "./fixtures";

describe("laneGapFor", () => {
  it("keeps generous spacing for a quiet timeline", () => {
    expect(laneGapFor(1)).toBe(56);
    expect(laneGapFor(3)).toBe(56);
  });

  it("compresses when many variants are on screen", () => {
    expect(laneGapFor(8)).toBe(40);
    expect(laneGapFor(16)).toBeLessThan(laneGapFor(8));
    expect(laneGapFor(24)).toBeGreaterThanOrEqual(22);
  });
});

describe("edgePath", () => {
  it("draws a straight sacred river for same-lane flow", () => {
    expect(edgePath(10, 40, 80, 40)).toContain("L");
    expect(edgePath(10, 40, 80, 40)).not.toContain("C");
  });

  it("draws a curved spur when a variant leaves the river", () => {
    expect(edgePath(10, 40, 80, 90)).toContain("C");
  });
});

describe("focusCamera", () => {
  it("places the focus point at the viewport center", () => {
    const cam = focusCamera({ x: 100, y: 50 }, 2, { width: 400, height: 200 });
    expect(cam.x + 100 * cam.scale).toBe(200);
    expect(cam.y + 50 * cam.scale).toBe(100);
    expect(cam.scale).toBe(2);
  });
});

describe("lerpCamera", () => {
  const from = { x: 0, y: 0, scale: 1 };
  const to = { x: 100, y: 40, scale: 2 };

  it("starts at the origin pose and lands on the target", () => {
    expect(lerpCamera(from, to, 0)).toEqual(from);
    expect(lerpCamera(from, to, 1)).toEqual(to);
  });

  it("eases out so the midpoint is past linear halfway", () => {
    const mid = lerpCamera(from, to, 0.5);
    expect(mid.x).toBeGreaterThan(50);
    expect(mid.y).toBeGreaterThan(20);
    expect(mid.scale).toBeGreaterThan(1.5);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("layoutTimelineView", () => {
  it("keeps a linear trunk on one gold river", () => {
    const view = layoutTimelineView(linearTimeline());
    expect(assertViewConsistent(view)).toEqual([]);
    expect(new Set(view.nodes.map((n) => n.y)).size).toBe(1);
    expect(view.nodes.every((n) => n.side === "sacred")).toBe(true);
    expect(view.nodes.at(-1)?.x).toBeGreaterThan(view.nodes[0].x);
  });

  it("places later commits further along the chronometer", () => {
    const view = layoutTimelineView(linearTimeline());
    const xs = view.nodes.map((n) => n.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(view.width).toBeGreaterThan(view.nodes.at(-1)!.x);
  });

  it("nudges overlapping tip labels apart", () => {
    const view = layoutTimelineView(crowdedTipsTimeline());
    expect(assertViewConsistent(view)).toEqual([]);
    const labels = placeLabels(view.nodes);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        expect(boxesOverlap(labels[i], labels[j], 0)).toBe(false);
      }
    }
  });

  it("sprouts an incursion node from HEAD when the worktree is dirty", () => {
    const base = layoutTimelineView(linearTimeline());
    const view = layoutTimelineView(linearTimeline(), { incursion: true });
    expect(assertViewConsistent(view)).toEqual([]);
    expect(view.nodes).toHaveLength(base.nodes.length + 1);
    const head = view.nodes.find((n) => n.isHead)!;
    const incursion = view.nodes.find((n) => n.id === INCURSION_ID);
    expect(incursion).toBeTruthy();
    expect(incursion!.y).toBe(head.y);
    expect(incursion!.x).toBeGreaterThan(head.x);
    expect(incursion!.column).toBe(head.column);
    expect(view.edges.some((e) => e.from === head.id && e.to === INCURSION_ID)).toBe(true);
    expect(view.labels.some((l) => l.kind === "incursion" && l.text === "INCURSION")).toBe(true);
    expect(incursion!.x).toBeGreaterThan(Math.max(...base.nodes.map((n) => n.x)));
  });

  it("color-codes current, local, and remote ref labels", () => {
    const view = layoutTimelineView(mixedRefTimeline());
    expect(assertViewConsistent(view)).toEqual([]);
    expect(view.currentColumn).toBe(0);

    const head = view.labels.find((l) => l.kind === "head");
    expect(head?.segments).toEqual([
      { text: "NOW", tone: "current" },
      { text: "main", tone: "current" },
      { text: "origin/main", tone: "remote" },
    ]);

    const feature = view.labels.find((l) => l.text === "feature");
    expect(feature?.segments).toEqual([{ text: "feature", tone: "local" }]);

    const remote = view.labels.find((l) => l.text === "origin/hotfix");
    expect(remote?.segments).toEqual([{ text: "origin/hotfix", tone: "remote" }]);

    expect(columnTone(0, view.currentColumn, view.nodes)).toBe("current");
    expect(columnTone(1, view.currentColumn, view.nodes)).toBe("local");
    expect(columnTone(-1, view.currentColumn, view.nodes)).toBe("remote");
  });
});
