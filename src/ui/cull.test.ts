import { describe, expect, it } from "vitest";
import {
  createSpatialGrid,
  cullListWindow,
  cullListWindowVariable,
  insertAabb,
  lowerBoundOffset,
  prefixSums,
  quantizeRect,
  queryGrid,
  rectsEqual,
} from "@/ui/cull";

describe("quantizeRect", () => {
  it("snaps a frustum to the coarse cell grid", () => {
    const q = quantizeRect({ x: 12, y: 7, w: 20, h: 10 }, 8);
    expect(q).toEqual({ x: 8, y: 0, w: 24, h: 24 });
  });

  it("treats tiny camera moves as the same cell", () => {
    const a = quantizeRect({ x: 80.2, y: 40.1, w: 200, h: 120 }, 80);
    const b = quantizeRect({ x: 90, y: 50, w: 200, h: 120 }, 80);
    expect(rectsEqual(a, b)).toBe(true);
  });
});

describe("spatial grid", () => {
  it("returns only items in overlapping cells", () => {
    const grid = createSpatialGrid<{ id: string }>(0, 0, 40);
    const near = { id: "near" };
    const far = { id: "far" };
    insertAabb(grid, near, { x: 10, y: 10, w: 8, h: 8 });
    insertAabb(grid, far, { x: 800, y: 10, w: 8, h: 8 });
    const hit = queryGrid(grid, { x: 0, y: 0, w: 50, h: 50 }).map((item) => item.id);
    expect(hit).toContain("near");
    expect(hit).not.toContain("far");
  });

  it("keeps a long-span item in the large-object bucket", () => {
    const grid = createSpatialGrid<{ id: string }>(0, 0, 20);
    const river = { id: "river" };
    insertAabb(grid, river, { x: 0, y: 0, w: 2000, h: 4 });
    expect(grid.longs.map((item) => item.id)).toEqual(["river"]);
    expect(queryGrid(grid, { x: 900, y: 0, w: 20, h: 20 }).map((item) => item.id)).toContain("river");
  });
});

describe("cullListWindow", () => {
  it("keeps a small frustum over 10_000 fixed-height rows", () => {
    const win = cullListWindow({
      count: 10_000,
      itemSize: 32,
      scroll: 3200,
      viewport: 400,
      overscan: 8,
    });
    expect(win.end - win.start).toBeLessThan(40);
    expect(win.start).toBeGreaterThan(80);
    expect(win.start).toBeLessThanOrEqual(100);
    expect(win.end).toBeGreaterThan(112);
    expect(win.offset).toBe(win.start * 32);
  });

  it("clamps an empty or scrolled-past list", () => {
    expect(cullListWindow({ count: 0, itemSize: 20, scroll: 0, viewport: 100 })).toEqual({
      start: 0,
      end: 0,
      offset: 0,
    });
    const past = cullListWindow({ count: 10, itemSize: 20, scroll: 4000, viewport: 100, overscan: 2 });
    expect(past.start).toBe(10);
    expect(past.end).toBe(10);
  });
});

describe("cullListWindowVariable", () => {
  it("binary-searches 5_000 mixed-height rows", () => {
    const sizes = Array.from({ length: 5_000 }, (_, i) => (i % 20 === 0 ? 36 : 19));
    const offsets = prefixSums(sizes);
    expect(offsets).toHaveLength(5_001);
    expect(lowerBoundOffset(offsets, 0)).toBe(0);

    const mid = offsets[2_400];
    const win = cullListWindowVariable({
      offsets,
      scroll: mid,
      viewport: 380,
      overscan: 6,
    });
    expect(win.end - win.start).toBeLessThan(40);
    expect(win.start).toBeGreaterThan(2_300);
    expect(win.end).toBeLessThan(2_500);
    expect(win.offset).toBe(offsets[win.start]);
  });
});
