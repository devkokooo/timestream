import type { AheadBehind } from "@/remotes/types";

/** True when HEAD is a local branch tip that has not been uploaded. */
export function canReviseLastFiling(
  sync: AheadBehind | null,
  onBranch: boolean,
  hasHead: boolean,
): boolean {
  if (!hasHead || !onBranch) return false;
  if (!sync?.upstream) return true;
  return sync.ahead > 0;
}
