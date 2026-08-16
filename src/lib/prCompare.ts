import { formatLocalDateTime, formatRelativeTime } from "./relativeTime";
import type { PullRequestSummary, Timeline } from "./types";

/** GitHub head/base refs omit the `origin/` remote prefix. */
export function githubRefName(name: string): string {
  return name.replace(/^origin\//, "");
}

export function sameGitRef(a: string, b: string): boolean {
  return githubRefName(a) === githubRefName(b);
}

export function matchingPull(
  prs: PullRequestSummary[],
  head: string,
  base: string,
): PullRequestSummary | undefined {
  return prs.find((pr) => sameGitRef(pr.headRef, head) && sameGitRef(pr.baseRef, base));
}

/** Prefer recorded SHAs so a request still compares after the local name is gone. */
export function compareSpecs(
  selected: PullRequestSummary | null,
  head: string,
  base: string,
): { head: string; base: string } {
  if (
    selected &&
    sameGitRef(selected.headRef, head) &&
    sameGitRef(selected.baseRef, base)
  ) {
    return {
      head: selected.headSha || head,
      base: selected.baseSha || base,
    };
  }
  return { head, base };
}

/** Earliest event first, matching the request docket. */
export function orderLedgerCommits<T extends { id: string; timestamp: number }>(
  commits: T[],
): T[] {
  return [...commits].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}

export function ledgerDayKey(timestamp: number): string {
  const at = new Date(timestamp * 1000);
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

export function ledgerDayHeading(timestamp: number): string {
  const date = new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Commits on ${date}`;
}

export function groupLedgerByDay<T extends { id: string; timestamp: number }>(
  commits: T[],
): Array<{ key: string; heading: string; commits: T[] }> {
  const groups: Array<{ key: string; heading: string; commits: T[] }> = [];
  for (const commit of orderLedgerCommits(commits)) {
    const key = ledgerDayKey(commit.timestamp);
    const prev = groups[groups.length - 1];
    if (prev?.key === key) {
      prev.commits.push(commit);
      continue;
    }
    groups.push({ key, heading: ledgerDayHeading(commit.timestamp), commits: [commit] });
  }
  return groups;
}

export function ledgerWhen(timestamp: number, now = Date.now()): {
  iso: string;
  label: string;
  absolute: string;
} {
  const iso = new Date(timestamp * 1000).toISOString();
  const relative = formatRelativeTime(iso, now);
  return {
    iso,
    label: relative ? `committed ${relative}` : "",
    absolute: formatLocalDateTime(iso),
  };
}

export function branchChoices(
  timeline: Timeline | null,
  extras: Array<string | null | undefined>,
): string[] {
  const names = new Set<string>();
  for (const dossier of timeline?.dossiers ?? []) {
    names.add(dossier.name);
  }
  for (const extra of extras) {
    if (extra) names.add(extra);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
