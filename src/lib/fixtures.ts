import type { Timeline, TimelineNode, VariantDossier } from "./types";

function node(
  id: string,
  column: number,
  row: number,
  extra: Partial<TimelineNode> = {},
): TimelineNode {
  return {
    id,
    shortId: id.slice(0, 7),
    parents: extra.parents ?? [],
    summary: extra.summary ?? id,
    author: "Analyst",
    email: "analyst@tva.local",
    timestamp: row,
    column,
    row,
    refs: extra.refs ?? [],
    isHead: extra.isHead ?? false,
  };
}

function dossier(
  name: string,
  tip: string,
  extra: Partial<VariantDossier> = {},
): VariantDossier {
  return {
    name,
    tip,
    isSacred: extra.isSacred ?? false,
    isHead: extra.isHead ?? false,
    exclusiveCommits: extra.exclusiveCommits ?? 0,
    divergeRow: extra.divergeRow ?? 0,
    commitsApart: extra.commitsApart ?? 0,
    threat: extra.threat ?? "low",
    isUpstream: extra.isUpstream ?? false,
  };
}

export function linearTimeline(): Timeline {
  return {
    sacredBranch: "main",
    head: "d",
    nodes: [
      node("a", 0, 0, { summary: "root" }),
      node("b", 0, 1, { parents: ["a"], summary: "second" }),
      node("c", 0, 2, { parents: ["b"], summary: "third" }),
      node("d", 0, 3, {
        parents: ["c"],
        summary: "tip",
        isHead: true,
        refs: [{ name: "main", kind: "branch" }],
      }),
    ],
    edges: [
      { from: "a", to: "b", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 0, toRow: 1 },
      { from: "b", to: "c", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 1, toRow: 2 },
      { from: "c", to: "d", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 2, toRow: 3 },
    ],
    dossiers: [dossier("main", "d", { isSacred: true, isHead: true })],
  };
}

export function manyBranchesTimeline(count = 8): Timeline {
  const nodes: TimelineNode[] = [
    node("nexus", 0, 0, { summary: "nexus" }),
    node("sacred", 0, 1, {
      parents: ["nexus"],
      summary: "sacred tip",
      isHead: true,
      refs: [{ name: "main", kind: "branch" }],
    }),
  ];
  const edges = [
    {
      from: "nexus",
      to: "sacred",
      kind: "firstParent" as const,
      fromColumn: 0,
      toColumn: 0,
      fromRow: 0,
      toRow: 1,
    },
  ];
  const dossiers: VariantDossier[] = [
    dossier("main", "sacred", { isSacred: true, isHead: true }),
  ];

  for (let i = 1; i <= count; i++) {
    const col = i % 2 === 1 ? Math.ceil(i / 2) : -Math.ceil(i / 2);
    const id = `v${i}`;
    nodes.push(
      node(id, col, 1 + i, {
        parents: ["nexus"],
        summary: `variant ${i}`,
        refs: [{ name: `var-${i}`, kind: "branch" }],
      }),
    );
    edges.push({
      from: "nexus",
      to: id,
      kind: "firstParent",
      fromColumn: 0,
      toColumn: col,
      fromRow: 0,
      toRow: 1 + i,
    });
    dossiers.push(
      dossier(`var-${i}`, id, { exclusiveCommits: 1, commitsApart: 2, threat: "low" }),
    );
  }

  return { sacredBranch: "main", head: "sacred", nodes, edges, dossiers };
}

export function longDivergedTimeline(length = 24): Timeline {
  const nodes: TimelineNode[] = [node("root", 0, 0, { summary: "root" })];
  const edges = [];
  for (let i = 1; i <= length; i++) {
    const id = `s${i}`;
    const parent = i === 1 ? "root" : `s${i - 1}`;
    nodes.push(
      node(id, 0, i, {
        parents: [parent],
        summary: `sacred ${i}`,
        isHead: i === length,
        refs: i === length ? [{ name: "main", kind: "branch" }] : [],
      }),
    );
    edges.push({
      from: parent,
      to: id,
      kind: "firstParent" as const,
      fromColumn: 0,
      toColumn: 0,
      fromRow: i - 1,
      toRow: i,
    });
  }
  for (let i = 1; i <= length; i++) {
    const id = `v${i}`;
    const parent = i === 1 ? "root" : `v${i - 1}`;
    const row = length + i;
    nodes.push(
      node(id, 1, row, {
        parents: [parent],
        summary: `variant ${i}`,
        refs: i === length ? [{ name: "long-feature", kind: "branch" }] : [],
      }),
    );
    edges.push({
      from: parent,
      to: id,
      kind: "firstParent" as const,
      fromColumn: parent === "root" ? 0 : 1,
      toColumn: 1,
      fromRow: parent === "root" ? 0 : length + i - 1,
      toRow: row,
    });
  }
  return {
    sacredBranch: "main",
    head: `s${length}`,
    nodes,
    edges,
    dossiers: [
      dossier("main", `s${length}`, { isSacred: true, isHead: true }),
      dossier("long-feature", `v${length}`, {
        exclusiveCommits: length,
        commitsApart: length * 2,
        threat: "severe",
      }),
    ],
  };
}

export function crowdedTipsTimeline(): Timeline {
  return {
    sacredBranch: "main",
    head: "c",
    nodes: [
      node("a", 0, 0),
      node("b", 0, 1, { parents: ["a"] }),
      node("c", 0, 2, {
        parents: ["b"],
        isHead: true,
        refs: [
          { name: "main", kind: "branch" },
          { name: "release", kind: "branch" },
        ],
      }),
      node("d", 1, 2, {
        parents: ["b"],
        refs: [{ name: "feature", kind: "branch" }],
      }),
      node("e", -1, 2, {
        parents: ["b"],
        refs: [{ name: "hotfix", kind: "branch" }],
      }),
    ],
    edges: [
      { from: "a", to: "b", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 0, toRow: 1 },
      { from: "b", to: "c", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 1, toRow: 2 },
      { from: "b", to: "d", kind: "firstParent", fromColumn: 0, toColumn: 1, fromRow: 1, toRow: 2 },
      { from: "b", to: "e", kind: "firstParent", fromColumn: 0, toColumn: -1, fromRow: 1, toRow: 2 },
    ],
    dossiers: [
      dossier("main", "c", { isSacred: true, isHead: true }),
      dossier("release", "c"),
      dossier("feature", "d", { exclusiveCommits: 1, commitsApart: 2 }),
      dossier("hotfix", "e", { exclusiveCommits: 1, commitsApart: 2 }),
    ],
  };
}

/** Current local branch, another local variant, and a remote-only spur. */
export function mixedRefTimeline(): Timeline {
  return {
    sacredBranch: "main",
    head: "c",
    nodes: [
      node("a", 0, 0),
      node("b", 0, 1, { parents: ["a"] }),
      node("c", 0, 2, {
        parents: ["b"],
        isHead: true,
        refs: [
          { name: "main", kind: "branch" },
          { name: "origin/main", kind: "remote" },
        ],
      }),
      node("d", 1, 2, {
        parents: ["b"],
        refs: [{ name: "feature", kind: "branch" }],
      }),
      node("e", -1, 2, {
        parents: ["b"],
        refs: [{ name: "origin/hotfix", kind: "remote" }],
      }),
    ],
    edges: [
      { from: "a", to: "b", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 0, toRow: 1 },
      { from: "b", to: "c", kind: "firstParent", fromColumn: 0, toColumn: 0, fromRow: 1, toRow: 2 },
      { from: "b", to: "d", kind: "firstParent", fromColumn: 0, toColumn: 1, fromRow: 1, toRow: 2 },
      { from: "b", to: "e", kind: "firstParent", fromColumn: 0, toColumn: -1, fromRow: 1, toRow: 2 },
    ],
    dossiers: [
      dossier("main", "c", { isSacred: true, isHead: true }),
      dossier("feature", "d", { exclusiveCommits: 1, commitsApart: 2 }),
      dossier("origin/hotfix", "e", {
        exclusiveCommits: 1,
        commitsApart: 2,
        isUpstream: true,
      }),
    ],
  };
}
