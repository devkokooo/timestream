import { describe, expect, it } from "vitest";
import {
  assertViewConsistent,
  boxesOverlap,
  clipRiverX,
  columnTone,
  cullTimelineView,
  diamondPoints,
  easeOutCubic,
  edgePath,
  focusCamera,
  hasTag,
  INCURSION_ID,
  listTimelineTags,
  indexTimelineView,
  laneGapFor,
  laneTones,
  layoutTimelineView,
  lerpCamera,
  placeLabels,
  timelineLod,
  worldRect,
} from "./timelineView";
import { crowdedTipsTimeline, linearTimeline, longDivergedTimeline, manyBranchesTimeline, mixedRefTimeline, taggedTimeline } from "./fixtures";

describe("laneGapFor", () => {
  it("keeps variant fibers close to the sacred river", () => {
    expect(laneGapFor(1)).toBe(22);
    expect(laneGapFor(3)).toBe(22);
  });

  it("compresses when many variants are on screen", () => {
    expect(laneGapFor(8)).toBe(18);
    expect(laneGapFor(16)).toBeLessThan(laneGapFor(8));
    expect(laneGapFor(24)).toBeGreaterThanOrEqual(14);
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

  it("peels a variant fiber late, near the child nexus", () => {
    const d = edgePath(10, 40, 80, 62);
    expect(d).toMatch(/C [\d.]+ 40,/);
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

  it("keeps branch and tag tips hugging the sacred river like fibers", () => {
    const view = layoutTimelineView(crowdedTipsTimeline());
    const sacred = view.nodes.find((n) => n.id === "c")!;
    const feature = view.nodes.find((n) => n.id === "d")!;
    const hotfix = view.nodes.find((n) => n.id === "e")!;
    expect(Math.abs(feature.y - sacred.y)).toBe(view.laneGap);
    expect(Math.abs(hotfix.y - sacred.y)).toBe(view.laneGap);
    expect(view.laneGap).toBeLessThanOrEqual(22);
  });

  it("stamps historic tags on the sacred river as close canon seals", () => {
    const view = layoutTimelineView(taggedTimeline());
    expect(assertViewConsistent(view)).toEqual([]);
    const v1 = view.nodes.find((n) => n.id === "b")!;
    const v2 = view.nodes.find((n) => n.id === "c")!;
    const head = view.nodes.find((n) => n.id === "d")!;
    const feature = view.nodes.find((n) => n.id === "e")!;
    expect(hasTag(v1)).toBe(true);
    expect(v1.y).toBe(view.sacredY);
    expect(v2.y).toBe(view.sacredY);
    expect(head.y).toBe(view.sacredY);
    expect(Math.abs(feature.y - view.sacredY)).toBe(view.laneGap);

    const tagLabels = view.labels.filter((l) => l.kind === "tag");
    expect(tagLabels.map((l) => l.text).sort()).toEqual(["v-feat", "v1.0", "v2.0", "v3.0"]);
    for (const label of tagLabels) {
      const node = view.nodes.find((n) => label.id.startsWith(n.id))!;
      expect(Math.abs(label.y - node.y)).toBeLessThanOrEqual(24);
      expect(label.x).toBeGreaterThan(node.x);
    }
    expect(diamondPoints(10, 20, 6)).toBe("10,14 16,20 10,26 4,20");
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

    const tones = laneTones(view.nodes, view.currentColumn);
    expect(tones.get(0)).toBe("current");
    expect(tones.get(1)).toBe("local");
    expect(tones.get(-1)).toBe("remote");
  });
});

describe("worldRect", () => {
  it("expands the camera viewport by pad in graph space", () => {
    const rect = worldRect({ x: 0, y: 0, scale: 1 }, { width: 100, height: 80 }, 20);
    expect(rect).toEqual({ x: -20, y: -20, w: 140, h: 120 });
  });
});

describe("cullTimelineView", () => {
  it("keeps nodes inside the rect and drops far ones", () => {
    const view = layoutTimelineView(linearTimeline());
    const first = view.nodes[0];
    const last = view.nodes.at(-1)!;
    const rect = { x: first.x - 4, y: first.y - 4, w: 8, h: 8 };
    const culled = cullTimelineView(view, rect);
    expect(culled.nodes.some((n) => n.id === first.id)).toBe(true);
    expect(culled.nodes.some((n) => n.id === last.id)).toBe(false);
  });

  it("includes a node that sits in the pad just outside the viewport", () => {
    const view = layoutTimelineView(linearTimeline());
    const first = view.nodes[0];
    const rect = { x: first.x + first.r + 17, y: first.y - 4, w: 8, h: 8 };
    expect(cullTimelineView(view, rect).nodes.some((n) => n.id === first.id)).toBe(false);
    const padded = { x: first.x - 2, y: first.y - 2, w: first.r + 20, h: 8 };
    expect(cullTimelineView(view, padded).nodes.some((n) => n.id === first.id)).toBe(true);
  });

  it("keeps an edge that crosses the rect even when both ends are off-screen", () => {
    const view = layoutTimelineView(linearTimeline());
    const a = view.nodes[0];
    const b = view.nodes[1];
    const midX = (a.x + b.x) / 2;
    const rect = { x: midX - 4, y: a.y - 4, w: 8, h: 8 };
    const culled = cullTimelineView(view, rect);
    expect(culled.nodes).toHaveLength(0);
    expect(culled.edges.some((e) => e.from === a.id && e.to === b.id)).toBe(true);
  });

  it("always keeps requested ids", () => {
    const view = layoutTimelineView(linearTimeline());
    const last = view.nodes.at(-1)!;
    const rect = { x: -1000, y: -1000, w: 10, h: 10 };
    const culled = cullTimelineView(view, rect, new Set([last.id]));
    expect(culled.nodes.map((n) => n.id)).toContain(last.id);
  });

  it("spatial index matches brute-force on a 400-node river window", () => {
    const view = layoutTimelineView(longDivergedTimeline(200));
    expect(view.nodes.length).toBeGreaterThan(400);
    const index = indexTimelineView(view);
    const head = view.head!;
    const rect = { x: head.x - 80, y: head.y - 40, w: 160, h: 80 };
    const brute = cullTimelineView(view, rect);
    const hashed = cullTimelineView(view, rect, undefined, index);
    expect(hashed.nodes.map((n) => n.id).sort()).toEqual(brute.nodes.map((n) => n.id).sort());
    expect(hashed.edges.map((e) => `${e.from}:${e.to}`).sort()).toEqual(
      brute.edges.map((e) => `${e.from}:${e.to}`).sort(),
    );
    expect(hashed.nodes.length).toBeLessThan(40);
  });

  it("frustum-culls hundreds of variant lanes to the visible cell", () => {
    const view = layoutTimelineView(manyBranchesTimeline(160));
    expect(view.nodes.length).toBeGreaterThan(150);
    const index = indexTimelineView(view);
    const head = view.head!;
    const rect = { x: head.x - 30, y: head.y - 30, w: 60, h: 60 };
    const culled = cullTimelineView(view, rect, new Set([head.id]), index);
    expect(culled.nodes.some((n) => n.id === head.id)).toBe(true);
    expect(culled.nodes.length).toBeLessThan(30);
  });

  it("keeps the full fiber at a normal monitor zoom", () => {
    expect(timelineLod(1.65, 14)).toEqual({ stride: 1, tipsOnly: false });
    expect(timelineLod(1, 40)).toEqual({ stride: 1, tipsOnly: false });
    expect(timelineLod(0.8, 80)).toEqual({ stride: 1, tipsOnly: false });
  });

  it("thins unlabeled nexuses only when zoomed far out over a long river", () => {
    const view = layoutTimelineView(longDivergedTimeline(400));
    expect(view.nodes.length).toBeGreaterThan(800);
    const index = indexTimelineView(view);
    const rect = { x: 0, y: 0, w: view.width, h: view.height };
    const full = cullTimelineView(view, rect, undefined, index);
    const lod = timelineLod(0.45, 200);
    expect(lod.stride).toBeGreaterThan(1);
    expect(lod.tipsOnly).toBe(false);
    const sparse = cullTimelineView(view, rect, undefined, index, lod);
    expect(sparse.nodes.length).toBeLessThan(full.nodes.length);
    expect(sparse.nodes.length).toBeGreaterThan(full.nodes.length / 6);
    expect(sparse.nodes.some((n) => n.isHead)).toBe(true);
    expect(sparse.nodes.some((n) => !n.isHead && n.refs.length === 0)).toBe(true);
    expect(sparse.edges.some((e) => e.kind === "firstParent" && e.fromColumn === e.toColumn)).toBe(
      true,
    );
  });

  it("culls a 2_000-commit river to a monitor-sized frustum", () => {
    const view = layoutTimelineView(longDivergedTimeline(1_000));
    expect(view.nodes.length).toBeGreaterThan(2_000);
    const index = indexTimelineView(view);
    const cam = focusCamera(view.head!, 1.65, { width: 800, height: 400 });
    const rect = worldRect(cam, { width: 800, height: 400 });
    const culled = cullTimelineView(view, rect, view.head ? new Set([view.head.id]) : undefined, index);
    expect(culled.nodes.length).toBeLessThan(80);
    expect(culled.edges.length).toBeLessThan(120);
    expect(culled.nodes.some((n) => n.isHead)).toBe(true);
  });

  it("keeps a selected off-screen node when the index is used", () => {
    const view = layoutTimelineView(longDivergedTimeline(200));
    const index = indexTimelineView(view);
    const first = view.nodes[0];
    const last = view.nodes.at(-1)!;
    const rect = { x: last.x - 10, y: last.y - 10, w: 20, h: 20 };
    const culled = cullTimelineView(view, rect, new Set([first.id]), index);
    expect(culled.nodes.map((n) => n.id)).toContain(first.id);
  });
});

describe("clipRiverX", () => {
  it("clips the sacred river to the visible x-range", () => {
    const view = layoutTimelineView(linearTimeline());
    const clip = clipRiverX(view, { x: 40, y: 0, w: 80, h: 40 });
    expect(clip).not.toBeNull();
    expect(clip!.x).toBeGreaterThanOrEqual(24);
    expect(clip!.x + clip!.width).toBeLessThanOrEqual(view.width - 24 + 1);
    expect(clipRiverX(view, { x: view.width + 50, y: 0, w: 10, h: 10 })).toBeNull();
  });
});

describe("listTimelineTags", () => {
  it("returns no seals when the timeline has no tags", () => {
    expect(listTimelineTags(linearTimeline())).toEqual([]);
  });

  it("lists every tag with its nexus, newest first", () => {
    const tags = listTimelineTags(taggedTimeline());
    expect(tags.map((t) => t.name)).toEqual(["v-feat", "v3.0", "v2.0", "v1.0"]);
    expect(tags.map((t) => t.id)).toEqual(["e", "d", "c", "b"]);
    expect(tags.find((t) => t.name === "v3.0")).toMatchObject({
      shortId: "d",
      summary: "tip",
      isHead: true,
      isSacred: true,
    });
    expect(tags.find((t) => t.name === "v-feat")).toMatchObject({
      isSacred: false,
      isHead: false,
    });
  });

  it("emits one row per seal when a nexus carries several tags", () => {
    const timeline = taggedTimeline();
    const tip = timeline.nodes.find((n) => n.id === "d")!;
    tip.refs = [...tip.refs, { name: "v3.0-rc", kind: "tag" }];
    const names = listTimelineTags(timeline).filter((t) => t.id === "d").map((t) => t.name);
    expect(names).toEqual(["v3.0", "v3.0-rc"]);
  });
});
