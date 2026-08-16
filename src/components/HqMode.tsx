import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SiGithub } from "react-icons/si";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  githubAddIssueComment,
  githubCreateIssue,
  githubCreatePull,
  githubCreateRelease,
  githubGetPull,
  githubListChecks,
  githubListIssueComments,
  githubListIssues,
  githubListPullCommits,
  githubListPulls,
  githubListReleases,
  githubListReviewComments,
  githubListReviews,
  githubMergePull,
  githubRerunJob,
  githubRepoFeatures,
  githubSubmitReview,
  githubUpdateIssue,
  githubUpdatePull,
  githubUpdateRelease,
} from "../lib/api";
import { cn } from "../lib/cn";
import { compareSpecs, githubRefName, matchingPull, sameGitRef } from "../lib/prCompare";
import { buildIssueDocket, buildPrDocket, docketAction, type DocketEntry } from "../lib/prDocket";
import { formatLocalDateTime, formatRelativeTime } from "../lib/relativeTime";
import { detectStacks } from "../lib/stackDetect";
import { btn, btnPrimary, emptyText, eyebrow, fieldInput, fieldLabel, fileRowPad, fileRowSelected, stamp, stampGold } from "../lib/ui";
import type {
  CheckRunSummary,
  CreateIssue,
  CreatePullRequest,
  CreateRelease,
  HqTab,
  IssueComment,
  IssueSummary,
  PullCommit,
  PullRequestSummary,
  PullReview,
  ReleaseSummary,
  RepoFeatures,
  ReviewComment,
  Timeline,
} from "../lib/types";
import { PersonName } from "./PersonName";
import { PrCompare } from "./PrCompare";
import { HintMark, TvaTerm } from "./TvaTerm";
import { TransmitButton } from "./TransmitButton";
import { TvaScrollArea } from "./TvaScrollArea";
import { TvaVirtualList } from "./TvaVirtualList";

interface HqModeProps {
  owner: string | null;
  repoName: string | null;
  signedIn: boolean;
  onSignIn: () => void;
  repoPath: string | null;
  currentBranch: string | null;
  sacredBranch: string | null;
  timeline: Timeline | null;
  onCheckoutPr: (number: number) => void | Promise<void>;
  onSyncAfterMerge: (base: string) => void | Promise<void>;
  onCreateTag: (name: string, sha: string, message?: string) => void;
  onPushTag: (name: string) => void;
  selectedSha: string | null;
}

type FeatureDesk = {
  features: RepoFeatures | null;
  onRecheckFeatures: () => void;
  recheckingFeatures: boolean;
  recheckError: string | null;
};

export function HqMode(props: HqModeProps) {
  const [tab, setTab] = useState<HqTab>("requests");
  const [features, setFeatures] = useState<RepoFeatures | null>(null);
  const [recheckingFeatures, setRecheckingFeatures] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);

  const recheckFeatures = useCallback(async () => {
    if (!props.signedIn || !props.owner || !props.repoName) {
      setFeatures(null);
      setRecheckError(null);
      return;
    }
    setRecheckingFeatures(true);
    setRecheckError(null);
    try {
      setFeatures(await githubRepoFeatures(props.owner, props.repoName));
    } catch (err) {
      setRecheckError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecheckingFeatures(false);
    }
  }, [props.signedIn, props.owner, props.repoName]);

  useEffect(() => {
    void recheckFeatures();
  }, [recheckFeatures]);

  const featureDesk: FeatureDesk = {
    features,
    onRecheckFeatures: () => void recheckFeatures(),
    recheckingFeatures,
    recheckError,
  };

  return (
    <div data-workspace className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#16120e]">
      <div className="flex shrink-0 border-b border-tva-gold/16 bg-[#1b1713]">
        <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} flavor="Requests" noun="Pull requests" />
        <TabBtn active={tab === "incidents"} onClick={() => setTab("incidents")} flavor="Incidents" noun="Issues" />
        <TabBtn active={tab === "canon"} onClick={() => setTab("canon")} flavor="Canon" noun="Releases" />
      </div>
      {props.signedIn ? (
        <>
          {tab === "requests" ? <RequestsPanel {...props} {...featureDesk} /> : null}
          {tab === "incidents" ? <IncidentsPanel {...props} {...featureDesk} /> : null}
          {tab === "canon" ? <CanonPanel {...props} /> : null}
        </>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="border-r border-tva-gold/16 bg-[#1b1713]" />
          <div className="flex min-h-0 min-w-0 flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e] px-6">
            <HqClearance onSignIn={props.onSignIn} />
          </div>
          <aside className="border-l border-tva-gold/16 bg-[#16120e]" />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  flavor,
  noun,
}: {
  active: boolean;
  onClick: () => void;
  flavor: string;
  noun: string;
}) {
  return (
    <button
      type="button"
      className={`min-w-0 flex-1 border-0 px-1 py-2 ${active ? "bg-tva-orange/16 text-tva-gold" : "bg-transparent text-tva-muted"}`}
      onClick={onClick}
    >
      <TvaTerm flavor={flavor} noun={noun} className="items-center" />
    </button>
  );
}

function HqDesk({
  left,
  middle,
  right,
}: {
  left: ReactNode;
  middle: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      data-workspace
      className="grid min-h-0 flex-1 overflow-hidden grid-cols-[260px_minmax(0,1fr)_320px]"
    >
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713]">
        {left}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(243,226,194,0.04),transparent_28%),#16120e]">
        {middle}
      </div>
      <aside className="flex min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#16120e]">
        {right}
      </aside>
    </div>
  );
}

function HqListPane({
  title,
  count,
  filters,
  extra,
  error,
  empty,
  children,
}: {
  title: string;
  count: number;
  filters?: ReactNode;
  extra?: ReactNode;
  error?: string | null;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col py-3 pr-2.5 pl-3.5">
      <div className="mb-2 shrink-0">
        <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">
          {title} <span className="text-tva-muted">{count}</span>
        </h3>
        {filters ? <div className="mt-2 flex flex-wrap gap-1">{filters}</div> : null}
        {extra}
        {error ? <p className="mt-2 text-xs text-[#ff8a6a]">{error}</p> : null}
      </div>
      {count === 0 || !children ? (
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill>
          <div className={emptyText}>{empty}</div>
        </TvaScrollArea>
      ) : (
        children
      )}
    </div>
  );
}

function RequestsPanel(props: HqModeProps & FeatureDesk) {
  const [filter, setFilter] = useState("open");
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [selected, setSelected] = useState<PullRequestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [filing, setFiling] = useState(false);
  const [checks, setChecks] = useState<CheckRunSummary[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [issueComments, setIssueComments] = useState<IssueComment[]>([]);
  const [pullCommits, setPullCommits] = useState<PullCommit[]>([]);
  const [reviews, setReviews] = useState<PullReview[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [head, setHead] = useState(props.currentBranch ?? "");
  const [base, setBase] = useState(props.sacredBranch ?? "main");
  const stacks = useMemo(() => detectStacks(prs), [prs]);
  const pullsOpen = props.features?.hasPullRequests !== false;
  const extraBranches = useMemo(
    () => prs.flatMap((pr) => [pr.headRef, pr.baseRef]),
    [prs],
  );
  const specs = useMemo(() => compareSpecs(selected, head, base), [selected, head, base]);

  useEffect(() => {
    if (!head && props.currentBranch) setHead(props.currentBranch);
  }, [head, props.currentBranch]);

  useEffect(() => {
    if (props.sacredBranch && (base === "main" || !base)) setBase(props.sacredBranch);
  }, [base, props.sacredBranch]);

  function chooseHead(name: string) {
    setHead(name);
    setSelected(matchingPull(prs, name, base) ?? null);
  }

  function chooseBase(name: string) {
    setBase(name);
    setSelected(matchingPull(prs, head, name) ?? null);
  }

  async function reload() {
    if (!props.signedIn || !props.owner || !props.repoName || !pullsOpen) return;
    try {
      setError(null);
      setPrs(await githubListPulls(props.owner, props.repoName, filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runDossier(id: string, work: () => Promise<void>) {
    if (acting) return;
    setActing(id);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(null);
    }
  }

  async function applyPull(next: PullRequestSummary) {
    setSelected(next);
    await reload();
  }

  useEffect(() => {
    if (!pullsOpen) {
      setPrs([]);
      return;
    }
    void reload();
  }, [props.owner, props.repoName, filter, pullsOpen]);

  const docket = useMemo(
    () => (selected ? buildPrDocket(selected, pullCommits, issueComments, reviews, comments) : []),
    [selected, pullCommits, issueComments, reviews, comments],
  );

  async function reloadConversation(number: number, headSha?: string) {
    if (!props.owner || !props.repoName) return;
    const owner = props.owner;
    const repo = props.repoName;
    const [issue, review, commits, nextReviews] = await Promise.all([
      githubListIssueComments(owner, repo, number).catch(() => [] as IssueComment[]),
      githubListReviewComments(owner, repo, number).catch(() => [] as ReviewComment[]),
      githubListPullCommits(owner, repo, number).catch(() => [] as PullCommit[]),
      githubListReviews(owner, repo, number).catch(() => [] as PullReview[]),
    ]);
    setIssueComments(issue);
    setComments(review);
    setPullCommits(commits);
    setReviews(nextReviews);
    if (headSha) {
      setChecks(await githubListChecks(owner, repo, headSha).catch(() => []));
    }
  }

  useEffect(() => {
    if (!selected || !props.owner || !props.repoName) {
      setIssueComments([]);
      setComments([]);
      setPullCommits([]);
      setReviews([]);
      return;
    }
    void githubGetPull(props.owner, props.repoName, selected.number).then(setSelected).catch(() => {});
    void reloadConversation(selected.number, selected.headSha);
  }, [selected?.number, selected?.headSha, props.owner, props.repoName]);

  if (!props.signedIn) {
    return (
      <HqDesk
        left={<HqListPane title="REQUESTS" count={0} empty="Sign in to load requests." />}
        middle={<NeedClearance />}
      />
    );
  }
  if (!props.owner) {
    return (
      <HqDesk
        left={<HqListPane title="REQUESTS" count={0} empty="No GitHub origin on this archive." />}
        middle={<p className={`${emptyText} p-6`}>No GitHub origin on this archive.</p>}
      />
    );
  }

  return (
    <HqDesk
      left={
        <HqListPane
          title="REQUESTS"
          count={prs.length}
          error={error}
          empty={pullsOpen ? "No requests in this filter." : "Requests are sealed on this origin."}
          filters={
            pullsOpen ? (
              <>
                {["open", "mine", "review", "draft"].map((item) => (
                  <button key={item} type="button" className={btn} onClick={() => setFilter(item)}>
                    {item}
                  </button>
                ))}
              </>
            ) : undefined
          }
          extra={
            stacks.length > 0 ? (
              <div className="mt-2 border border-tva-gold/20 p-2">
                <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.14em] text-tva-gold">
                  Stacks
                  <HintMark label="Consecutive pull requests. Timestream visualizes stacks but does not rebase locally." />
                </p>
                {stacks.map((stack) => (
                  <p key={stack.base} className="m-0 text-[11px] text-tva-paper-dim">
                    {stack.items.map((p) => `#${p.number}`).join(" → ")} onto {stack.base}
                  </p>
                ))}
              </div>
            ) : null
          }
        >
          <TvaVirtualList
            className="min-h-0 flex-1"
            axis="y"
            fill
            count={prs.length}
            estimateSize={() => 52}
            getItemKey={(index) => prs[index].number}
          >
            {(index) => {
              const pr = prs[index];
              const active = selected?.number === pr.number;
              return (
                <button
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-0 border-b border-dashed border-tva-gold/12 py-2 pr-2 text-left font-mono text-xs min-h-10 hover:bg-tva-orange/8",
                    fileRowPad,
                    active && fileRowSelected,
                  )}
                  onClick={() => {
                    setSelected(pr);
                    setHead(pr.headRef);
                    setBase(pr.baseRef);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-tva-paper">
                      <span className="text-tva-muted">#{pr.number}</span> {pr.title}
                    </span>
                    <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-tva-muted">
                      <PersonName name={pr.userLogin} login={pr.userLogin} /> · {pr.headRef} → {pr.baseRef}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {pr.draft ? <span className={stamp} title="Draft pull request">DRAFT</span> : null}
                    {pr.mergeable === false ? <span className={stamp} title="Merge conflict">CONFLICT</span> : null}
                  </span>
                </button>
              );
            }}
          </TvaVirtualList>
        </HqListPane>
      }
      middle={
        <PrCompare
          repoPath={props.repoPath}
          timeline={props.timeline}
          currentBranch={props.currentBranch}
          sacredBranch={props.sacredBranch}
          head={head}
          base={base}
          headSpec={specs.head}
          baseSpec={specs.base}
          extraBranches={extraBranches}
          onHead={chooseHead}
          onBase={chooseBase}
        >
          {pullsOpen ? (
            selected && sameGitRef(selected.headRef, head) && sameGitRef(selected.baseRef, base) ? (
              <div>
                <h3 className="m-0 text-sm text-tva-paper">
                  <span className="text-tva-muted">#{selected.number}</span> {selected.title}
                </h3>
                <p className="mt-3 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
                  Docket · Conversation
                </p>
                <DocketFeed entries={docket} />
                <ReviewForm
                  onSubmit={async (event, reviewBody) => {
                    if (!props.signedIn || !props.owner || !props.repoName) return;
                    // Conversation notes use the issues comments API so GitHub
                    // attributes them "with Timestream", same as incidents.
                    if (event === "COMMENT") {
                      await githubAddIssueComment(
                        props.owner,
                        props.repoName,
                        selected.number,
                        reviewBody,
                      );
                    } else {
                      await githubSubmitReview(props.owner, props.repoName, selected.number, {
                        body: reviewBody,
                        event,
                        comments: [],
                      });
                    }
                    await reloadConversation(selected.number, selected.headSha);
                  }}
                />
              </div>
            ) : (
              <div>
                <p className="m-0 mb-2 text-[10px] uppercase tracking-[0.12em] text-tva-gold">Open request</p>
                <p className="m-0 mb-2 text-[11px] text-tva-muted">
                  {githubRefName(head) || "—"} into {githubRefName(base) || "—"}
                </p>
                <input className={`${fieldInput} mb-1`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea className={`${fieldInput} mb-1`} rows={3} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
                <label className="mb-2 flex items-center gap-2.5 text-[11px] text-tva-muted">
                  <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
                  Draft pull request
                </label>
                <TransmitButton
                  active={filing}
                  disabled={!title.trim() || !head || !base || sameGitRef(head, base)}
                  idleClass={`${btnPrimary} w-full`}
                  onClick={() => {
                    void (async () => {
                      if (!props.owner || !props.repoName || !head || !base || filing) return;
                      setFiling(true);
                      try {
                        const input: CreatePullRequest = {
                          title,
                          body,
                          head: githubRefName(head),
                          base: githubRefName(base),
                          draft,
                        };
                        const created = await githubCreatePull(props.owner, props.repoName, input);
                        setTitle("");
                        setBody("");
                        setSelected(created);
                        setHead(created.headRef);
                        setBase(created.baseRef);
                        await reload();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setFiling(false);
                      }
                    })();
                  }}
                  title="Create pull request"
                  label="Filing…"
                  flavor="Open request"
                  noun="Create pull request"
                  busyNoun="Filing…"
                  onPrimary
                />
              </div>
            )
          ) : (
            <FeatureSeal kind="requests" {...props} />
          )}
        </PrCompare>
      }
      right={
        selected ? (
          <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] pt-4 pb-[18px]">
            <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">DOSSIER</h3>
            <p className="mt-2 text-[11px] text-tva-muted">
              {selected.headRef} → {selected.baseRef}
              {selected.ciStatus ? ` · ${selected.ciStatus}` : ""}
            </p>
            {error ? <p className="mt-2 text-xs text-[#ff8a6a]">{error}</p> : null}
            <div className="mt-3 flex flex-col gap-1">
              <TransmitButton
                active={acting === "checkout"}
                disabled={Boolean(acting)}
                idleClass={`${btn} w-full`}
                onClick={() =>
                  void runDossier("checkout", async () => {
                    await props.onCheckoutPr(selected.number);
                  })
                }
                title="Check out pull request"
                label="Checking out…"
                flavor="Local"
                noun="Check out pull request"
                busyNoun="Checking out…"
              />
              <TransmitButton
                active={acting === "draft"}
                disabled={Boolean(acting) || selected.state !== "open"}
                idleClass={`${btn} w-full`}
                onClick={() =>
                  void runDossier("draft", async () => {
                    if (!props.signedIn || !props.owner || !props.repoName) return;
                    await applyPull(
                      await githubUpdatePull(props.owner, props.repoName, selected.number, {
                        draft: !selected.draft,
                      }),
                    );
                  })
                }
                title={selected.draft ? "Mark ready for review" : "Convert to draft"}
                label={selected.draft ? "Publishing…" : "Sealing…"}
                flavor={selected.draft ? "Publish" : "Seal"}
                noun={selected.draft ? "Mark ready" : "Convert to draft"}
                busyNoun={selected.draft ? "Publishing…" : "Sealing…"}
              />
              <TransmitButton
                active={acting === "state"}
                disabled={Boolean(acting)}
                idleClass={`${btn} w-full`}
                onClick={() =>
                  void runDossier("state", async () => {
                    if (!props.signedIn || !props.owner || !props.repoName) return;
                    await applyPull(
                      await githubUpdatePull(props.owner, props.repoName, selected.number, {
                        state: selected.state === "open" ? "closed" : "open",
                      }),
                    );
                  })
                }
                title={selected.state === "open" ? "Close pull request" : "Reopen pull request"}
                label={selected.state === "open" ? "Closing…" : "Reopening…"}
                flavor={selected.state === "open" ? "Archive" : "Restore"}
                noun={selected.state === "open" ? "Close" : "Reopen"}
                busyNoun={selected.state === "open" ? "Closing…" : "Reopening…"}
              />
            </div>
            <p className="mt-4 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
              Restore · Merge pull request
            </p>
            <div className="flex flex-col gap-1">
              {(
                [
                  ["merge", "Merge", "Merging…"],
                  ["squash", "Squash", "Squashing…"],
                  ["rebase", "Rebase", "Rebasing…"],
                ] as const
              ).map(([method, noun, busyNoun]) => (
                <TransmitButton
                  key={method}
                  active={acting === method}
                  disabled={
                    Boolean(acting) ||
                    selected.draft ||
                    selected.state !== "open" ||
                    selected.mergeable === false
                  }
                  idleClass={`${btnPrimary} w-full`}
                  onClick={() =>
                    void runDossier(method, async () => {
                      if (!props.signedIn || !props.owner || !props.repoName) return;
                      const base = selected.baseRef;
                      await applyPull(
                        await githubMergePull(props.owner, props.repoName, selected.number, method),
                      );
                      await props.onSyncAfterMerge(githubRefName(base));
                    })
                  }
                  title={
                    selected.draft
                      ? "Draft requests cannot be merged"
                      : selected.mergeable === false
                        ? "Resolve conflicts before merging"
                        : selected.state !== "open"
                          ? "Request is not open"
                          : `${noun} pull request`
                  }
                  label={busyNoun}
                  flavor="Restore"
                  noun={noun}
                  busyNoun={busyNoun}
                  onPrimary
                />
              ))}
            </div>
            <p className="mt-4 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
              Integrity · Checks
            </p>
            {checks.length === 0 ? (
              <p className={cn(emptyText, "mt-1")}>No check runs on this tip.</p>
            ) : (
              checks.map((run) => (
                <div key={run.id} className="mt-1 flex items-center justify-between gap-2 text-[11px] text-tva-paper-dim">
                  <span>
                    {run.name} · {run.conclusion ?? run.status}
                  </span>
                  {run.conclusion === "failure" ? (
                    <TransmitButton
                      active={acting === `rerun-${run.id}`}
                      disabled={Boolean(acting)}
                      idleClass={btn}
                      onClick={() =>
                        void runDossier(`rerun-${run.id}`, async () => {
                          if (!props.signedIn || !props.owner || !props.repoName) return;
                          await githubRerunJob(props.owner, props.repoName, run.id);
                          setChecks(
                            await githubListChecks(props.owner, props.repoName, selected.headSha).catch(
                              () => checks,
                            ),
                          );
                        })
                      }
                      title="Re-run GitHub Actions job"
                      label="Re-running…"
                      flavor="Retry"
                      noun="Re-run"
                      busyNoun="Re-running…"
                    />
                  ) : null}
                </div>
              ))
            )}
          </TvaScrollArea>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col px-[18px] pt-4">
            <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">DOSSIER</h3>
            <p className={cn(emptyText, "mt-2")}>Select a request to inspect.</p>
          </div>
        )
      }
    />
  );
}

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

function DocketFeed({ entries }: { entries: DocketEntry[] }) {
  const now = useNow();
  return (
    <>
      {entries.map((entry) => (
        <DocketItem key={entry.id} entry={entry} now={now} />
      ))}
    </>
  );
}

function DocketWhen({ at, now }: { at: string; now: number }) {
  const relative = formatRelativeTime(at, now);
  const absolute = formatLocalDateTime(at);
  if (!relative) return null;
  return (
    <time
      dateTime={at}
      title={absolute}
      className="cursor-help text-tva-muted underline decoration-dotted decoration-tva-gold/35 underline-offset-2"
    >
      {relative}
    </time>
  );
}

function DocketItem({ entry, now }: { entry: DocketEntry; now: number }) {
  const mark =
    entry.kind === "opened"
      ? "REQUEST"
      : entry.kind === "incident"
        ? "INCIDENT"
        : entry.kind === "commits"
          ? "LEDGER"
          : entry.kind === "review" && entry.state === "APPROVED"
            ? "CLEAR"
            : entry.kind === "review" && entry.state === "CHANGES_REQUESTED"
              ? "FLAG"
              : entry.kind === "review"
                ? "NOTE"
                : entry.kind === "reviewComment"
                  ? "LINE"
                  : "NOTE";
  const gold = mark === "CLEAR" || mark === "REQUEST" || mark === "INCIDENT";
  const action = docketAction(entry);

  return (
    <div className="mb-2 border border-tva-gold/16 bg-[#1b1713] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 font-mono text-[11px] text-tva-paper">
          <PersonName name={entry.user} login={entry.user} email={entry.email} /> {action}{" "}
          <DocketWhen at={entry.at} now={now} />
          {entry.kind === "reviewComment" && entry.path
            ? ` · ${entry.path}${entry.line != null ? `:${entry.line}` : ""}`
            : ""}
        </p>
        <span className={cn(stamp, gold && stampGold)}>{mark}</span>
      </div>
      {(entry.kind === "opened" || entry.kind === "incident") && entry.summary ? (
        <p className="m-0 mt-1.5 text-[12px] text-tva-paper">{entry.summary}</p>
      ) : null}
      {entry.kind === "commits"
        ? (entry.commits ?? []).map((commit) => (
            <div key={`${commit.shortId}-${commit.at}`} className="mt-1 flex items-baseline gap-2 font-mono text-[11px]">
              <span className="shrink-0 text-tva-gold">{commit.shortId}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-tva-paper-dim">
                {commit.summary}
              </span>
            </div>
          ))
        : null}
      {entry.body ? (
        <p className="m-0 mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-tva-paper-dim">
          {entry.body}
        </p>
      ) : entry.kind === "opened" || entry.kind === "incident" ? (
        <p className={cn(emptyText, "mt-1.5")}>No description.</p>
      ) : null}
    </div>
  );
}

function ReviewForm({ onSubmit }: { onSubmit: (event: string, body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  async function submit(event: string) {
    if (sending) return;
    if (event === "COMMENT" && !body.trim()) return;
    setSending(event);
    try {
      await onSubmit(event, body);
      setBody("");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="mt-2">
      <textarea
        className={fieldInput}
        rows={2}
        value={body}
        disabled={Boolean(sending)}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Review note"
      />
      <div className="mt-1 flex flex-wrap gap-1">
        <TransmitButton
          active={sending === "APPROVE"}
          disabled={Boolean(sending)}
          idleClass={btn}
          onClick={() => void submit("APPROVE")}
          title="Approve"
          label="Stamping…"
          flavor="Clear"
          noun="Approve"
          busyNoun="Stamping…"
        />
        <TransmitButton
          active={sending === "COMMENT"}
          disabled={Boolean(sending) || !body.trim()}
          idleClass={btn}
          onClick={() => void submit("COMMENT")}
          title="Comment"
          label="Filing…"
          flavor="Note"
          noun="Comment"
          busyNoun="Filing…"
        />
        <TransmitButton
          active={sending === "REQUEST_CHANGES"}
          disabled={Boolean(sending)}
          idleClass={btn}
          onClick={() => void submit("REQUEST_CHANGES")}
          title="Request changes"
          label="Flagging…"
          flavor="Flag"
          noun="Request changes"
          busyNoun="Flagging…"
        />
      </div>
      <p className="m-0 mt-1 text-[10px] text-tva-muted">Stamps CLEAR / FLAG apply after GitHub records the review.</p>
    </div>
  );
}

function IncidentsPanel(props: HqModeProps & FeatureDesk) {
  const [filter, setFilter] = useState("open");
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [selected, setSelected] = useState<IssueSummary | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [filing, setFiling] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issuesOpen = props.features?.hasIssues !== false;

  async function reload() {
    if (!props.signedIn || !props.owner || !props.repoName || !issuesOpen) return;
    try {
      setError(null);
      setIssues(await githubListIssues(props.owner, props.repoName, filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (!issuesOpen) {
      setIssues([]);
      return;
    }
    void reload();
  }, [props.owner, props.repoName, filter, issuesOpen]);

  useEffect(() => {
    if (!selected || !props.owner || !props.repoName) return;
    void githubListIssueComments(props.owner, props.repoName, selected.number)
      .then(setComments)
      .catch(() => setComments([]));
  }, [selected?.number, props.owner, props.repoName]);

  if (!props.signedIn) {
    return (
      <HqDesk
        left={<HqListPane title="INCIDENTS" count={0} empty="Sign in to load incidents." />}
        middle={<NeedClearance />}
      />
    );
  }
  if (!props.owner) {
    return (
      <HqDesk
        left={<HqListPane title="INCIDENTS" count={0} empty="No GitHub origin on this archive." />}
        middle={<p className={`${emptyText} p-6`}>No GitHub origin on this archive.</p>}
      />
    );
  }

  return (
    <HqDesk
      left={
        <HqListPane
          title="INCIDENTS"
          count={issues.length}
          error={error}
          empty={issuesOpen ? "No incidents in this filter." : "Incidents are sealed on this origin."}
          filters={
            issuesOpen ? (
              <>
                {["open", "assigned", "closed"].map((item) => (
                  <button key={item} type="button" className={btn} onClick={() => setFilter(item)}>
                    {item}
                  </button>
                ))}
              </>
            ) : undefined
          }
        >
          <TvaVirtualList
            className="min-h-0 flex-1"
            axis="y"
            fill
            count={issues.length}
            estimateSize={() => 52}
            getItemKey={(index) => issues[index].number}
          >
            {(index) => {
              const issue = issues[index];
              const active = selected?.number === issue.number;
              return (
                <button
                  type="button"
                  className={cn(
                    "grid w-full items-start border-0 border-b border-dashed border-tva-gold/12 py-2 pr-2 text-left font-mono text-xs min-h-10 hover:bg-tva-orange/8",
                    fileRowPad,
                    active && fileRowSelected,
                  )}
                  onClick={() => setSelected(issue)}
                >
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-tva-paper">
                    <span className="text-tva-muted">#{issue.number}</span> {issue.title}
                  </span>
                  <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-tva-muted">
                    <PersonName name={issue.userLogin} login={issue.userLogin} /> · {issue.labels.join(", ") || "unlabeled"}
                  </span>
                </button>
              );
            }}
          </TvaVirtualList>
        </HqListPane>
      }
      middle={
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-[18px] pt-4 pb-[18px]">
          {issuesOpen ? (
            <div className="mb-4">
              <p className="m-0 mb-2 text-[10px] uppercase tracking-[0.12em] text-tva-gold">File incident</p>
              <input className={`${fieldInput} mb-1`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className={`${fieldInput} mb-1`} rows={3} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
              <TransmitButton
                active={filing}
                disabled={!title.trim()}
                idleClass={`${btnPrimary} w-full`}
                onClick={() => {
                  void (async () => {
                    if (!props.signedIn || !props.owner || !props.repoName || filing) return;
                    setFiling(true);
                    try {
                      const input: CreateIssue = { title, body, labels: [], assignees: [] };
                      const created = await githubCreateIssue(props.owner, props.repoName, input);
                      setTitle("");
                      setBody("");
                      setSelected(created);
                      await reload();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setFiling(false);
                    }
                  })();
                }}
                title="Create issue"
                label="Filing…"
                flavor="File incident"
                noun="Create issue"
                busyNoun="Filing…"
                onPrimary
              />
            </div>
          ) : (
            <FeatureSeal kind="incidents" {...props} />
          )}
          {selected ? (
            <div className="border-t border-tva-gold/16 pt-4">
              <h3 className="m-0 text-sm text-tva-paper">
                <span className="text-tva-muted">#{selected.number}</span> {selected.title}
              </h3>
              <p className="mt-3 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
                Docket · Conversation
              </p>
              <DocketFeed entries={buildIssueDocket(selected, comments)} />
              <textarea
                className={`${fieldInput} mt-2`}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comment"
              />
              <TransmitButton
                active={commenting}
                disabled={!note.trim()}
                idleClass={`${btn} mt-1`}
                onClick={() => {
                  void (async () => {
                    if (!props.owner || !props.repoName || !note.trim() || commenting) return;
                    setCommenting(true);
                    try {
                      await githubAddIssueComment(props.owner, props.repoName, selected.number, note);
                      setNote("");
                      setComments(await githubListIssueComments(props.owner, props.repoName, selected.number));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setCommenting(false);
                    }
                  })();
                }}
                title="Comment"
                label="Filing…"
                flavor="Note"
                noun="Comment"
                busyNoun="Filing…"
              />
            </div>
          ) : issuesOpen ? (
            <p className={cn(emptyText, "mt-2")}>Select an incident from the left rail.</p>
          ) : null}
        </TvaScrollArea>
      }
      right={
        selected ? (
          <div className="flex min-h-0 flex-1 flex-col px-[18px] pt-4 pb-[18px]">
            <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">DOSSIER</h3>
            <p className="mt-2 text-[11px] text-tva-muted">{selected.state}</p>
            <button
              type="button"
              className={`${btn} mt-3`}
              onClick={async () => {
                if (!props.signedIn || !props.owner || !props.repoName) return;
                await githubUpdateIssue(props.owner, props.repoName, selected.number, {
                  state: selected.state === "open" ? "closed" : "open",
                });
                await reload();
              }}
            >
              {selected.state === "open" ? "Close" : "Reopen"}
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col px-[18px] pt-4">
            <h3 className="m-0 text-[11px] tracking-[0.14em] text-tva-gold">DOSSIER</h3>
            <p className={cn(emptyText, "mt-2")}>Select an incident to inspect.</p>
          </div>
        )
      }
    />
  );
}

function CanonPanel(props: HqModeProps) {
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);

  async function reload() {
    if (!props.signedIn || !props.owner || !props.repoName) return;
    setReleases(await githubListReleases(props.owner, props.repoName));
  }

  useEffect(() => {
    void reload().catch(() => {});
  }, [props.owner, props.repoName]);

  const tags = (props.timeline?.nodes ?? []).flatMap((n) => n.refs.filter((r) => r.kind === "tag").map((r) => r.name));

  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="p-3">
      <p className={`${fieldLabel} mb-1`}>
        Marker · Tag on selected nexus
      </p>
      <div className="mb-3 flex gap-1">
        <input className={fieldInput} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="v1.0.0" />
        <button
          type="button"
          className={btn}
          disabled={!tag.trim() || !props.selectedSha}
          onClick={() => {
            if (!props.selectedSha) return;
            props.onCreateTag(tag.trim(), props.selectedSha);
          }}
        >
          Create tag
        </button>
        <button type="button" className={btn} disabled={!tag.trim()} onClick={() => props.onPushTag(tag.trim())}>
          Push tag
        </button>
      </div>
      {!props.signedIn ? <NeedClearance /> : null}
      {props.signedIn && props.owner ? (
        <>
          <div className="mb-3 border border-tva-gold/16 p-2">
            <p className="m-0 mb-2 text-[10px] uppercase tracking-[0.12em] text-tva-gold">Declare canon · Create release</p>
            <select className={`${fieldInput} mb-1`} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Existing tag…</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className={`${fieldInput} mb-1`} placeholder="Release name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className={`${fieldInput} mb-1`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
            <label className="mr-3 inline-flex items-center gap-2.5 text-[11px] text-tva-muted">
              <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
              Draft
            </label>
            <label className="inline-flex items-center gap-2.5 text-[11px] text-tva-muted">
              <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} />
              Prerelease
            </label>
            <button
              type="button"
              className={`${btnPrimary} mt-2`}
              disabled={!tag.trim()}
              onClick={async () => {
                if (!props.signedIn || !props.owner || !props.repoName) return;
                const input: CreateRelease = {
                  tagName: tag.trim(),
                  name: name || tag.trim(),
                  body,
                  draft,
                  prerelease,
                };
                await githubCreateRelease(props.owner, props.repoName, input);
                await reload();
              }}
            >
              Create release
            </button>
          </div>
          {releases.map((rel) => (
            <div key={rel.id} className="mb-2 border border-tva-gold/14 p-2 text-xs">
              <span className={stamp} title="GitHub Release">
                CANON
              </span>{" "}
              {rel.tagName} · {rel.name}
              {rel.draft ? " · draft" : ""}
              {rel.prerelease ? " · pre" : ""}
              <p className="m-0 mt-1 text-tva-paper-dim">{rel.body}</p>
              {rel.draft ? (
                <button
                  type="button"
                  className={`${btn} mt-1`}
                  onClick={async () => {
                    if (!props.signedIn || !props.owner || !props.repoName) return;
                    await githubUpdateRelease(props.owner, props.repoName, rel.id, { draft: false });
                    await reload();
                  }}
                >
                  Publish draft
                </button>
              ) : null}
            </div>
          ))}
        </>
      ) : props.signedIn ? (
        <p className={`${emptyText} mt-2`}>No GitHub origin on this archive.</p>
      ) : null}
    </TvaScrollArea>
  );
}

function FeatureSeal({
  kind,
  features,
  onRecheckFeatures,
  recheckingFeatures,
  recheckError,
}: FeatureDesk & { kind: "requests" | "incidents" }) {
  const settingsUrl = features?.htmlUrl ? `${features.htmlUrl.replace(/\/$/, "")}/settings` : null;
  const noun = kind === "requests" ? "Pull requests" : "Issues";
  const flavor = kind === "requests" ? "Requests sealed" : "Incidents sealed";
  const copy = features?.archived
    ? "This origin archive is frozen. GitHub will not accept new requests or incidents."
    : `${noun} are off on this origin. Enable them in GitHub Settings → General → Features, then recheck.`;

  return (
    <div className="mb-3 border border-tva-stamp/40 bg-[#2a1814] p-3">
      <p className="m-0 text-[10px] uppercase tracking-[0.14em] text-tva-stamp">{flavor}</p>
      <p className={cn(emptyText, "mt-2")}>{copy}</p>
      {recheckError ? <p className="mt-2 text-xs text-[#ff8a6a]">{recheckError}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {settingsUrl ? (
          <button type="button" className={btn} onClick={() => void openUrl(settingsUrl)}>
            Open GitHub settings
          </button>
        ) : null}
        {features?.archived ? null : (
          <TransmitButton
            active={recheckingFeatures}
            disabled={recheckingFeatures}
            idleClass={btn}
            onClick={onRecheckFeatures}
            title={`Recheck whether ${noun.toLowerCase()} are enabled`}
            label="Rechecking…"
            flavor="Recanvass"
            noun="Recheck features"
            busyNoun="Rechecking…"
          />
        )}
      </div>
    </div>
  );
}

function NeedClearance() {
  return (
    <p className={`${emptyText} p-4`}>
      Sign in with GitHub to load this desk.
    </p>
  );
}

function HqClearance({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex w-full max-w-[28rem] flex-col items-center text-center">
      <p className={eyebrow}>HQ desk</p>
      <h2 className="mt-2 mb-0 font-display text-[18px] tracking-[0.14em] text-tva-gold">
        Clearance required
      </h2>
      <p className={cn(emptyText, "mt-3 max-w-[24rem]")}>
        Sign in with GitHub to run this desk against the origin archive.
      </p>
      <ul className="mt-4 mb-0 w-full list-none p-0 text-left text-[12px] leading-[1.55] text-tva-paper-dim">
        <li className="border-b border-dashed border-tva-gold/12 py-1.5">
          <span className="text-tva-gold">Requests</span> — list, open, review, and merge pull requests; check out a request locally
        </li>
        <li className="border-b border-dashed border-tva-gold/12 py-1.5">
          <span className="text-tva-gold">Incidents</span> — file and comment on issues
        </li>
        <li className="border-b border-dashed border-tva-gold/12 py-1.5">
          <span className="text-tva-gold">Canon</span> — declare and publish releases
        </li>
        <li className="py-1.5">
          <span className="text-tva-gold">Integrity</span> — read check runs and re-run failed Actions jobs
        </li>
      </ul>
      <button
        type="button"
        className={cn(btnPrimary, "mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5")}
        onClick={onSignIn}
      >
        <SiGithub size={14} aria-hidden />
        Sign in with GitHub
      </button>
    </div>
  );
}
