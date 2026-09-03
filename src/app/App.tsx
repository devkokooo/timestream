import { useCallback, useEffect, useRef, useState } from "react";
import { AuthDialog } from "@/auth/AuthDialog";
import { useAuth } from "@/auth/useAuth";
import { BranchPicker } from "@/branches/BranchPicker";
import { useBranches } from "@/branches/useBranches";
import { AboutDialog } from "@/shell/AboutDialog";
import { BureauHeader } from "@/shell/BureauHeader";
import { CommandPalette, type PaletteCommand } from "@/settings/CommandPalette";
import { DiffViewer } from "@/diff/DiffViewer";
import { useDiffPane } from "@/diff/useDiffPane";
import {
  fileSidesToPierre,
  getFileSides,
  getWorktreeFileSides,
} from "@/diff/api";
import { Docket } from "@/timeline/Docket";
import { DispatchNotice } from "@/ui/DispatchNotice";
import { HqMode } from "@/github/HqMode";
import { RailStrip } from "@/shell/RailStrip";
import { ReviewMode } from "@/worktree/ReviewMode";
import { SacredTimeline } from "@/timeline/SacredTimeline";
import { SettingsPage } from "@/settings/SettingsPage";
import { StatusBar } from "@/shell/StatusBar";
import { TitleBar } from "@/shell/TitleBar";
import { LeftRail } from "@/timeline/LeftRail";
import { TvaTerm } from "@/ui/TvaTerm";
import { WelcomeGate } from "@/remotes/WelcomeGate";
import { SealDesk } from "@/timeline/SealDesk";
import { CullSealConfirm } from "@/timeline/CullSealConfirm";
import { useTags } from "@/timeline/useTags";
import { githubSearchRepos } from "@/github/api";
import { isAuthError, isGithubDispatchError } from "@/github/dispatch";
import { switchBranch } from "@/branches/api";
import { sshAddKey, sshAgentEnsure } from "@/ssh/api";
import { cn } from "@/ui/cn";
import { AuthProvider } from "@/auth/AuthProvider";
import type { SettingDef } from "@/settings/settingsRegistry";
import { btn, errorText } from "@/ui/ui";
import { openNewArchiveWindow } from "@/shell/windows";
import { errMessage } from "@/app/helpers";
import { useRepoSession } from "@/git/useRepoSession";
import { useRemotes } from "@/remotes/useRemotes";
import { useSettings } from "@/settings/useSettings";
import { useTimeline } from "@/timeline/useTimeline";
import { useWorktree } from "@/worktree/useWorktree";
import { useGithubMarkers } from "@/github/useGithubMarkers";
import { targetsEqual, type DiffTarget } from "@/diff/targets";
import { githubWhoami } from "@/github/auth/api";
import { githubListPulls } from "@/github/pulls/api";

const appShell =
  "flex h-full flex-col bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(232,93,4,0.16),transparent_55%),linear-gradient(180deg,#1c1814_0%,#120f0c_100%)]";

export default function App() {
  const afterQuietLoadRef = useRef<(() => Promise<void>) | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const session = useRepoSession(afterQuietLoadRef);
  const settings = useSettings();
  const auth = useAuth(session.setError);
  const remotes = useRemotes({
    repoPath: session.repo?.path ?? null,
    cloneProtocol: settings.settings.github.cloneProtocol,
    loadAll: session.loadAll,
    setError: session.setError,
    setBusy: session.setBusy,
  });
  const timelineUi = useTimeline({
    repoPath: session.repo?.path ?? null,
    timeline: session.timeline,
    selectedId: session.selectedId,
  });
  const diffPane = useDiffPane({
    repoPath: session.repo?.path ?? null,
    selectedId: session.selectedId,
    detail: timelineUi.detail,
    status: session.status,
  });
  afterQuietLoadRef.current = diffPane.refreshOpenWorktreeDiff;

  const loadCommitSides = useCallback(async () => {
    const path = session.repo?.path;
    const sha = session.selectedId;
    const target = diffPane.activeTarget;
    if (!path || !sha || !target || target.kind !== "commit") {
      return { oldFile: null, newFile: null };
    }
    const sides = await getFileSides(path, sha, target.path);
    return fileSidesToPierre(sides);
  }, [diffPane.activeTarget, session.repo?.path, session.selectedId]);

  const loadWorktreeSides = useCallback(async () => {
    const path = session.repo?.path;
    const target = diffPane.diffTarget;
    if (!path || !target || target.kind === "commit") {
      return { oldFile: null, newFile: null };
    }
    const sides = await getWorktreeFileSides(path, target.path, target.kind === "staged");
    return fileSidesToPierre(sides);
  }, [diffPane.diffTarget, session.repo?.path]);

  const worktree = useWorktree({
    repo: session.repo,
    timeline: session.timeline,
    status: session.status,
    setStatus: session.setStatus,
    loadAll: remotes.openRepo,
    diffTarget: diffPane.diffTarget,
    setDiffTarget: diffPane.setDiffTarget,
    setDiffMounted: diffPane.setDiffMounted,
    setDiffMountTarget: diffPane.setDiffMountTarget,
  });
  const github = useGithubMarkers({
    origin: session.origin,
    user: auth.user,
    setError: session.setError,
  });
  const branches = useBranches({
    repo: session.repo,
    loadAll: remotes.openRepo,
    setBusy: session.setBusy,
  });
  const tags = useTags({
    repo: session.repo,
    loadAll: remotes.openRepo,
    setBusy: session.setBusy,
    setError: session.setError,
    pushTag: remotes.pushTag,
  });

  const reviewOpenRef = worktree.reviewOpenRef;
  const hqOpenRef = useRef(false);
  const paletteOpenRef = useRef(false);
  const branchDeskOpenRef = useRef(false);
  const sealDeskOpenRef = useRef(false);
  hqOpenRef.current = github.hqOpen;
  paletteOpenRef.current = settings.paletteOpen;
  branchDeskOpenRef.current = branches.branchDeskOpen;
  sealDeskOpenRef.current = tags.sealDeskOpen;

  const timelineEnabled = settings.settings.timeline.enabled;
  const { repo, timeline, status } = session;

  const newWindow = useCallback(() => {
    void openNewArchiveWindow().catch((err) => session.setError(errMessage(err)));
  }, [session.setError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        settings.setPaletteOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void openNewArchiveWindow().catch((err) => session.setError(errMessage(err)));
        return;
      }
      if (e.key !== "Escape") return;
      if (paletteOpenRef.current) {
        settings.setPaletteOpen(false);
        return;
      }
      if (branchDeskOpenRef.current) return;
      if (sealDeskOpenRef.current) return;
      if (reviewOpenRef.current) {
        worktree.setReviewOpen(false);
        diffPane.setDiffTarget((target) => (target && target.kind !== "commit" ? null : target));
        diffPane.setDiffMounted(false);
        diffPane.setDiffMountTarget(null);
        return;
      }
      if (hqOpenRef.current) {
        github.setHqOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Setters are stable; refs hold the latest open flags (same as the previous App.tsx handler).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const varianceCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);

  function openDiff(target: DiffTarget) {
    if (target.kind === "commit") {
      if (targetsEqual(diffPane.diffTarget, target)) {
        diffPane.setDiffOpen(false);
        diffPane.setDiffTarget(null);
        return;
      }
      worktree.setReviewOpen(false);
      diffPane.setDiffMounted(true);
      diffPane.setDiffMountTarget(target);
      diffPane.setDiffTarget(target);
      if (diffPane.diffOpen) return;
      diffPane.setDiffOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => diffPane.setDiffOpen(true));
      });
      return;
    }
    diffPane.setDiffOpen(false);
    worktree.setReviewOpen(true);
    diffPane.setDiffMounted(true);
    diffPane.setDiffMountTarget(target);
    diffPane.setDiffTarget(target);
  }

  function toggleReview() {
    if (worktree.reviewOpen) {
      worktree.closeReview();
      return;
    }
    github.setHqOpen(false);
    diffPane.setDiffOpen(false);
    if (diffPane.diffTarget?.kind === "commit") {
      diffPane.setDiffTarget(null);
      diffPane.setDiffMounted(false);
      diffPane.setDiffMountTarget(null);
    }
    worktree.setReviewOpen(true);
  }

  function toggleHq() {
    if (github.hqOpen) {
      github.setHqOpen(false);
      return;
    }
    if (worktree.reviewOpen) worktree.closeReview();
    github.setHqOpen(true);
  }

  function closeFolder() {
    remotes.resetRemotes();
    session.resetSession();
    diffPane.resetDiff();
    github.resetGithub();
    worktree.setReviewOpen(false);
    branches.setBranchDeskOpen(false);
    timelineUi.resetRails();
  }

  async function runLocalCheckout(name: string) {
    if (!repo) return;
    try {
      session.setBusy(true);
      await switchBranch(repo.path, name);
      await remotes.openRepo(repo.path);
    } catch (err) {
      session.setError(errMessage(err));
      session.setBusy(false);
    }
  }

  const commands: PaletteCommand[] = [
    { id: "palette", title: "Show command palette", hint: "Ctrl+Shift+P", run: () => settings.setPaletteOpen(true) },
    { id: "review", title: "Open review mode", hint: "Temporal anomalies", run: () => { if (!worktree.reviewOpen) toggleReview(); } },
    { id: "hq", title: "Open HQ desk", hint: "Pull requests, issues, releases", run: () => { if (!github.hqOpen) toggleHq(); } },
    { id: "variants", title: "Toggle variant dossiers", run: () => timelineUi.setVariantRailOpen((open) => !open) },
    {
      id: "branches",
      title: "Manage local branches",
      hint: "Create, rename, cull",
      run: () => {
        if (repo) branches.setBranchDeskOpen(true);
      },
    },
    {
      id: "seal",
      title: "File seal on selected nexus",
      hint: "Create local tag",
      run: () => {
        if (!repo || !timeline || !session.selectedId) return;
        const node = timeline.nodes.find((n) => n.id === session.selectedId);
        if (!node) return;
        tags.openSealDesk({ sha: node.id, shortId: node.shortId, summary: node.summary });
      },
    },
    {
      id: "ledger",
      title: "Show commit ledger",
      hint: "History",
      run: () => {
        timelineUi.setRailTab("history");
        timelineUi.setVariantRailOpen(true);
      },
    },
    {
      id: "seals",
      title: "Show canon seals",
      hint: "Tags",
      run: () => {
        timelineUi.setRailTab("tags");
        timelineUi.setVariantRailOpen(true);
      },
    },
    { id: "docket", title: "Toggle case file", run: () => timelineUi.setDocketOpen((open) => !open) },
    { id: "settings", title: "Open settings", hint: "File", run: () => settings.setSettingsOpen(true) },
    { id: "about", title: "About Timestream", hint: "Help", run: () => setAboutOpen(true) },
    {
      id: "timeline-toggle",
      title: timelineEnabled ? "Hide Sacred Timeline" : "Show Sacred Timeline",
      hint: "Reduce render lag",
      run: () => void settings.setTimelineEnabled(!timelineEnabled),
    },
    {
      id: "new-window",
      title: "New window",
      hint: "Ctrl+Shift+N",
      run: newWindow,
    },
    { id: "signin", title: "Sign in with GitHub", hint: "Clearance", run: () => auth.setAuthOpen(true) },
    { id: "signout", title: "Sign out of GitHub", run: auth.signOut },
    { id: "open", title: "Open folder", hint: "File", run: () => void remotes.browse() },
    { id: "close-folder", title: "Close folder", hint: "File", run: closeFolder },
    { id: "rescan", title: "Rescan", hint: "View", run: () => repo && void remotes.openRepo(repo.path, { keepSelection: true }) },
    { id: "fetch", title: "Fetch from origin", hint: "Dispatch", run: remotes.fetch },
    { id: "push", title: "Push branch", hint: "Upload to HQ", run: remotes.push },
    { id: "pull", title: "Fast-forward pull", hint: "Sync inbound", run: remotes.pull },
    { id: "ssh-pick", title: "GitHub: Choose SSH key for this remote", run: () => remotes.setIdentityOpen(true) },
    {
      id: "ssh-agent",
      title: "SSH: Start agent",
      run: () => void sshAgentEnsure().catch((e) => session.setError(errMessage(e))),
    },
    {
      id: "ssh-add",
      title: "SSH: Add key to agent",
      run: () => {
        if (settings.settings.ssh.defaultKey) void sshAddKey(settings.settings.ssh.defaultKey);
        else remotes.setIdentityOpen(true);
      },
    },
    {
      id: "settings-toml",
      title: "Open settings.toml",
      run: () => settings.setSettingsOpen(true),
    },
  ];

  const overlays = (
    <>
      <CommandPalette
        open={settings.paletteOpen}
        commands={commands}
        settings={settings.settings}
        onClose={() => settings.setPaletteOpen(false)}
        onOpenSetting={(key) => {
          settings.setSettingsFocus(key);
          settings.setSettingsOpen(true);
        }}
        onToggleSetting={async (def: SettingDef) => {
          await settings.toggleSetting(def);
        }}
      />
      <SettingsPage
        open={settings.settingsOpen}
        settings={settings.settings}
        focusKey={settings.settingsFocus}
        onClose={() => settings.setSettingsOpen(false)}
        onChange={settings.setSettingsState}
      />
      <AuthDialog open={auth.authOpen} onClose={() => auth.setAuthOpen(false)} onSignedIn={auth.setUser} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <BranchPicker
        open={branches.branchDeskOpen}
        path={repo?.path ?? null}
        busy={session.busy}
        onClose={() => branches.setBranchDeskOpen(false)}
        onSwitch={branches.switchTo}
        onCreate={branches.create}
        onRename={branches.rename}
        onDelete={branches.remove}
      />
      <SealDesk
        open={tags.sealDeskOpen}
        target={tags.sealTarget}
        timeline={timeline}
        busy={session.busy}
        canPush={Boolean(session.origin)}
        dispatchDefault={tags.dispatchDefault}
        onDispatchDefault={tags.setDispatchDefault}
        onClose={tags.closeSealDesk}
        onCreate={tags.create}
      />
      <CullSealConfirm
        name={tags.pendingCull}
        onCancel={tags.cancelCull}
        onConfirm={(name) => void tags.remove(name)}
      />
      {remotes.identityPicker}
    </>
  );

  const titleBar = (
    <TitleBar
      title={repo?.name ?? "TIMESTREAM"}
      folderOpen={Boolean(repo)}
      onNewWindow={newWindow}
      onOpenFolder={() => void remotes.browse()}
      onCloseFolder={closeFolder}
      onRescan={() => {
        if (repo) void remotes.openRepo(repo.path, { keepSelection: true });
      }}
      onSettings={() => settings.setSettingsOpen(true)}
      onAbout={() => setAboutOpen(true)}
    />
  );

  const statusBar = (
    <StatusBar
      repo={repo}
      origin={session.origin}
      sync={session.sync}
      branchOpen={branches.branchDeskOpen}
      onBranchClick={
        repo
          ? () => {
              worktree.setReviewOpen(false);
              github.setHqOpen(false);
              branches.setBranchDeskOpen((open) => !open);
            }
          : undefined
      }
    />
  );

  if (!repo || !timeline) {
    return (
      <AuthProvider user={auth.user}>
      <div className={appShell}>
        {titleBar}
        <WelcomeGate
          recent={remotes.recent}
          onOpenRecent={(path) => remotes.openRepo(path)}
          onRemoveRecent={remotes.removeRecent}
          onBrowse={remotes.browse}
          onClone={remotes.startClone}
          onSearchRepos={githubSearchRepos}
          onSignIn={() => auth.setAuthOpen(true)}
          onSettings={() => settings.setSettingsOpen(true)}
          user={auth.user}
          error={session.error}
          cloneLog={remotes.cloneLog}
          cloning={remotes.cloning}
        />
        {statusBar}
        {overlays}
      </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider user={auth.user}>
    <div className={appShell}>
      {titleBar}
      <BureauHeader
        repo={repo}
        origin={session.origin}
        anomalyCount={varianceCount}
        anomalyLoading={status == null}
        reviewOpen={worktree.reviewOpen}
        onToggleReview={toggleReview}
        user={auth.user}
        hqOpen={github.hqOpen}
        onToggleHq={toggleHq}
      />
      {session.error ? (
        isGithubDispatchError(session.error) ? (
          <div className="px-[18px] py-1.5">
            <DispatchNotice
              error={session.error}
              compact
              onSignIn={() => auth.setAuthOpen(true)}
              onRetry={() => {
                session.setError(null);
                void githubWhoami()
                  .then((next) => {
                    auth.setUser(next);
                    if (!session.origin?.owner || !session.origin.nameOnHost || !next) return;
                    return githubListPulls(session.origin.owner, session.origin.nameOnHost, "open").then(github.setPrs);
                  })
                  .catch((err) => {
                    if (isAuthError(err)) {
                      auth.setUser(null);
                      return;
                    }
                    session.setError(errMessage(err));
                  });
              }}
            />
          </div>
        ) : (
          <div className={cn(errorText, "px-[18px] py-1.5")}>{session.error}</div>
        )
      ) : null}
      {worktree.reviewOpen ? (
        <ReviewMode
          status={status}
          busy={session.busy}
          fetching={remotes.remoteOp === "fetch"}
          pulling={remotes.remoteOp === "pull"}
          pushing={remotes.remoteOp === "push"}
          sync={session.sync}
          onBranch={Boolean(repo.branch)}
          hasHead={Boolean(timeline?.head ?? repo.head)}
          headFiling={worktree.headFiling}
          onPush={remotes.push}
          onFetch={remotes.fetch}
          onPull={remotes.pull}
          selected={
            diffPane.diffTarget && diffPane.diffTarget.kind !== "commit"
              ? { side: diffPane.diffTarget.kind, path: diffPane.diffTarget.path }
              : null
          }
          onOpenFile={(side, path) => openDiff({ kind: side, path })}
          onStage={worktree.stage}
          onUnstage={worktree.unstage}
          onCommit={worktree.commit}
        >
          {diffPane.diffTarget && diffPane.diffTarget.kind !== "commit" ? (
            <DiffViewer
              file={diffPane.selectedFile}
              diff={diffPane.visibleDiff}
              mode={diffPane.diffMode}
              error={diffPane.diffError}
              onMode={diffPane.setDiffMode}
              onClose={worktree.closeReview}
              loadSides={loadWorktreeSides}
              onFile={
                diffPane.diffTarget.kind === "unstaged" && diffPane.selectedFile
                  ? async () => {
                      await worktree.stage(diffPane.selectedFile!.path);
                    }
                  : undefined
              }
            />
          ) : null}
        </ReviewMode>
      ) : github.hqOpen ? (
        <HqMode
          owner={session.origin?.owner ?? null}
          repoName={session.origin?.nameOnHost ?? null}
          signedIn={Boolean(auth.user)}
          onSignIn={() => auth.setAuthOpen(true)}
          onSignOut={auth.signOut}
          repoPath={repo.path}
          currentBranch={repo.branch}
          sacredBranch={timeline?.sacredBranch ?? null}
          timeline={timeline}
          selectedSha={session.selectedId}
          onCheckoutPr={async (number) => {
            await remotes.checkoutPr(number);
          }}
          onSyncAfterMerge={async (base) => {
            await remotes.pullBase(base);
          }}
        />
      ) : (
      <div
        data-workspace
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${timelineUi.variantRailOpen ? "260px" : "36px"} minmax(0,1fr) ${timelineUi.docketOpen ? "320px" : "36px"}`,
        }}
      >
        {timelineUi.variantRailOpen ? (
        <LeftRail
          tab={timelineUi.railTab}
          onTab={timelineUi.setRailTab}
          timeline={timeline}
          selectedId={session.selectedId}
          busy={session.busy}
          branch={repo.branch}
          prByBranch={github.prByBranch}
          aheadBehind={session.sync}
          canPush={Boolean(session.origin)}
          canFileSeal={Boolean(session.selectedId)}
          onStow={() => timelineUi.setVariantRailOpen(false)}
          onSelectTag={(id) => {
            session.setSelectedId(id);
            timelineUi.setDocketOpen(true);
          }}
          onSelectCommit={session.setSelectedId}
          onCheckout={(name) => void runLocalCheckout(name)}
          onSealNexus={(node) => {
            tags.openSealDesk({ sha: node.id, shortId: node.shortId, summary: node.summary });
          }}
          onOpenDossier={(id) => {
            session.setSelectedId(id);
            timelineUi.setDocketOpen(true);
          }}
          onCullTag={tags.requestCull}
          onCullLocal={(name) => void tags.remove(name)}
          onFileSeal={() => {
            if (!session.selectedId) return;
            const node = timeline.nodes.find((n) => n.id === session.selectedId);
            if (!node) return;
            tags.openSealDesk({ sha: node.id, shortId: node.shortId, summary: node.summary });
          }}
          onPushTag={(name) => void remotes.pushTag(name)}
          onCullRemoteTag={(name) => void remotes.deleteRemoteTag(name)}
        />
        ) : (
          <RailStrip
            label={timelineUi.railTab === "tags" ? "SEALS" : timelineUi.railTab === "history" ? "LEDGER" : "VARIANTS"}
            side="start"
            onExpand={() => timelineUi.setVariantRailOpen(true)}
          />
        )}
        <div className={cn("relative min-h-0 min-w-0 overflow-hidden", diffPane.diffOpen && "diff-open")}>
          <div
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[radial-gradient(900px_280px_at_50%_20%,rgba(232,93,4,0.14),transparent_60%),linear-gradient(180deg,#1a1511,#100d0a)]"
            aria-hidden={diffPane.diffOpen}
          >
            {timelineEnabled ? (
            <SacredTimeline
              timeline={timeline}
              selectedId={session.selectedId}
              onSelect={session.setSelectedId}
              detail={timelineUi.detail?.id === session.selectedId ? timelineUi.detail : null}
              reviewers={github.prs.find((p) => p.headSha === session.selectedId)?.requestedReviewers}
              reviewDecision={github.prs.find((p) => p.headSha === session.selectedId)?.reviewDecision}
              checks={github.prs.find((p) => p.headSha === session.selectedId)?.ciStatus}
              incursion={varianceCount > 0}
              onOpenReview={() => {
                if (!worktree.reviewOpen) toggleReview();
              }}
              prHeadShas={github.prHeadShas}
              failingShas={github.failingShas}
              onSelectCommit={session.setSelectedId}
              onOpenFile={(path) => openDiff({ kind: "commit", path })}
              onSealNexus={(node) => {
                tags.openSealDesk({ sha: node.id, shortId: node.shortId, summary: node.summary });
              }}
              onCullTag={tags.requestCull}
            />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <TvaTerm
                  flavor="Chronomonitor dormant"
                  noun="Sacred Timeline off"
                  className="items-center text-tva-gold"
                />
                <p className="m-0 max-w-sm text-sm text-tva-paper-dim">
                  The chronomonitor drawing is off to reduce render lag. Variants, seals, and the case file stay live.
                </p>
                <button
                  type="button"
                  className={btn}
                  onClick={() => void settings.setTimelineEnabled(true)}
                >
                  Restore timeline
                </button>
              </div>
            )}
          </div>
          <div
            className={cn(
              "diff-pane absolute inset-0 z-10 flex flex-col overflow-hidden bg-[#16120e] transition-[translate] duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              diffPane.diffOpen
                ? "translate-y-0 pointer-events-auto"
                : "translate-y-full pointer-events-none",
            )}
            aria-hidden={!diffPane.diffOpen}
            onTransitionEnd={(e) => {
              if (e.propertyName !== "translate") return;
              if (e.target !== e.currentTarget) return;
              if (!diffPane.diffOpen) {
                diffPane.setDiffMounted(false);
                diffPane.setDiffMountTarget(null);
              }
            }}
          >
            {diffPane.diffMounted && diffPane.activeTarget?.kind === "commit" ? (
              <DiffViewer
                file={diffPane.selectedFile}
                diff={diffPane.visibleDiff}
                mode={diffPane.diffMode}
                error={diffPane.diffError}
                onMode={diffPane.setDiffMode}
                onClose={diffPane.closeDiff}
                reviewComments={github.reviewComments}
                loadSides={loadCommitSides}
              />
            ) : null}
          </div>
        </div>
        {timelineUi.docketOpen ? (
        <Docket
          node={timelineUi.selectedNode}
          detail={timelineUi.detail}
          selectedPath={diffPane.diffTarget?.kind === "commit" ? diffPane.diffTarget.path : null}
          onOpenFile={(path) => {
            github.loadReviewComments(session.selectedId);
            openDiff({ kind: "commit", path });
          }}
          onSelectCommit={session.setSelectedId}
          selectedSha={session.selectedId}
          checksBySha={Object.fromEntries(
            github.prs.filter((p) => p.ciStatus).map((p) => [p.headSha, p.ciStatus!]),
          )}
          onStow={() => timelineUi.setDocketOpen(false)}
        />
        ) : (
          <RailStrip label="DOCKET" side="end" onExpand={() => timelineUi.setDocketOpen(true)} />
        )}
      </div>
      )}
      {statusBar}
      {overlays}
    </div>
    </AuthProvider>
  );
}
