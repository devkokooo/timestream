import type { PrStack, PullRequestSummary } from "./types";

/** Consecutive PRs where one's base is another's head. Visualization only — no rebase. */
export function detectStacks(prs: PullRequestSummary[]): PrStack[] {
  const open = prs.filter((p) => p.state === "open");
  const byHead = new Map(open.map((p) => [p.headRef, p]));
  const children = new Set(
    open.filter((p) => byHead.has(p.baseRef)).map((p) => p.number),
  );
  const roots = open.filter((p) => !children.has(p.number) && open.some((o) => o.baseRef === p.headRef));
  const stacks: PrStack[] = [];
  for (const root of roots) {
    const items = [root];
    let cursor = root.headRef;
    while (true) {
      const next = open.find((p) => p.baseRef === cursor && !items.includes(p));
      if (!next) break;
      items.push(next);
      cursor = next.headRef;
    }
    if (items.length >= 2) {
      stacks.push({ base: root.baseRef, items });
    }
  }
  return stacks;
}
