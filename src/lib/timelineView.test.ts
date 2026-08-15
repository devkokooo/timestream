import { describe, expect, it } from "vitest";
import {
  assertViewConsistent,
  boxesOverlap,
  edgePath,
  laneGapFor,
  layoutTimelineView,
  placeLabels,
} from "./timelineView";
import { crowdedTipsTimeline, linearTimeline } from "./fixtures";

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
});
