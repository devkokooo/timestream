export type Topology = "linear" | "spurs" | "nexus";

export interface SpecimenNode {
  x: number;
  y: number;
  stroke: string;
  r?: number;
  tagged?: boolean;
}

export interface SpecimenEdge {
  d: string;
  stroke: string;
  width?: number;
}

export interface SpecimenLabel {
  x: number;
  y: number;
  text: string;
  fill: string;
  kind?: "ref" | "head" | "tag";
}

export interface Specimen {
  id: Topology;
  stamp: string;
  label: string;
  caption: string;
  height?: number;
  edges: SpecimenEdge[];
  nodes: SpecimenNode[];
  labels?: SpecimenLabel[];
}

const GOLD = "#E8B86D";
const GOLD_BRIGHT = "#F4C430";
const ORANGE = "#E85D04";
const ORANGE_HOT = "#FF7A1A";
const STAMP = "#C23B22";
const MUTED = "#9A8B74";
const PAPER = "#D4C19A";

export const SPECIMENS: Specimen[] = [
  {
    id: "linear",
    stamp: "LINEAR",
    label: "Commit graph",
    caption: "One lane. Default branch only.",
    edges: [{ d: "M36 140 H604", stroke: GOLD, width: 6 }],
    nodes: [
      { x: 72, y: 140, stroke: GOLD, r: 16 },
      { x: 168, y: 140, stroke: GOLD, r: 16 },
      { x: 264, y: 140, stroke: GOLD, r: 16 },
      { x: 360, y: 140, stroke: GOLD_BRIGHT, r: 16, tagged: true },
      { x: 456, y: 140, stroke: GOLD, r: 16 },
      { x: 552, y: 140, stroke: GOLD, r: 16 },
    ],
    labels: [
      { x: 360, y: 118, text: "v0.1", fill: GOLD, kind: "tag" },
      { x: 552, y: 168, text: "NOW · sacred", fill: GOLD_BRIGHT, kind: "head" },
    ],
  },
  {
    id: "spurs",
    stamp: "SPURS",
    label: "Commit graph",
    caption: "Other branches fork off the default.",
    height: 500,
    edges: [
      { d: "M36 140 H604", stroke: GOLD, width: 6 },
      { d: "M264 140 L330 50 H510", stroke: ORANGE, width: 5 },
      { d: "M72 140 L130 210 H260", stroke: MUTED, width: 5 },
      { d: "M360 140 L430 268 H580", stroke: GOLD_BRIGHT, width: 5 },
      { d: "M168 140 L248 352 H530", stroke: ORANGE_HOT, width: 5 },
      { d: "M264 140 L350 452 H560", stroke: STAMP, width: 5 },
    ],
    nodes: [
      { x: 72, y: 140, stroke: GOLD, r: 15 },
      { x: 168, y: 140, stroke: GOLD, r: 15 },
      { x: 264, y: 140, stroke: GOLD, r: 15 },
      { x: 360, y: 140, stroke: GOLD, r: 15, tagged: true },
      { x: 456, y: 140, stroke: GOLD, r: 15 },
      { x: 552, y: 140, stroke: GOLD_BRIGHT, r: 16 },
      { x: 400, y: 50, stroke: ORANGE, r: 13 },
      { x: 500, y: 50, stroke: ORANGE, r: 13 },
      { x: 185, y: 210, stroke: MUTED, r: 13 },
      { x: 255, y: 210, stroke: MUTED, r: 13 },
      { x: 480, y: 268, stroke: GOLD_BRIGHT, r: 13 },
      { x: 570, y: 268, stroke: GOLD_BRIGHT, r: 13, tagged: true },
      { x: 320, y: 352, stroke: ORANGE_HOT, r: 13 },
      { x: 420, y: 352, stroke: ORANGE_HOT, r: 13 },
      { x: 520, y: 352, stroke: ORANGE_HOT, r: 13 },
      { x: 420, y: 452, stroke: STAMP, r: 13 },
      { x: 500, y: 452, stroke: STAMP, r: 13, tagged: true },
      { x: 560, y: 452, stroke: STAMP, r: 13 },
    ],
    labels: [
      { x: 360, y: 118, text: "v0.1", fill: GOLD, kind: "tag" },
      { x: 552, y: 168, text: "NOW · sacred", fill: GOLD_BRIGHT, kind: "head" },
      { x: 500, y: 36, text: "hotfix", fill: ORANGE, kind: "ref" },
      { x: 255, y: 232, text: "chore", fill: MUTED, kind: "ref" },
      { x: 570, y: 248, text: "v0.1-rc", fill: GOLD, kind: "tag" },
      { x: 570, y: 290, text: "feature", fill: GOLD_BRIGHT, kind: "ref" },
      { x: 520, y: 374, text: "docs", fill: ORANGE_HOT, kind: "ref" },
      { x: 500, y: 434, text: "nightly", fill: PAPER, kind: "tag" },
      { x: 560, y: 474, text: "wip", fill: STAMP, kind: "ref" },
    ],
  },
  {
    id: "nexus",
    stamp: "NEXUS",
    label: "Commit graph",
    caption: "Branches merge back into the default.",
    edges: [
      { d: "M36 140 H264", stroke: GOLD, width: 6 },
      { d: "M264 140 L340 54 H430 L500 140", stroke: ORANGE, width: 5 },
      { d: "M264 140 L340 226 H430 L500 140", stroke: GOLD_BRIGHT, width: 5 },
      { d: "M500 140 H604", stroke: GOLD, width: 6 },
    ],
    nodes: [
      { x: 72, y: 140, stroke: GOLD, r: 16 },
      { x: 168, y: 140, stroke: GOLD, r: 16 },
      { x: 264, y: 140, stroke: GOLD, r: 16 },
      { x: 390, y: 54, stroke: ORANGE, r: 16 },
      { x: 390, y: 226, stroke: GOLD_BRIGHT, r: 16 },
      { x: 500, y: 140, stroke: GOLD_BRIGHT, r: 18 },
      { x: 568, y: 140, stroke: GOLD, r: 16 },
    ],
  },
];
