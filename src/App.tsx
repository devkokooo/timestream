import { useCallback, useEffect, useRef, useState } from "react";
import { AnomalyDock } from "./components/AnomalyDock";
import { BureauHeader } from "./components/BureauHeader";
import { CaseFile } from "./components/CaseFile";
import { DiffViewer } from "./components/DiffViewer";
import { SacredTimeline } from "./components/SacredTimeline";
import { VariantRail } from "./components/VariantRail";
import { WelcomeGate } from "./components/WelcomeGate";
import {
  fileCommit,
  getCommit,
  getFileDiff,
  getStatus,
  getTimeline,
  getWorktreeDiff,
  openRepository,
  pickRepository,
  stageFile,
  switchBranch,
  unstageFile,
} from "./lib/api";
import { cn } from "./lib/cn";
import {
  loadRecentRepos,
  rememberRepo,
  removeRecentRepo,
  type RecentRepo,
} from "./lib/recentRepos";
import { errorText } from "./lib/ui";
import type {
  CommitDetail,
  DiffMode,
  FileChange,
  FileDiff,
  RepoSummary,
  StatusPayload,
  Timeline,
} from "./lib/types";

const appShell =
  "flex h-full flex-col bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(232,93,4,0.16),transparent_55%),linear-gradient(180deg,#1c1814_0%,#120f0c_100%)]";

/** Background chronomonitor refresh while the archive is open. */
const RESCAN_MS = 2500;

type DiffTarget =
  | { kind: "commit"; path: string }
  | { kind: "staged"; path: string }
  | { kind: "unstaged"; path: string };

type LoadOptions = {
  keepSelection?: boolean;
  /** Refresh without the busy chrome (used by automatic rescans). */
  quiet?: boolean;
};

function statusFile(
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

function targetsEqual(a: DiffTarget | null, b: DiffTarget | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.path === b.path;
}

function sameJson<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameRepo(a: RepoSummary | null, b: RepoSummary): boolean {
  return (
    !!a &&
    a.path === b.path &&
    a.name === b.name &&
    a.head === b.head &&
    a.branch === b.branch
  );
}

function keepIfSame<T>(prev: T, next: T): T {
  return sameJson(prev, next) ? prev : next;
}

export default function App() {
  const [recent, setRecent] = useState<RecentRepo[]>(() => loadRecentRepos());
  const [repo, setRepo] = useState<RepoSummary | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [diffTarget, setDiffTarget] = useState<DiffTarget | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMounted, setDiffMounted] = useState(false);
  const [diffMountTarget, setDiffMountTarget] = useState<DiffTarget | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [diffError, setDiffError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const repoPathRef = useRef<string | null>(null);
  const diffTargetRef = useRef<DiffTarget | null>(null);
  const loadedDiffKeyRef = useRef<string | null>(null);
  busyRef.current = busy;
  repoPathRef.current = repo?.path ?? null;
  diffTargetRef.current = diffTarget;

  const loadAll = useCallback(async (path: string, options: LoadOptions = {}) => {
    const { keepSelection = false, quiet = false } = options;
    if (!quiet) {
      setBusy(true);
      setError(null);
    }
    try {
      const summary = await openRepository(path);
      const [nextTimeline, nextStatus] = await Promise.all([
        getTimeline(path),
        getStatus(path),
      ]);
      setRepo((prev) => (sameRepo(prev, summary) ? prev! : summary));
      setTimeline((prev) => (prev && sameJson(prev, nextTimeline) ? prev : nextTimeline));
      setStatus((prev) => (prev && sameJson(prev, nextStatus) ? prev : nextStatus));
      if (!quiet) setRecent(rememberRepo(summary.path));
      setSelectedId((current) => {
        if (keepSelection && current && nextTimeline.nodes.some((n) => n.id === current)) {
          return current;
        }
        return nextTimeline.head ?? nextTimeline.nodes.at(-1)?.id ?? null;
      });
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : String(err));
      }
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

    const refreshOpenWorktreeDiff = async () => {
      const target = diffTargetRef.current;
      if (!target || target.kind === "commit") return;
      try {
        const next = await getWorktreeDiff(path, target.path, target.kind === "staged");
        if (cancelled) return;
        if (!targetsEqual(diffTargetRef.current, target)) return;
        setDiff((prev) => (prev && sameJson(prev, next) ? prev : next));
        setDiffError(null);
      } catch {
        // Keep the open pane; the next successful scan will catch up.
      }
    };

    const rescan = async () => {
      if (cancelled || busyRef.current) return;
      if (inFlight) {
        pending = true;
        return;
      }
      inFlight = true;
      try {
        await loadAll(path, { keepSelection: true, quiet: true });
        if (!cancelled) await refreshOpenWorktreeDiff();
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

  useEffect(() => {
    if (!repo || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail((current) => (current?.id === selectedId ? current : null));
    getCommit(repo.path, selectedId)
      .then((next) => {
        if (!cancelled) setDetail((prev) => (prev ? keepIfSame(prev, next) : next));
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repo?.path, selectedId]);

  useEffect(() => {
    if (diffTarget) {
      setDiffMounted(true);
      setDiffMountTarget(diffTarget);
    }
  }, [diffTarget]);

  useEffect(() => {
    if (!diffTarget || diffTarget.kind !== "commit") return;
    if (!detail || detail.id !== selectedId) return;
    const stillThere = detail.files.some((file) => file.path === diffTarget.path);
    if (!stillThere) {
      setDiffOpen(false);
      setDiffTarget(null);
    }
  }, [detail, diffTarget, selectedId]);

  useEffect(() => {
    if (!diffTarget || diffTarget.kind === "commit") return;
    if (!status) return;
    if (!statusFile(status, diffTarget)) {
      setDiffOpen(false);
      setDiffTarget(null);
    }
  }, [status, diffTarget]);

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
    if (!diffTarget || !repoPathRef.current) {
      loadedDiffKeyRef.current = null;
      setDiff(null);
      setDiffError(null);
      return;
    }
    if (!diffKey) return;

    const path = repoPathRef.current;
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
          setDiffError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [diffKey, diffTarget, selectedId]);

  const selectedNode =
    timeline?.nodes.find((n) => n.id === selectedId) ?? null;
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

  function openDiff(target: DiffTarget) {
    if (targetsEqual(diffTarget, target)) {
      setDiffOpen(false);
      setDiffTarget(null);
      return;
    }
    setDiffMounted(true);
    setDiffMountTarget(target);
    setDiffTarget(target);
    if (diffOpen) return;
    setDiffOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDiffOpen(true));
    });
  }

  function closeDiff() {
    setDiffOpen(false);
    setDiffTarget(null);
  }

  async function browse() {
    try {
      const picked = await pickRepository();
      if (picked) {
        await loadAll(picked);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!repo || !timeline) {
    return (
      <div className={appShell}>
        <WelcomeGate
          recent={recent}
          onOpenRecent={(path) => loadAll(path)}
          onRemoveRecent={(path) => setRecent(removeRecentRepo(path))}
          onBrowse={browse}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className={appShell}>
      <BureauHeader
        repo={repo}
        onOpen={browse}
        onReload={() => loadAll(repo.path, { keepSelection: true })}
      />
      {error ? <div className={cn(errorText, "px-[18px] py-1.5")}>{error}</div> : null}
      <div
        data-workspace
        className="grid min-h-0 flex-1 overflow-hidden grid-cols-[260px_minmax(0,1fr)_320px] grid-rows-[minmax(240px,1fr)_auto]"
      >
        <VariantRail
          timeline={timeline}
          busy={busy}
          onCheckout={async (name) => {
            try {
              setBusy(true);
              await switchBranch(repo.path, name);
              await loadAll(repo.path);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
              setBusy(false);
            }
          }}
        />
        <div className={cn("relative min-h-0 min-w-0 overflow-hidden", diffOpen && "diff-open")}>
          <div
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[radial-gradient(900px_280px_at_50%_20%,rgba(232,93,4,0.14),transparent_60%),linear-gradient(180deg,#1a1511,#100d0a)]"
            aria-hidden={diffOpen}
          >
            <SacredTimeline
              timeline={timeline}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div
            className={cn(
              "diff-pane absolute inset-0 z-10 flex flex-col overflow-hidden bg-[#16120e] transition-[translate] duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              diffOpen
                ? "translate-y-0 pointer-events-auto"
                : "translate-y-full pointer-events-none",
            )}
            aria-hidden={!diffOpen}
            onTransitionEnd={(e) => {
              if (e.propertyName !== "translate") return;
              if (e.target !== e.currentTarget) return;
              if (!diffOpen) {
                setDiffMounted(false);
                setDiffMountTarget(null);
              }
            }}
          >
            {diffMounted ? (
              <DiffViewer
                file={selectedFile}
                diff={visibleDiff}
                mode={diffMode}
                error={diffError}
                onMode={setDiffMode}
                onClose={closeDiff}
              />
            ) : null}
          </div>
        </div>
        <CaseFile
          node={selectedNode}
          detail={detail}
          selectedPath={
            diffTarget?.kind === "commit" ? diffTarget.path : null
          }
          onOpenFile={(path) => openDiff({ kind: "commit", path })}
          onSelectCommit={setSelectedId}
        />
        <AnomalyDock
          status={status}
          busy={busy}
          selected={
            diffTarget && diffTarget.kind !== "commit"
              ? { side: diffTarget.kind, path: diffTarget.path }
              : null
          }
          onOpenFile={(side, path) => openDiff({ kind: side, path })}
          onStage={async (rel) => setStatus(await stageFile(repo.path, rel))}
          onUnstage={async (rel) => setStatus(await unstageFile(repo.path, rel))}
          onCommit={async (message) => {
            await fileCommit(repo.path, message);
            await loadAll(repo.path, { keepSelection: true });
          }}
        />
      </div>
    </div>
  );
}
