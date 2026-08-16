import { describe, expect, it } from "vitest";
import {
  assertViewConsistent,
  laneGapFor,
  layoutTimelineView,
} from "./timelineView";
import {
  crowdedTipsTimeline,
  linearTimeline,
  longDivergedTimeline,
  manyBranchesTimeline,
} from "./fixtures";

describe("UI consistency across branch topologies", () => {
  it("linear history stays visually quiet", () => {
    const view = layoutTimelineView(linearTimeline());
    expect(assertViewConsistent(view)).toEqual([]);
    expect(view.laneGap).toBe(laneGapFor(1));
    expect(view.nodes.filter((n) => n.side !== "sacred")).toHaveLength(0);
  });

  it("many simultaneous variants keep unique lanes and tighter gaps", () => {
    const view = layoutTimelineView(manyBranchesTimeline(8));
    expect(assertViewConsistent(view)).toEqual([]);
    expect(view.laneGap).toBe(laneGapFor(9));
    expect(view.laneGap).toBeLessThan(laneGapFor(3));

    const tipCols = view.nodes
      .filter((n) => n.id.startsWith("v"))
      .map((n) => n.column);
    expect(new Set(tipCols).size).toBe(8);
    expect(tipCols.every((col) => col !== 0)).toBe(true);

    const ys = view.nodes.filter((n) => n.id.startsWith("v")).map((n) => n.y);
    expect(new Set(ys).size).toBe(8);
    expect(view.nodes.some((n) => n.side === "above")).toBe(true);
    expect(view.nodes.some((n) => n.side === "below")).toBe(true);
    expect(view.sacredY).toBe(view.nodes.find((n) => n.id === "sacred")?.y);
    const nearest = Math.min(...ys.map((y) => Math.abs(y - view.sacredY)));
    expect(nearest).toBe(view.laneGap);
    expect(view.laneGap).toBeLessThanOrEqual(18);
  });

  it("branches many commits apart keep a stable spur height", () => {
    const view = layoutTimelineView(longDivergedTimeline(24));
    expect(assertViewConsistent(view)).toEqual([]);

    const sacred = view.nodes.filter((n) => n.column === 0);
    const variant = view.nodes.filter((n) => n.column === 1);
    expect(sacred).toHaveLength(25);
    expect(variant).toHaveLength(24);
    expect(new Set(sacred.map((n) => n.y)).size).toBe(1);
    expect(new Set(variant.map((n) => n.y)).size).toBe(1);
    expect(variant[0].y).not.toBe(sacred[0].y);

    const span = variant.at(-1)!.x - variant[0].x;
    expect(span).toBeCloseTo(23 * view.rowWidth);
    expect(view.width).toBeGreaterThan(linearTimelineWidth());

    const fork = view.edges.find((e) => e.from === "root" && e.to === "v1");
    expect(fork?.d.includes("C")).toBe(true);
    expect(
      view.edges
        .filter((e) => e.from.startsWith("v") && e.to.startsWith("v"))
        .every((e) => e.d.includes("L")),
    ).toBe(true);
  });

  it("same-row tips at a nexus do not stack on one coordinate", () => {
    const view = layoutTimelineView(crowdedTipsTimeline());
    expect(assertViewConsistent(view)).toEqual([]);
    const rowTwo = view.nodes.filter((n) => n.row === 2);
    expect(rowTwo).toHaveLength(3);
    expect(new Set(rowTwo.map((n) => n.y)).size).toBe(3);
    expect(new Set(rowTwo.map((n) => n.x)).size).toBe(1);
  });
});

function linearTimelineWidth(): number {
  return layoutTimelineView(linearTimeline()).width;
}
