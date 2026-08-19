import type { FileChange } from "@/git/types";
import type { StatusPayload } from "@/worktree/types";

export type DiffTarget =
  | { kind: "commit"; path: string }
  | { kind: "staged"; path: string }
  | { kind: "unstaged"; path: string };

export function statusFile(
  status: StatusPayload | null,
  target: DiffTarget | null,
): FileChange | null {
  if (!status || !target || target.kind === "commit") return null;
  const list =
    target.kind === "staged"
      ? status.staged
      : [...status.unstaged, ...status.untracked];
  return list.find((file) => file.path === target.path) ?? null;
}

export function firstWorktreeTarget(status: StatusPayload | null): DiffTarget | null {
  if (!status) return null;
  const unfiled = [...status.unstaged, ...status.untracked];
  if (unfiled[0]) return { kind: "unstaged", path: unfiled[0].path };
  if (status.staged[0]) return { kind: "staged", path: status.staged[0].path };
  return null;
}

export function followWorktreeTarget(
  status: StatusPayload | null,
  target: DiffTarget | null,
): DiffTarget | null {
  if (!status || !target || target.kind === "commit") return null;
  if (statusFile(status, target)) return target;
  const other: DiffTarget = {
    kind: target.kind === "staged" ? "unstaged" : "staged",
    path: target.path,
  };
  if (statusFile(status, other)) return other;
  return firstWorktreeTarget(status);
}

export function targetsEqual(a: DiffTarget | null, b: DiffTarget | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.path === b.path;
}
