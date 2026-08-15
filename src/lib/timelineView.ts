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

export interface ViewLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "ref" | "head" | "incursion";
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
  laneGap: number;
  rowWidth: number;
  minColumn: number;
  maxColumn: number;
}

const DEFAULTS: ViewOptions = {
  rowWidth: 76,
  laneGap: 56,
  paddingX: 88,
  paddingY: 72,
  nodeRadius: 7,
};

export function laneGapFor(laneCount: number): number {
  if (laneCount <= 1) return 56;
  if (laneCount <= 3) return 56;
  if (laneCount <= 8) return 40;
  return Math.max(22, Math.round(280 / laneCount));
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
  const dx = Math.max(28, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Pan/zoom so `point` sits in the middle of the monitor viewport. */
export function focusCamera(
  point: { x: number; y: number },
  scale: number,
  viewport: { width: number; height: number },
): { x: number; y: number; scale: number } {
  return {
    x: viewport.width / 2 - point.x * scale,
    y: viewport.height / 2 - point.y * scale,
    scale,
  };
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

export function placeLabels(nodes: ViewNode[]): ViewLabel[] {
  const placed: ViewLabel[] = [];
  const labeled = nodes.filter((n) => n.refs.length > 0 || n.isHead);

  for (const node of labeled) {
    const names =
      node.id === INCURSION_ID
        ? ["INCURSION"]
        : node.refs.filter((r) => r.kind !== "head").map((r) => r.name);
    if (node.isHead && node.id !== INCURSION_ID && !names.includes("HEAD")) {
      names.unshift("NOW");
    }
    if (names.length === 0) continue;

    const text = names.join(" · ");
    const w = estimateLabelWidth(text);
    const h = 16;
    let candidate = {
      id: node.id,
      text,
      x: node.x + node.r + 10,
      y: node.y - 22,
      w,
      h,
      kind:
        node.id === INCURSION_ID
          ? ("incursion" as const)
          : node.isHead
            ? ("head" as const)
            : ("ref" as const),
    };

    const nudges = [0, -18, 18, -36, 36, 54, -54];
    for (const dy of nudges) {
      const next = { ...candidate, y: node.y - 22 + dy };
      if (!placed.some((other) => boxesOverlap(next, other))) {
        candidate = next;
        break;
      }
    }
    placed.push(candidate);
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

  return {
    nodes,
    edges,
    labels,
    width: Math.max(width, 480),
    height: Math.max(height, 220),
    sacredY: yForColumn(0, minColumn, laneGap, paddingY),
    laneGap,
    rowWidth,
    minColumn,
    maxColumn,
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
