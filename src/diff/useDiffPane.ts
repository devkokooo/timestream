import { useCallback, useEffect, useRef, useState } from "react";
import { getFileDiff, getWorktreeDiff } from "@/diff/api";
import { errMessage, sameJson } from "@/app/helpers";
import {
  statusFile,
  targetsEqual,
  type DiffTarget,
} from "@/diff/targets";
import type { CommitDetail } from "@/timeline/types";
import type { DiffMode, FileDiff } from "@/diff/types";
import type { StatusPayload } from "@/worktree/types";

export function useDiffPane({
  repoPath,
  selectedId,
  detail,
  status,
}: {
  repoPath: string | null;
  selectedId: string | null;
  detail: CommitDetail | null;
  status: StatusPayload | null;
}) {
  const [diffTarget, setDiffTarget] = useState<DiffTarget | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMounted, setDiffMounted] = useState(false);
  const [diffMountTarget, setDiffMountTarget] = useState<DiffTarget | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [diffError, setDiffError] = useState<string | null>(null);
  const diffTargetRef = useRef<DiffTarget | null>(null);
  const loadedDiffKeyRef = useRef<string | null>(null);
  diffTargetRef.current = diffTarget;

  useEffect(() => {
    if (diffTarget) {
      setDiffMounted(true);
      setDiffMountTarget(diffTarget);
    }
  }, [diffTarget]);

  useEffect(() => {
    if (!diffTarget || diffTarget.kind !== "commit") return;
    if (!detail || detail.id !== selectedId) return;
    if (!detail.files.some((file) => file.path === diffTarget.path)) {
      setDiffOpen(false);
      setDiffTarget(null);
    }
  }, [detail, diffTarget, selectedId]);

  const worktreeDiffKey =
    diffTarget && diffTarget.kind !== "commit" && statusFile(status, diffTarget)
      ? `${diffTarget.kind}:${diffTarget.path}`
      : null;
  const commitDiffKey =
    diffTarget?.kind === "commit" &&
    detail &&
    detail.id === selectedId &&
    detail.files.some((file) => file.path === diffTarget.path)
      ? `commit:${selectedId}:${diffTarget.path}`
      : null;
  const diffKey = worktreeDiffKey ?? commitDiffKey;

  useEffect(() => {
    if (!diffTarget || !repoPath) {
      loadedDiffKeyRef.current = null;
      setDiff(null);
      setDiffError(null);
      return;
    }
    if (!diffKey) return;
    const path = repoPath;
    const target = diffTarget;
    const switched = loadedDiffKeyRef.current !== diffKey;
    if (switched) {
      loadedDiffKeyRef.current = diffKey;
      setDiff(null);
      setDiffError(null);
    }
    let cancelled = false;
    const request =
      target.kind === "commit"
        ? getFileDiff(path, selectedId!, target.path)
        : getWorktreeDiff(path, target.path, target.kind === "staged");
    request
      .then((next) => {
        if (cancelled) return;
        setDiff((prev) => (prev && sameJson(prev, next) ? prev : next));
      })
      .catch((err) => {
        if (!cancelled) {
          setDiff(null);
          setDiffError(errMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [diffKey, diffTarget, repoPath, selectedId]);

  const refreshOpenWorktreeDiff = useCallback(async () => {
    const target = diffTargetRef.current;
    if (!repoPath || !target || target.kind === "commit") return;
    try {
      const next = await getWorktreeDiff(repoPath, target.path, target.kind === "staged");
      if (!targetsEqual(diffTargetRef.current, target)) return;
      setDiff((prev) => (prev && sameJson(prev, next) ? prev : next));
      setDiffError(null);
    } catch {
      /* keep pane */
    }
  }, [repoPath]);

  const activeTarget = diffTarget ?? diffMountTarget;
  const selectedFile =
    activeTarget?.kind === "commit"
      ? (detail?.files.find((file) => file.path === activeTarget.path) ?? null)
      : statusFile(status, activeTarget);
  const visibleDiff =
    diff &&
    activeTarget &&
    (diff.path === activeTarget.path || diff.oldPath === activeTarget.path)
      ? diff
      : null;

  const closeDiff = useCallback(() => {
    setDiffOpen(false);
    setDiffTarget(null);
  }, []);

  const resetDiff = useCallback(() => {
    setDiffTarget(null);
    setDiffOpen(false);
    setDiffMounted(false);
    setDiffMountTarget(null);
    setDiff(null);
    setDiffError(null);
  }, []);

  return {
    diffTarget,
    setDiffTarget,
    diffOpen,
    setDiffOpen,
    diffMounted,
    setDiffMounted,
    diffMountTarget,
    setDiffMountTarget,
    diffMode,
    setDiffMode,
    diffError,
    diffTargetRef,
    activeTarget,
    selectedFile,
    visibleDiff,
    closeDiff,
    resetDiff,
    refreshOpenWorktreeDiff,
  };
}

export type { DiffTarget };
