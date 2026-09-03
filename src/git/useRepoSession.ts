import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { openRepository } from "@/git/api";
import { getTimeline } from "@/timeline/api";
import { getStatus } from "@/worktree/api";
import { aheadBehind, githubOrigin, listRemotes } from "@/remotes/api";
import { errMessage, sameJson } from "@/app/helpers";
import type { RepoSummary } from "@/git/types";
import type { Timeline } from "@/timeline/types";
import type { StatusPayload } from "@/worktree/types";
import type { AheadBehind, RemoteInfo } from "@/remotes/types";

function originRemote(remotes: RemoteInfo[]): RemoteInfo | null {
  return remotes.find((r) => r.name === "origin") ?? null;
}

const RESCAN_MS = 2500;

export type LoadOptions = {
  keepSelection?: boolean;
  quiet?: boolean;
};

function sameRepo(a: RepoSummary | null, b: RepoSummary): boolean {
  return (
    !!a &&
    a.path === b.path &&
    a.name === b.name &&
    a.head === b.head &&
    a.branch === b.branch
  );
}

export function useRepoSession(
  afterQuietLoadRef?: MutableRefObject<(() => Promise<void>) | null>,
) {
  const [repo, setRepo] = useState<RepoSummary | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState<RemoteInfo | null>(null);
  const [pushRemote, setPushRemote] = useState<RemoteInfo | null>(null);
  const [sync, setSync] = useState<AheadBehind | null>(null);

  const busyRef = useRef(false);
  const repoPathRef = useRef<string | null>(null);
  busyRef.current = busy;
  repoPathRef.current = repo?.path ?? null;

  const loadAll = useCallback(async (path: string, options: LoadOptions = {}) => {
    const { keepSelection = false, quiet = false } = options;
    if (!quiet) {
      setBusy(true);
      setError(null);
    }
    try {
      const summary = await openRepository(path);
      const [nextTimeline, nextStatus, nextOrigin, remotes, nextSync] = await Promise.all([
        getTimeline(path),
        getStatus(path),
        githubOrigin(path).catch(() => null),
        listRemotes(path).catch(() => [] as RemoteInfo[]),
        aheadBehind(path).catch(() => null),
      ]);
      setRepo((prev) => (sameRepo(prev, summary) ? prev! : summary));
      setTimeline((prev) => (prev && sameJson(prev, nextTimeline) ? prev : nextTimeline));
      setStatus((prev) => (prev && sameJson(prev, nextStatus) ? prev : nextStatus));
      setOrigin(nextOrigin);
      setPushRemote(originRemote(remotes));
      setSync(nextSync);
      setSelectedId((current) => {
        if (keepSelection && current && nextTimeline.nodes.some((n) => n.id === current)) {
          return current;
        }
        return nextTimeline.head ?? nextTimeline.nodes.at(-1)?.id ?? null;
      });
      return summary;
    } catch (err) {
      if (!quiet) setError(errMessage(err));
      return null;
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!repo) return;
    const path = repo.path;
    let cancelled = false;
    let inFlight = false;
    let pending = false;

    const rescan = async () => {
      if (cancelled || busyRef.current) return;
      if (inFlight) {
        pending = true;
        return;
      }
      inFlight = true;
      try {
        await loadAll(path, { keepSelection: true, quiet: true });
        if (!cancelled) await afterQuietLoadRef?.current?.();
      } finally {
        inFlight = false;
        if (pending && !cancelled) {
          pending = false;
          void rescan();
        }
      }
    };

    const onFocus = () => {
      if (document.visibilityState === "visible") void rescan();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void rescan();
    }, RESCAN_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [repo?.path, loadAll]);

  const resetSession = useCallback(() => {
    setBusy(false);
    setError(null);
    setRepo(null);
    setTimeline(null);
    setStatus(null);
    setSelectedId(null);
    setOrigin(null);
    setPushRemote(null);
    setSync(null);
  }, []);

  return {
    repo,
    timeline,
    status,
    setStatus,
    selectedId,
    setSelectedId,
    error,
    setError,
    busy,
    setBusy,
    origin,
    pushRemote,
    sync,
    loadAll,
    resetSession,
    repoPathRef,
    busyRef,
  };
}
