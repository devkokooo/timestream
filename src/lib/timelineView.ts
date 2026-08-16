import {
  createSpatialGrid,
  insertAabb,
  queryGrid,
  type CullRect,
  type SpatialGrid,
} from "./cull";
import type { Timeline, TimelineEdge, TimelineNode, VariantDossier } from "./types";

export interface ViewOptions {
  rowWidth: number;
  laneGap: number;
  paddingX: number;
  paddingY: number;
  nodeRadius: number;
  /** Draw a forming nexus for uncommitted work, sprouting from HEAD. */
  incursion?: boolean;
}

export interface ViewNode extends TimelineNode {
  x: number;
  y: number;
  r: number;
  side: "sacred" | "above" | "below";
}

export interface ViewEdge extends TimelineEdge {
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type RefTone = "current" | "local" | "remote" | "incursion" | "tag";

export const REF_TONE_FILL: Record<RefTone, string> = {
  current: "#f4c430",
  local: "#e85d04",
  remote: "#9a8b74",
  incursion: "#e85d04",
  tag: "#e8b86d",
};

export interface LabelSegment {
  text: string;
  tone: RefTone;
}

export interface ViewLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "ref" | "head" | "incursion" | "tag";
  segments: LabelSegment[];
}

/** Synthetic view-only id for uncommitted work on the Sacred Timeline. */
export const INCURSION_ID = "tva:incursion";

export interface TimelineView {
  nodes: ViewNode[];
  edges: ViewEdge[];
  labels: ViewLabel[];
  width: number;
  height: number;
  sacredY: number;
  currentColumn: number;
  laneGap: number;
  rowWidth: number;
  minColumn: number;
  maxColumn: number;
  maxRow: number;
  head: ViewNode | null;
}

export interface TimelineCullIndex {
  nodes: SpatialGrid<ViewNode>;
  edges: SpatialGrid<ViewEdge>;
  labels: SpatialGrid<ViewLabel>;
  nodeById: Map<string, ViewNode>;
  labelById: Map<string, ViewLabel>;
  edgesByNode: Map<string, ViewEdge[]>;
}

export interface LodPolicy {
  /** Keep every Nth unlabeled node; 1 keeps all. */
  stride: number;
  /** Drop unlabeled nodes that are not forced by keepIds. */
  tipsOnly: boolean;
}

const DEFAULTS: ViewOptions = {
  rowWidth: 76,
  laneGap: 22,
  paddingX: 88,
  paddingY: 72,
  nodeRadius: 7,
};

/** Tight TVA fiber spacing — variants hug the sacred river instead of sitting on distant rails. */
export function laneGapFor(laneCount: number): number {
  if (laneCount <= 1) return 22;
  if (laneCount <= 3) return 22;
  if (laneCount <= 8) return 18;
  return Math.max(14, Math.round(120 / laneCount));
}

export function yForColumn(
  column: number,
  minColumn: number,
  laneGap: number,
  paddingY: number,
): number {
  return paddingY + (column - minColumn) * laneGap;
}

export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  if (y1 === y2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const span = Math.max(x2 - x1, 16);
  const peel = Math.min(36, Math.max(14, span * 0.38));
  return `M ${x1} ${y1} C ${x2 - peel} ${y1}, ${x2 - peel * 0.35} ${y2}, ${x2} ${y2}`;
}

export type Camera = { x: number; y: number; scale: number };

/** Pan/zoom so `point` sits in the middle of the monitor viewport. */
export function focusCamera(
  point: { x: number; y: number },
  scale: number,
  viewport: { width: number; height: number },
): Camera {
  return {
    x: viewport.width / 2 - point.x * scale,
    y: viewport.height / 2 - point.y * scale,
    scale,
  };
}

export function easeOutCubic(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - (1 - x) ** 3;
}

/** Interpolate a camera pose. `t` is 0..1 and is eased. */
export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  const e = easeOutCubic(t);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    scale: from.scale + (to.scale - from.scale) * e,
  };
}

export type WorldRect = CullRect;

/** Graph-space AABB covered by the monitor, plus `pad` in world units. */
export function worldRect(
  camera: Camera,
  viewport: { width: number; height: number },
  pad = 200,
): WorldRect {
  const scale = camera.scale <= 0 ? 1 : camera.scale;
  return {
    x: -camera.x / scale - pad,
    y: -camera.y / scale - pad,
    w: viewport.width / scale + pad * 2,
    h: viewport.height / scale + pad * 2,
  };
}

/** Monitor-pixel position of a world point under the current camera. */
export function screenPoint(point: { x: number; y: number }, camera: Camera): { x: number; y: number } {
  return { x: camera.x + point.x * camera.scale, y: camera.y + point.y * camera.scale };
}

export const TOOLTIP_GAP = 40;

/**
 * Anchor a constant-size slip on a nexus. Prefers above the orb; flips below
 * when the card would clip the top of the monitor. `x`/`y` are the attach
 * point — the card then translates by its own size (`-50%` / `-100%` or `0`).
 */
export function tooltipPlacement(
  node: { x: number; y: number; r: number },
  camera: Camera,
  viewport: { width: number; height: number },
  size: { w: number; h: number },
  gap = TOOLTIP_GAP,
  pad = 8,
): { x: number; y: number; side: "above" | "below" } {
  const origin = screenPoint(node, camera);
  const lift = node.r * camera.scale + gap;
  const half = size.w / 2;
  const minX = pad + half;
  const maxX = Math.max(minX, viewport.width - pad - half);
  const x = Math.min(maxX, Math.max(minX, origin.x));
  const aboveY = origin.y - lift;
  if (aboveY - size.h >= pad) {
    return { x, y: aboveY, side: "above" };
  }
  return { x, y: origin.y + lift, side: "below" };
}

function circleHitsRect(cx: number, cy: number, r: number, rect: WorldRect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, rect: WorldRect): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return !(maxX < rect.x || minX > rect.x + rect.w || maxY < rect.y || minY > rect.y + rect.h);
}

export function indexTimelineView(view: TimelineView, cell = 160): TimelineCullIndex {
  const nodes = createSpatialGrid<ViewNode>(0, 0, cell);
  const edges = createSpatialGrid<ViewEdge>(0, 0, cell);
  const labels = createSpatialGrid<ViewLabel>(0, 0, cell);
  const nodeById = new Map<string, ViewNode>();
  const labelById = new Map<string, ViewLabel>();
  const edgesByNode = new Map<string, ViewEdge[]>();

  for (const node of view.nodes) {
    nodeById.set(node.id, node);
    const pad = node.r + 16;
    insertAabb(nodes, node, {
      x: node.x - pad,
      y: node.y - pad,
      w: pad * 2,
      h: pad * 2,
    });
  }
  for (const edge of view.edges) {
    insertAabb(edges, edge, {
      x: Math.min(edge.x1, edge.x2),
      y: Math.min(edge.y1, edge.y2),
      w: Math.max(Math.abs(edge.x2 - edge.x1), 1),
      h: Math.max(Math.abs(edge.y2 - edge.y1), 1),
    });
    pushEdge(edgesByNode, edge.from, edge);
    pushEdge(edgesByNode, edge.to, edge);
  }
  for (const label of view.labels) {
    labelById.set(label.id, label);
    insertAabb(labels, label, label);
  }

  return { nodes, edges, labels, nodeById, labelById, edgesByNode };
}

function pushEdge(map: Map<string, ViewEdge[]>, id: string, edge: ViewEdge): void {
  const list = map.get(id);
  if (list) list.push(edge);
  else map.set(id, [edge]);
}

/**
 * Density LOD. Only thin unlabeled nexuses when the operator is zoomed far
 * out over a long river — a normal monitor must keep the full fiber.
 * `visibleRows` is horizontal extent (rect.w / rowWidth), not lane×row slots.
 */
export function timelineLod(scale: number, visibleRows: number): LodPolicy {
  if (scale <= 0.45 && visibleRows > 64) return { stride: 3, tipsOnly: false };
  if (scale <= 0.55 && visibleRows > 36) return { stride: 2, tipsOnly: false };
  return { stride: 1, tipsOnly: false };
}

function nodeIsTip(node: ViewNode): boolean {
  return node.isHead || node.refs.length > 0 || node.id === INCURSION_ID;
}

function keepLodNode(node: ViewNode, lod: LodPolicy | undefined, keepIds?: ReadonlySet<string>): boolean {
  if (!lod || (lod.stride <= 1 && !lod.tipsOnly)) return true;
  if (keepIds?.has(node.id) || nodeIsTip(node)) return true;
  if (lod.tipsOnly) return false;
  return Math.abs(node.row + node.column * 13) % lod.stride === 0;
}

export function cullTimelineView(
  view: TimelineView,
  rect: WorldRect,
  keepIds?: ReadonlySet<string>,
  index?: TimelineCullIndex,
  lod?: LodPolicy,
): { nodes: ViewNode[]; edges: ViewEdge[]; labels: ViewLabel[] } {
  const nodePool = index ? queryGrid(index.nodes, rect) : view.nodes;
  const nodes: ViewNode[] = [];
  const seenNodes = new Set<string>();
  for (const n of nodePool) {
    if (seenNodes.has(n.id)) continue;
    if (!keepIds?.has(n.id) && !circleHitsRect(n.x, n.y, n.r + 16, rect)) continue;
    if (!keepLodNode(n, lod, keepIds)) continue;
    seenNodes.add(n.id);
    nodes.push(n);
  }
  if (keepIds && index) {
    for (const id of keepIds) {
      if (seenNodes.has(id)) continue;
      const node = index.nodeById.get(id);
      if (!node) continue;
      seenNodes.add(id);
      nodes.push(node);
    }
  }

  const edgePool = index ? queryGrid(index.edges, rect) : view.edges;
  const edges: ViewEdge[] = [];
  const seenEdges = new Set<string>();
  const takeEdge = (e: ViewEdge) => {
    const key = `${e.from}:${e.to}:${e.kind}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push(e);
  };
  for (const e of edgePool) {
    const forced = Boolean(keepIds?.has(e.from) || keepIds?.has(e.to));
    if (!forced && !segmentHitsRect(e.x1, e.y1, e.x2, e.y2, rect)) continue;
    takeEdge(e);
  }
  if (keepIds && index) {
    for (const id of keepIds) {
      const extras = index.edgesByNode.get(id);
      if (!extras) continue;
      for (const e of extras) takeEdge(e);
    }
  }

  const labelPool = index ? queryGrid(index.labels, rect) : view.labels;
  const labels: ViewLabel[] = [];
  const seenLabels = new Set<string>();
  for (const l of labelPool) {
    if (seenLabels.has(l.id)) continue;
    if (!keepIds?.has(l.id) && !boxesOverlap(l, rect, 0)) continue;
    seenLabels.add(l.id);
    labels.push(l);
  }
  if (keepIds && index) {
    for (const id of keepIds) {
      if (seenLabels.has(id)) continue;
      const label = index.labelById.get(id);
      if (!label) continue;
      seenLabels.add(id);
      labels.push(label);
    }
  }

  return { nodes, edges, labels };
}

export function clipRiverX(
  view: Pick<TimelineView, "width">,
  rect: WorldRect,
  inset = 24,
): { x: number; width: number } | null {
  const left = inset;
  const right = inset + Math.max(view.width - inset * 2, 200);
  const x = Math.max(left, rect.x);
  const end = Math.min(right, rect.x + rect.w);
  const width = end - x;
  if (width <= 0) return null;
  return { x, width };
}

export function xInRect(x: number, rect: WorldRect): boolean {
  return x >= rect.x && x <= rect.x + rect.w;
}

/** One tone lookup per lane so edges don't filter the whole node list. */
export function laneTones(nodes: ViewNode[], currentColumn: number): Map<number, RefTone> {
  const map = new Map<number, RefTone>();
  map.set(currentColumn, "current");
  const local = new Set<number>();
  const remote = new Set<number>();
  for (const n of nodes) {
    if (n.column === currentColumn) continue;
    for (const r of n.refs) {
      if (r.kind === "branch") local.add(n.column);
      else if (r.kind === "remote") remote.add(n.column);
    }
  }
  for (const col of local) map.set(col, "local");
  for (const col of remote) {
    if (!map.has(col)) map.set(col, "remote");
  }
  for (const n of nodes) {
    if (!map.has(n.column)) map.set(n.column, "local");
  }
  return map;
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad = 4,
): boolean {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

export function estimateLabelWidth(text: string): number {
  return Math.max(28, Math.round(text.length * 7.1 + 16));
}

export function tagNames(node: Pick<TimelineNode, "refs">): string[] {
  return node.refs.filter((r) => r.kind === "tag").map((r) => r.name);
}

export function hasTag(node: Pick<TimelineNode, "refs">): boolean {
  return node.refs.some((r) => r.kind === "tag");
}

export interface TimelineTag {
  name: string;
  id: string;
  shortId: string;
  summary: string;
  author: string;
  email: string;
  timestamp: number;
  isHead: boolean;
  isSacred: boolean;
}

/** Every tag on the graph, newest first — one row per seal, even if they share a nexus. */
export function listTimelineTags(timeline: Pick<Timeline, "nodes">): TimelineTag[] {
  const tags: TimelineTag[] = [];
  for (const n of timeline.nodes) {
    for (const r of n.refs) {
      if (r.kind !== "tag") continue;
      tags.push({
        name: r.name,
        id: n.id,
        shortId: n.shortId,
        summary: n.summary,
        author: n.author,
        email: n.email,
        timestamp: n.timestamp,
        isHead: n.isHead,
        isSacred: n.column === 0,
      });
    }
  }
  tags.sort((a, b) => b.timestamp - a.timestamp || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return tags;
}

/** Local branch checked out at HEAD, if any. */
export function currentBranchName(timeline: Pick<Timeline, "dossiers">): string | null {
  return timeline.dossiers.find((d) => d.isHead && !d.isUpstream)?.name ?? null;
}

/** Ancestors of HEAD (current branch log), newest first. Skips unmerged variant tips. */
export function listBranchHistory(timeline: Pick<Timeline, "nodes" | "head">): TimelineNode[] {
  if (!timeline.head) return [];
  const byId = new Map(timeline.nodes.map((n) => [n.id, n]));
  const keep = new Set<string>();
  const stack = [timeline.head];
  while (stack.length) {
    const id = stack.pop()!;
    if (keep.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    keep.add(id);
    for (const parent of node.parents) stack.push(parent);
  }
  return timeline.nodes
    .filter((n) => keep.has(n.id))
    .sort((a, b) => b.row - a.row || b.timestamp - a.timestamp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Gold canon seal — tags are stamps on a nexus, not a variant fiber. */
export function diamondPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

export function refSegments(node: ViewNode): LabelSegment[] {
  if (node.id === INCURSION_ID) {
    return [{ text: "INCURSION", tone: "incursion" }];
  }
  const segments: LabelSegment[] = [];
  if (node.isHead) {
    segments.push({ text: "NOW", tone: "current" });
  }
  for (const ref of node.refs) {
    if (ref.kind === "head" || ref.kind === "tag") continue;
    if (ref.kind === "remote") {
      segments.push({ text: ref.name, tone: "remote" });
    } else if (node.isHead && ref.kind === "branch") {
      segments.push({ text: ref.name, tone: "current" });
    } else {
      segments.push({ text: ref.name, tone: "local" });
    }
  }
  return segments;
}

/** Color a lane: checked-out column, other local branches, or remote-only. */
export function columnTone(
  column: number,
  currentColumn: number,
  nodes: ViewNode[],
): RefTone {
  if (column === currentColumn) return "current";
  const lane = nodes.filter((n) => n.column === column);
  if (lane.some((n) => n.refs.some((r) => r.kind === "branch"))) return "local";
  if (lane.some((n) => n.refs.some((r) => r.kind === "remote"))) return "remote";
  return "local";
}

function settleLabel(
  placed: ViewLabel[],
  seed: ViewLabel,
  xNudges: number[],
  yNudges: number[],
): ViewLabel {
  for (const dx of xNudges) {
    for (const dy of yNudges) {
      const next = { ...seed, x: seed.x + dx, y: seed.y + dy };
      if (!placed.some((other) => boxesOverlap(next, other))) return next;
    }
  }
  return seed;
}

export function placeLabels(nodes: ViewNode[]): ViewLabel[] {
  const placed: ViewLabel[] = [];
  const labeled = nodes.filter((n) => n.refs.length > 0 || n.isHead);

  for (const node of labeled) {
    const tags = tagNames(node);
    if (tags.length > 0) {
      const text = tags.join(" · ");
      const seed: ViewLabel = {
        id: `${node.id}#tag`,
        text,
        x: node.x + node.r + 6,
        y: node.y - 14,
        w: estimateLabelWidth(text),
        h: 13,
        kind: "tag",
        segments: tags.map((name) => ({ text: name, tone: "tag" as const })),
      };
      placed.push(settleLabel(placed, seed, [0, 12, 24, 36], [0, -10, 10]));
    }

    const segments = refSegments(node);
    if (segments.length === 0) continue;
    const text = segments.map((s) => s.text).join(" · ");
    const away = node.side === "below" ? 1 : -1;
    const seed: ViewLabel = {
      id: node.id,
      text,
      x: node.x + node.r + 10,
      y: node.side === "below" ? node.y + 10 : node.y - 20,
      w: estimateLabelWidth(text),
      h: 16,
      kind:
        node.id === INCURSION_ID
          ? "incursion"
          : node.isHead
            ? "head"
            : "ref",
      segments,
    };
    placed.push(
      settleLabel(placed, seed, [0, 16, 32, 48], [0, 12 * away, 24 * away, -12 * away, 36 * away]),
    );
  }
  return placed;
}

export function layoutTimelineView(
  timeline: Timeline,
  opts: Partial<ViewOptions> = {},
): TimelineView {
  const columns = timeline.nodes.map((n) => n.column);
  const minColumn = columns.length ? Math.min(0, ...columns) : 0;
  const maxColumn = columns.length ? Math.max(0, ...columns) : 0;
  const laneCount = maxColumn - minColumn + 1;
  const laneGap = opts.laneGap ?? laneGapFor(laneCount);
  const rowWidth = opts.rowWidth ?? DEFAULTS.rowWidth;
  const paddingX = opts.paddingX ?? DEFAULTS.paddingX;
  const paddingY = opts.paddingY ?? DEFAULTS.paddingY;
  const nodeRadius = opts.nodeRadius ?? DEFAULTS.nodeRadius;

  const nodes: ViewNode[] = timeline.nodes.map((n) => ({
    ...n,
    x: paddingX + n.row * rowWidth,
    y: yForColumn(n.column, minColumn, laneGap, paddingY),
    r: n.isHead ? nodeRadius + 3 : nodeRadius,
    side: n.column === 0 ? "sacred" : n.column > 0 ? "below" : "above",
  }));

  const edges: ViewEdge[] = timeline.edges.map((e) => {
    const x1 = paddingX + e.fromRow * rowWidth;
    const y1 = yForColumn(e.fromColumn, minColumn, laneGap, paddingY);
    const x2 = paddingX + e.toRow * rowWidth;
    const y2 = yForColumn(e.toColumn, minColumn, laneGap, paddingY);
    return { ...e, d: edgePath(x1, y1, x2, y2), x1, y1, x2, y2 };
  });

  if (opts.incursion) {
    const head = nodes.find((n) => n.isHead) ?? nodes.at(-1);
    if (head) {
      const taken = new Set(nodes.filter((n) => n.column === head.column).map((n) => n.row));
      let row = head.row + 1;
      while (taken.has(row)) row += 1;
      const x = paddingX + row * rowWidth;
      const y = head.y;
      nodes.push({
        id: INCURSION_ID,
        shortId: "pending",
        parents: [head.id],
        summary: "Unfiled variance — temporal incursion",
        author: "",
        email: "",
        timestamp: 0,
        column: head.column,
        row,
        refs: [{ name: "INCURSION", kind: "head" }],
        isHead: false,
        x,
        y,
        r: nodeRadius + 1,
        side: head.side,
      });
      const x1 = head.x;
      const y1 = head.y;
      edges.push({
        from: head.id,
        to: INCURSION_ID,
        kind: "firstParent",
        fromColumn: head.column,
        toColumn: head.column,
        fromRow: head.row,
        toRow: row,
        d: edgePath(x1, y1, x, y),
        x1,
        y1,
        x2: x,
        y2: y,
      });
    }
  }

  const labels = placeLabels(nodes);
  const maxRow = nodes.reduce((m, n) => Math.max(m, n.row), 0);
  const width = paddingX * 2 + maxRow * rowWidth;
  const height = paddingY * 2 + Math.max(0, laneCount - 1) * laneGap;
  const head = nodes.find((n) => n.isHead) ?? null;
  const currentColumn = head?.column ?? 0;

  return {
    nodes,
    edges,
    labels,
    width: Math.max(width, 480),
    height: Math.max(height, 220),
    sacredY: yForColumn(0, minColumn, laneGap, paddingY),
    currentColumn,
    laneGap,
    rowWidth,
    minColumn,
    maxColumn,
    maxRow,
    head,
  };
}

export function assertViewConsistent(view: TimelineView): string[] {
  const errors: string[] = [];
  const positions = new Set<string>();

  for (const node of view.nodes) {
    const key = `${node.x}:${node.y}`;
    if (positions.has(key)) {
      errors.push(`overlapping view node at ${key} (${node.id})`);
    }
    positions.add(key);
    const expectedY = yForColumn(node.column, view.minColumn, view.laneGap, 72);
    if (Math.abs(node.y - expectedY) > 0.01) {
      errors.push(`node ${node.id} y drifted from its lane`);
    }
  }

  for (const edge of view.edges) {
    if (edge.fromRow >= edge.toRow) {
      errors.push(`edge ${edge.from}->${edge.to} does not flow forward`);
    }
    if (edge.fromColumn === edge.toColumn && !edge.d.includes("L")) {
      errors.push(`same-lane edge ${edge.from}->${edge.to} should be straight`);
    }
    if (edge.fromColumn !== edge.toColumn && !edge.d.includes("C")) {
      errors.push(`spur ${edge.from}->${edge.to} should be a curve`);
    }
  }

  for (let i = 0; i < view.labels.length; i++) {
    for (let j = i + 1; j < view.labels.length; j++) {
      if (boxesOverlap(view.labels[i], view.labels[j], 0)) {
        errors.push(
          `label collision ${view.labels[i].text} / ${view.labels[j].text}`,
        );
      }
    }
  }

  const sacred = view.nodes.filter((n) => n.column === 0);
  if (sacred.length && sacred.some((n) => n.y !== view.sacredY)) {
    errors.push("sacred nodes must share sacredY");
  }

  return errors;
}

export function threatCopy(level: VariantDossier["threat"]): string {
  if (level === "severe") return "SEVERE VARIANCE";
  if (level === "moderate") return "NEXUS RISK";
  return "WITHIN SEQUENCE";
}
