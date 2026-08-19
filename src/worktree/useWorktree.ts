import { useCallback, useEffect, useRef, useState } from "react";
import { getCommit } from "@/timeline/api";
import { fileCommit, stageFile, unstageFile } from "@/worktree/api";
import type { LoadOptions } from "@/git/useRepoSession";
import type { RepoSummary } from "@/git/types";
import type { Timeline } from "@/timeline/types";
import type { StatusPayload } from "@/worktree/types";
import {
  firstWorktreeTarget,
  followWorktreeTarget,
  targetsEqual,
  type DiffTarget,
} from "@/diff/targets";

export function useWorktree({
  repo,
  timeline,
  status,
  setStatus,
  loadAll,
  diffTarget,
  setDiffTarget,
  setDiffMounted,
  setDiffMountTarget,
}: {
  repo: RepoSummary | null;
  timeline: Timeline | null;
  status: StatusPayload | null;
  setStatus: (status: StatusPayload | null | ((prev: StatusPayload | null) => StatusPayload | null)) => void;
  loadAll: (path: string, options?: LoadOptions) => Promise<RepoSummary | null>;
  diffTarget: DiffTarget | null;
  setDiffTarget: (target: DiffTarget | null | ((prev: DiffTarget | null) => DiffTarget | null)) => void;
  setDiffMounted: (mounted: boolean) => void;
  setDiffMountTarget: (target: DiffTarget | null) => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [headFiling, setHeadFiling] = useState<{ summary: string; body: string } | null>(null);
  const reviewOpenRef = useRef(false);
  reviewOpenRef.current = reviewOpen;

  useEffect(() => {
    if (!reviewOpen || !repo || !timeline?.head) {
      setHeadFiling(null);
      return;
    }
    const head = timeline.head;
    let cancelled = false;
    getCommit(repo.path, head)
      .then((next) => {
        if (!cancelled) setHeadFiling({ summary: next.summary, body: next.body });
      })
      .catch(() => {
        if (!cancelled) setHeadFiling(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewOpen, repo, timeline?.head]);

  useEffect(() => {
    if (!reviewOpen || !status) return;
    if (diffTarget?.kind === "commit") return;
    const next = followWorktreeTarget(status, diffTarget) ?? firstWorktreeTarget(status);
    if (targetsEqual(diffTarget, next)) return;
    setDiffTarget(next);
    if (next) {
      setDiffMounted(true);
      setDiffMountTarget(next);
    } else {
      setDiffMounted(false);
      setDiffMountTarget(null);
    }
  }, [
    reviewOpen,
    status,
    diffTarget,
    setDiffTarget,
    setDiffMounted,
    setDiffMountTarget,
  ]);

  const closeReview = useCallback(() => {
    setReviewOpen(false);
    if (diffTarget && diffTarget.kind !== "commit") {
      setDiffTarget(null);
      setDiffMounted(false);
      setDiffMountTarget(null);
    }
  }, [diffTarget, setDiffMounted, setDiffMountTarget, setDiffTarget]);

  const stage = useCallback(
    async (rel: string) => {
      if (!repo) return;
      setStatus(await stageFile(repo.path, rel));
    },
    [repo, setStatus],
  );

  const unstage = useCallback(
    async (rel: string) => {
      if (!repo) return;
      setStatus(await unstageFile(repo.path, rel));
    },
    [repo, setStatus],
  );

  const commit = useCallback(
    async (message: string, amend: boolean) => {
      if (!repo) return;
      await fileCommit(repo.path, message, amend);
      await loadAll(repo.path, { keepSelection: true });
    },
    [loadAll, repo],
  );

  return {
    reviewOpen,
    setReviewOpen,
    reviewOpenRef,
    headFiling,
    closeReview,
    stage,
    unstage,
    commit,
  };
}
