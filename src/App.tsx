import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthDialog } from "./components/AuthDialog";
import { BureauHeader } from "./components/BureauHeader";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { DiffViewer } from "./components/DiffViewer";
import { Docket } from "./components/Docket";
import { RailStrip } from "./components/RailStrip";
import { ReviewMode } from "./components/ReviewMode";
import { IdentityPicker, type IdentityChoice } from "./components/IdentityPicker";
import { SacredTimeline } from "./components/SacredTimeline";
import { SettingsPage } from "./components/SettingsPage";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { VariantRail } from "./components/VariantRail";
import { WelcomeGate } from "./components/WelcomeGate";
import {
  aheadBehind,
  checkoutPullRequest,
  cloneRepository,
  createLocalTag,
  fetchRemote,
  fileCommit,
  getCommit,
  getFileDiff,
  getSettings,
  getStatus,
  getTimeline,
  getWorktreeDiff,
  githubListPulls,
  githubListReviewComments,
  githubOrigin,
  githubSearchRepos,
  githubWhoami,
  githubLogout,
  isDivergedError,
  isPassphraseError,
  isSshIdentityError,
  onCloneLog,
  openRepository,
  pickCloneDestination,
  pickRepository,
  pullFfOnly,
  pushBranch,
  pushTag,
  setSettings,
  sshAddKey,
  sshAgentEnsure,
  stageFile,
  switchBranch,
  unstageFile,
} from "./lib/api";
import { cn } from "./lib/cn";
import { appendCloneLog } from "./lib/cloneLog";
import {
  loadRecentRepos,
  rememberRepo,
  removeRecentRepo,
  type RecentRepo,
} from "./lib/recentRepos";
import { defaultSettings } from "./lib/settingsRegistry";
import type { SettingDef } from "./lib/settingsRegistry";
import { errorText } from "./lib/ui";
import { openNewArchiveWindow } from "./lib/windows";
import type {
  AheadBehind,
  AppSettings,
  CommitDetail,
  DiffMode,
  DocketTab,
  FileChange,
  FileDiff,
  GithubUser,
  PullRequestSummary,
  RemoteAuthArgs,
  RemoteInfo,
  RepoSummary,
  ReviewComment,
  StatusPayload,
  Timeline,
} from "./lib/types";

const appShell =
  "flex h-full flex-col bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(232,93,4,0.16),transparent_55%),linear-gradient(180deg,#1c1814_0%,#120f0c_100%)]";

const RESCAN_MS = 2500;

type DiffTarget =
  | { kind: "commit"; path: string }
  | { kind: "staged"; path: string }
  | { kind: "unstaged"; path: string };

type LoadOptions = {
  keepSelection?: boolean;
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

function firstWorktreeTarget(status: StatusPayload | null): DiffTarget | null {
  if (!status) return null;
  const unfiled = [...status.unstaged, ...status.untracked];
  if (unfiled[0]) return { kind: "unstaged", path: unfiled[0].path };
  if (status.staged[0]) return { kind: "staged", path: status.staged[0].path };
  return null;
}

function followWorktreeTarget(
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

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function cloneUrl(input: string, protocol: string): string {
  const githubHttps = input.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (protocol === "ssh" && githubHttps) {
    return `git@github.com:${githubHttps[1]}/${githubHttps[2].replace(/\.git$/i, "")}.git`;
  }
  if (input.includes("://") || input.startsWith("git@")) return input;
  const [owner, name] = input.split("/");
  if (owner && name) {
    return protocol === "ssh"
      ? `git@github.com:${owner}/${name}.git`
      : `https://github.com/${owner}/${name}.git`;
  }
  return input;
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
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [user, setUser] = useState<GithubUser | null>(null);
  const [origin, setOrigin] = useState<RemoteInfo | null>(null);
  const [sync, setSync] = useState<AheadBehind | null>(null);
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [docketTab, setDocketTab] = useState<DocketTab>("case");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [cloneLog, setCloneLog] = useState<string[]>([]);
  const [cloning, setCloning] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [variantRailOpen, setVariantRailOpen] = useState(true);
  const [docketOpen, setDocketOpen] = useState(true);
  const pendingRemote = useRef<((args: RemoteAuthArgs) => Promise<unknown>) | null>(null);
  const pendingClone = useRef<{ url: string; dest: string } | null>(null);
  const busyRef = useRef(false);
  const repoPathRef = useRef<string | null>(null);
  const diffTargetRef = useRef<DiffTarget | null>(null);
  const loadedDiffKeyRef = useRef<string | null>(null);
  const reviewOpenRef = useRef(false);
  const paletteOpenRef = useRef(false);
  busyRef.current = busy;
  repoPathRef.current = repo?.path ?? null;
  diffTargetRef.current = diffTarget;
  reviewOpenRef.current = reviewOpen;
  paletteOpenRef.current = paletteOpen;

  const loadAll = useCallback(async (path: string, options: LoadOptions = {}) => {
    const { keepSelection = false, quiet = false } = options;
    if (!quiet) {
      setBusy(true);
      setError(null);
    }
    try {
      const summary = await openRepository(path);
      const [nextTimeline, nextStatus, nextOrigin, nextSync] = await Promise.all([
        getTimeline(path),
        getStatus(path),
        githubOrigin(path).catch(() => null),
        aheadBehind(path).catch(() => null),
      ]);
      setRepo((prev) => (sameRepo(prev, summary) ? prev! : summary));
      setTimeline((prev) => (prev && sameJson(prev, nextTimeline) ? prev : nextTimeline));
      setStatus((prev) => (prev && sameJson(prev, nextStatus) ? prev : nextStatus));
      setOrigin(nextOrigin);
      setSync(nextSync);
      if (!quiet) setRecent(rememberRepo(summary.path));
      setSelectedId((current) => {
        if (keepSelection && current && nextTimeline.nodes.some((n) => n.id === current)) {
          return current;
        }
        return nextTimeline.head ?? nextTimeline.nodes.at(-1)?.id ?? null;
      });
    } catch (err) {
      if (!quiet) setError(errMessage(err));
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void getSettings()
      .then(setSettingsState)
      .catch(() => {});
    void githubWhoami()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onCloneLog((line) => {
      setCloneLog((lines) => appendCloneLog(lines, line));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!origin?.owner || !origin.nameOnHost || !user) {
      setPrs([]);
      return;
    }
    void githubListPulls(origin.owner, origin.nameOnHost, "open")
      .then(setPrs)
      .catch(() => setPrs([]));
  }, [origin?.owner, origin?.nameOnHost, user?.login]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void newWindow();
        return;
      }
      if (e.key !== "Escape") return;
      if (paletteOpenRef.current) {
        setPaletteOpen(false);
        return;
      }
      if (reviewOpenRef.current) {
        setReviewOpen(false);
        setDiffTarget((target) => (target && target.kind !== "commit" ? null : target));
        setDiffMounted(false);
        setDiffMountTarget(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        /* keep pane */
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
    if (!detail.files.some((file) => file.path === diffTarget.path)) {
      setDiffOpen(false);
      setDiffTarget(null);
    }
  }, [detail, diffTarget, selectedId]);

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
  }, [reviewOpen, status, diffTarget]);

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
          setDiffError(errMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [diffKey, diffTarget, selectedId]);

  const selectedNode = timeline?.nodes.find((n) => n.id === selectedId) ?? null;
  const varianceCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);
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

  const prByBranch = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pr of prs) map[pr.headRef] = pr.number;
    return map;
  }, [prs]);
  const prHeadShas = useMemo(() => new Set(prs.map((p) => p.headSha)), [prs]);
  const failingShas = useMemo(
    () => new Set(prs.filter((p) => p.ciStatus === "failure").map((p) => p.headSha)),
    [prs],
  );

  function openDiff(target: DiffTarget) {
    if (target.kind === "commit") {
      if (targetsEqual(diffTarget, target)) {
        setDiffOpen(false);
        setDiffTarget(null);
        return;
      }
      setReviewOpen(false);
      setDiffMounted(true);
      setDiffMountTarget(target);
      setDiffTarget(target);
      if (diffOpen) return;
      setDiffOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDiffOpen(true));
      });
      return;
    }
    setDiffOpen(false);
    setReviewOpen(true);
    setDiffMounted(true);
    setDiffMountTarget(target);
    setDiffTarget(target);
  }

  function closeDiff() {
    setDiffOpen(false);
    setDiffTarget(null);
  }

  function closeReview() {
    setReviewOpen(false);
    if (diffTargetRef.current && diffTargetRef.current.kind !== "commit") {
      setDiffTarget(null);
      setDiffMounted(false);
      setDiffMountTarget(null);
    }
  }

  function toggleReview() {
    if (reviewOpen) {
      closeReview();
      return;
    }
    setDiffOpen(false);
    if (diffTarget?.kind === "commit") {
      setDiffTarget(null);
      setDiffMounted(false);
      setDiffMountTarget(null);
    }
    setReviewOpen(true);
  }

  async function browse() {
    try {
      const picked = await pickRepository();
      if (picked) await loadAll(picked);
    } catch (err) {
      setError(errMessage(err));
    }
  }

  function newWindow() {
    void openNewArchiveWindow().catch((err) => setError(errMessage(err)));
  }

  function closeFolder() {
    setBusy(false);
    setError(null);
    setRepo(null);
    setTimeline(null);
    setStatus(null);
    setSelectedId(null);
    setDetail(null);
    setDiffTarget(null);
    setDiffOpen(false);
    setDiffMounted(false);
    setDiffMountTarget(null);
    setDiff(null);
    setDiffError(null);
    setOrigin(null);
    setSync(null);
    setPrs([]);
    setReviewComments([]);
    setReviewOpen(false);
    setDocketTab("case");
  }

  async function runClone(
    url: string,
    dest: string,
    auth?: Pick<RemoteAuthArgs, "keyPath" | "passphrase" | "rememberKey" | "rememberDefault" | "rememberPassphrase">,
  ) {
    setError(null);
    setCloning(true);
    try {
      const summary = await cloneRepository(url, dest, auth);
      await loadAll(summary.path);
    } catch (err) {
      if (isSshIdentityError(err) || isPassphraseError(err)) {
        pendingClone.current = { url, dest };
        pendingRemote.current = null;
        setIdentityOpen(true);
        return;
      }
      setError(errMessage(err));
    } finally {
      setCloning(false);
    }
  }

  async function runRemote(op: (args: RemoteAuthArgs) => Promise<unknown>, extra?: Partial<RemoteAuthArgs>) {
    if (!repo) return;
    const args: RemoteAuthArgs = { path: repo.path, remote: "origin", ...extra };
    try {
      setBusy(true);
      await op(args);
      await loadAll(repo.path, { keepSelection: true });
    } catch (err) {
      if (isSshIdentityError(err) || isPassphraseError(err)) {
        pendingRemote.current = op;
        setIdentityOpen(true);
        return;
      }
      if (isDivergedError(err)) {
        setError(
          "Variant diverged — local branch and origin have diverged; pull would not fast-forward.",
        );
        return;
      }
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const commands: PaletteCommand[] = [
    { id: "palette", title: "Show command palette", hint: "Ctrl+Shift+P", run: () => setPaletteOpen(true) },
    { id: "review", title: "Open review mode", hint: "Temporal anomalies", run: () => { if (!reviewOpen) toggleReview(); } },
    { id: "variants", title: "Toggle variant dossiers", run: () => setVariantRailOpen((open) => !open) },
    { id: "docket", title: "Toggle case file", run: () => setDocketOpen((open) => !open) },
    { id: "settings", title: "Open settings", hint: "File", run: () => setSettingsOpen(true) },
    {
      id: "new-window",
      title: "New window",
      hint: "Ctrl+Shift+N",
      run: newWindow,
    },
    { id: "signin", title: "Sign in with GitHub", hint: "Clearance", run: () => setAuthOpen(true) },
    { id: "signout", title: "Sign out of GitHub", run: () => void githubLogout().then(() => setUser(null)) },
    { id: "open", title: "Open folder", hint: "File", run: () => void browse() },
    { id: "close-folder", title: "Close folder", hint: "File", run: closeFolder },
    { id: "rescan", title: "Rescan", hint: "View", run: () => repo && void loadAll(repo.path, { keepSelection: true }) },
    { id: "fetch", title: "Fetch from origin", hint: "Dispatch", run: () => void runRemote(fetchRemote) },
    { id: "push", title: "Push branch", hint: "File to HQ", run: () => void runRemote(pushBranch) },
    { id: "pull", title: "Fast-forward pull", hint: "Sync inbound", run: () => void runRemote(pullFfOnly) },
    { id: "ssh-pick", title: "GitHub: Choose SSH key for this remote", run: () => setIdentityOpen(true) },
    {
      id: "ssh-agent",
      title: "SSH: Start agent",
      run: () => void sshAgentEnsure().catch((e) => setError(errMessage(e))),
    },
    {
      id: "ssh-add",
      title: "SSH: Add key to agent",
      run: () => {
        if (settings.ssh.defaultKey) void sshAddKey(settings.ssh.defaultKey);
        else setIdentityOpen(true);
      },
    },
    {
      id: "settings-toml",
      title: "Open settings.toml",
      run: () => setSettingsOpen(true),
    },
  ];

  const overlays = (
    <>
      <CommandPalette
        open={paletteOpen}
        commands={commands}
        settings={settings}
        onClose={() => setPaletteOpen(false)}
        onOpenSetting={(key) => {
          setSettingsFocus(key);
          setSettingsOpen(true);
        }}
        onToggleSetting={async (def: SettingDef) => {
          const next = await setSettings(def.set(settings, !def.get(settings)));
          setSettingsState(next);
        }}
      />
      <SettingsPage
        open={settingsOpen}
        settings={settings}
        focusKey={settingsFocus}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettingsState}
      />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSignedIn={setUser} />
      <IdentityPicker
        open={identityOpen}
        onClose={() => {
          pendingClone.current = null;
          pendingRemote.current = null;
          setIdentityOpen(false);
        }}
        onChoose={async (choice: IdentityChoice) => {
          setIdentityOpen(false);
          if (choice.keyPath) {
            try {
              await sshAgentEnsure();
              await sshAddKey(choice.keyPath, choice.passphrase);
            } catch {
              /* OpenSSH can still use the key file via -i */
            }
          }
          const auth = {
            keyPath: choice.keyPath,
            passphrase: choice.passphrase,
            rememberKey: choice.rememberKey,
            rememberDefault: choice.rememberDefault,
            rememberPassphrase: choice.rememberPassphrase,
          };
          const clone = pendingClone.current;
          pendingClone.current = null;
          if (clone) {
            await runClone(clone.url, clone.dest, auth);
            return;
          }
          const op = pendingRemote.current ?? pushBranch;
          pendingRemote.current = null;
          await runRemote(op, auth);
        }}
      />
    </>
  );

  const titleBar = (
    <TitleBar
      title={repo?.name ?? "TIMESTREAM"}
      folderOpen={Boolean(repo)}
      onNewWindow={newWindow}
      onOpenFolder={() => void browse()}
      onCloseFolder={closeFolder}
      onRescan={() => {
        if (repo) void loadAll(repo.path, { keepSelection: true });
      }}
      onSettings={() => setSettingsOpen(true)}
    />
  );

  const statusBar = (
    <StatusBar
      repo={repo}
      origin={origin}
      sync={sync}
      onBranchClick={
        repo
          ? () => {
              setReviewOpen(false);
              setVariantRailOpen(true);
            }
          : undefined
      }
    />
  );

  if (!repo || !timeline) {
    return (
      <div className={appShell}>
        {titleBar}
        <WelcomeGate
          recent={recent}
          onOpenRecent={(path) => loadAll(path)}
          onRemoveRecent={(path) => setRecent(removeRecentRepo(path))}
          onBrowse={browse}
          onClone={async (input) => {
            try {
              const destRoot = await pickCloneDestination();
              if (!destRoot) return;
              const url = cloneUrl(input, settings.github.cloneProtocol);
              const name = url.split("/").pop()?.replace(/\.git$/, "") ?? "repo";
              const dest = `${destRoot.replace(/[/\\]+$/, "")}/${name}`;
              setCloneLog([]);
              await runClone(url, dest);
            } catch (err) {
              setError(errMessage(err));
            }
          }}
          onSearchRepos={githubSearchRepos}
          onSignIn={() => setAuthOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          user={user}
          error={error}
          cloneLog={cloneLog}
          cloning={cloning}
        />
        {statusBar}
        {overlays}
      </div>
    );
  }

  return (
    <div className={appShell}>
      {titleBar}
      <BureauHeader
        repo={repo}
        origin={origin}
        anomalyCount={varianceCount}
        anomalyLoading={status == null}
        reviewOpen={reviewOpen}
        onToggleReview={toggleReview}
      />
      {error ? <div className={cn(errorText, "px-[18px] py-1.5")}>{error}</div> : null}
      {reviewOpen ? (
        <ReviewMode
          status={status}
          busy={busy}
          ahead={sync?.ahead ?? 0}
          onPush={() => void runRemote(pushBranch)}
          onFetch={() => void runRemote(fetchRemote)}
          onPull={() => void runRemote(pullFfOnly)}
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
        >
          {diffTarget && diffTarget.kind !== "commit" ? (
            <DiffViewer
              file={selectedFile}
              diff={visibleDiff}
              mode={diffMode}
              error={diffError}
              onMode={setDiffMode}
              onClose={closeReview}
              onFile={
                diffTarget.kind === "unstaged" && selectedFile
                  ? async () => {
                      setStatus(await stageFile(repo.path, selectedFile.path));
                    }
                  : undefined
              }
            />
          ) : null}
        </ReviewMode>
      ) : (
      <div
        data-workspace
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${variantRailOpen ? "260px" : "36px"} minmax(0,1fr) ${docketOpen ? "320px" : "36px"}`,
        }}
      >
        {variantRailOpen ? (
        <VariantRail
          timeline={timeline}
          busy={busy}
          prByBranch={prByBranch}
          aheadBehind={sync}
          onStow={() => setVariantRailOpen(false)}
          onCheckout={async (name) => {
            try {
              setBusy(true);
              await switchBranch(repo.path, name);
              await loadAll(repo.path);
            } catch (err) {
              setError(errMessage(err));
              setBusy(false);
            }
          }}
        />
        ) : (
          <RailStrip label="VARIANTS" side="start" onExpand={() => setVariantRailOpen(true)} />
        )}
        <div className={cn("relative min-h-0 min-w-0 overflow-hidden", diffOpen && "diff-open")}>
          <div
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[radial-gradient(900px_280px_at_50%_20%,rgba(232,93,4,0.14),transparent_60%),linear-gradient(180deg,#1a1511,#100d0a)]"
            aria-hidden={diffOpen}
          >
            <SacredTimeline
              timeline={timeline}
              selectedId={selectedId}
              onSelect={setSelectedId}
              incursion={varianceCount > 0}
              onOpenReview={() => {
                if (!reviewOpen) toggleReview();
              }}
              prHeadShas={prHeadShas}
              failingShas={failingShas}
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
            {diffMounted && activeTarget?.kind === "commit" ? (
              <DiffViewer
                file={selectedFile}
                diff={visibleDiff}
                mode={diffMode}
                error={diffError}
                onMode={setDiffMode}
                onClose={closeDiff}
                reviewComments={reviewComments}
              />
            ) : null}
          </div>
        </div>
        {docketOpen ? (
        <Docket
          tab={docketTab}
          onTab={setDocketTab}
          node={selectedNode}
          detail={detail}
          selectedPath={diffTarget?.kind === "commit" ? diffTarget.path : null}
          onOpenFile={(path) => {
            const pr = prs.find((p) => p.headSha === selectedId);
            if (pr && origin?.owner && origin.nameOnHost) {
              void githubListReviewComments(origin.owner, origin.nameOnHost, pr.number)
                .then(setReviewComments)
                .catch(() => setReviewComments([]));
            }
            openDiff({ kind: "commit", path });
          }}
          onSelectCommit={setSelectedId}
          owner={origin?.owner ?? null}
          repoName={origin?.nameOnHost ?? null}
          signedIn={Boolean(user)}
          currentBranch={repo.branch}
          sacredBranch={timeline.sacredBranch}
          timeline={timeline}
          selectedSha={selectedId}
          checksBySha={Object.fromEntries(
            prs.filter((p) => p.ciStatus).map((p) => [p.headSha, p.ciStatus!]),
          )}
          onCheckoutPr={async (number) => {
            await runRemote((args) => checkoutPullRequest(args, number));
          }}
          onCreateTag={(name, sha, message) => {
            void createLocalTag(repo.path, name, sha, message)
              .then(() => loadAll(repo.path, { keepSelection: true }))
              .catch((err) => setError(errMessage(err)));
          }}
          onPushTag={(name) => {
            void runRemote((args) => pushTag(args, name));
          }}
          onStow={() => setDocketOpen(false)}
        />
        ) : (
          <RailStrip label="DOCKET" side="end" onExpand={() => setDocketOpen(true)} />
        )}
      </div>
      )}
      {statusBar}
      {overlays}
    </div>
  );
}
