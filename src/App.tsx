import { useCallback, useEffect, useState } from "react";
import { AnomalyDock } from "./components/AnomalyDock";
import { BureauHeader } from "./components/BureauHeader";
import { CaseFile } from "./components/CaseFile";
import { SacredTimeline } from "./components/SacredTimeline";
import { VariantRail } from "./components/VariantRail";
import { WelcomeGate } from "./components/WelcomeGate";
import {
  fileCommit,
  getCommit,
  getStatus,
  getTimeline,
  openRepository,
  pickRepository,
  stageFile,
  switchBranch,
  unstageFile,
} from "./lib/api";
import {
  loadRecentRepos,
  rememberRepo,
  removeRecentRepo,
  type RecentRepo,
} from "./lib/recentRepos";
import type { CommitDetail, RepoSummary, StatusPayload, Timeline } from "./lib/types";

export default function App() {
  const [recent, setRecent] = useState<RecentRepo[]>(() => loadRecentRepos());
  const [repo, setRepo] = useState<RepoSummary | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommitDetail | null>(null);
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

  const selectedNode =
    timeline?.nodes.find((n) => n.id === selectedId) ?? null;

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
      <div className="app">
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
    <div className="app">
      <BureauHeader
        repo={repo}
        onOpen={browse}
        onReload={() => loadAll(repo.path, true)}
      />
      {error ? <div className="error" style={{ padding: "6px 18px" }}>{error}</div> : null}
      <div className="workspace">
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
        <div className="monitor">
          <SacredTimeline
            timeline={timeline}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <CaseFile node={selectedNode} detail={detail} />
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
