import { useCallback, useEffect, useState } from "react";
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
import type { CommitDetail, DiffMode, FileDiff, RepoSummary, StatusPayload, Timeline } from "./lib/types";

const appShell =
  "flex h-full flex-col bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(232,93,4,0.16),transparent_55%),linear-gradient(180deg,#1c1814_0%,#120f0c_100%)]";

export default function App() {
  const [recent, setRecent] = useState<RecentRepo[]>(() => loadRecentRepos());
  const [repo, setRepo] = useState<RepoSummary | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMounted, setDiffMounted] = useState(false);
  const [diffMountPath, setDiffMountPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [diffError, setDiffError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async (path: string, keepSelection = false) => {
    setBusy(true);
    setError(null);
    try {
      const summary = await openRepository(path);
      const [nextTimeline, nextStatus] = await Promise.all([
        getTimeline(path),
        getStatus(path),
      ]);
      setRepo(summary);
      setTimeline(nextTimeline);
      setStatus(nextStatus);
      setRecent(rememberRepo(summary.path));
      setSelectedId((current) => {
        if (keepSelection && current && nextTimeline.nodes.some((n) => n.id === current)) {
          return current;
        }
        return nextTimeline.head ?? nextTimeline.nodes.at(-1)?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!repo || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail((current) => (current?.id === selectedId ? current : null));
    getCommit(repo.path, selectedId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, selectedId]);

  useEffect(() => {
    if (diffPath) {
      setDiffMounted(true);
      setDiffMountPath(diffPath);
    }
  }, [diffPath]);

  useEffect(() => {
    if (!diffPath || !detail || detail.id !== selectedId) return;
    const stillThere = detail.files.some((file) => file.path === diffPath);
    if (!stillThere) {
      setDiffOpen(false);
      setDiffPath(null);
    }
  }, [detail, diffPath, selectedId]);

  useEffect(() => {
    if (!diffPath) {
      setDiff(null);
      setDiffError(null);
      return;
    }
    if (!repo || !selectedId || !detail || detail.id !== selectedId) {
      return;
    }
    if (!detail.files.some((file) => file.path === diffPath)) {
      return;
    }
    let cancelled = false;
    setDiff(null);
    setDiffError(null);
    getFileDiff(repo.path, selectedId, diffPath)
      .then((next) => {
        if (!cancelled) setDiff(next);
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
  }, [repo, selectedId, diffPath, detail]);

  const selectedNode =
    timeline?.nodes.find((n) => n.id === selectedId) ?? null;
  const activeDiffPath = diffPath ?? diffMountPath;
  const selectedFile =
    detail?.files.find((file) => file.path === activeDiffPath) ?? null;
  const visibleDiff =
    diff &&
    activeDiffPath &&
    (diff.path === activeDiffPath || diff.oldPath === activeDiffPath)
      ? diff
      : null;

  function toggleDiffFile(path: string) {
    if (diffPath === path) {
      setDiffOpen(false);
      setDiffPath(null);
      return;
    }
    setDiffMounted(true);
    setDiffMountPath(path);
    setDiffPath(path);
    if (diffOpen) return;
    setDiffOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDiffOpen(true));
    });
  }

  function closeDiff() {
    setDiffOpen(false);
    setDiffPath(null);
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
        onReload={() => loadAll(repo.path, true)}
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
              "diff-pane absolute inset-0 z-10 flex translate-y-full flex-col overflow-hidden bg-[#16120e] pointer-events-none transition-transform duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              diffOpen && "translate-y-0 pointer-events-auto",
            )}
            aria-hidden={!diffOpen}
            onTransitionEnd={(e) => {
              if (e.propertyName !== "transform") return;
              if (e.target !== e.currentTarget) return;
              if (!diffOpen) {
                setDiffMounted(false);
                setDiffMountPath(null);
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
          selectedPath={diffPath}
          onOpenFile={toggleDiffFile}
        />
        <AnomalyDock
          status={status}
          busy={busy}
          onStage={async (rel) => setStatus(await stageFile(repo.path, rel))}
          onUnstage={async (rel) => setStatus(await unstageFile(repo.path, rel))}
          onCommit={async (message) => {
            await fileCommit(repo.path, message);
            await loadAll(repo.path, true);
          }}
        />
      </div>
    </div>
  );
}
