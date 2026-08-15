import { useEffect, useMemo, useState } from "react";
import {
  githubAddIssueComment,
  githubCreateIssue,
  githubCreatePull,
  githubCreateRelease,
  githubGetPull,
  githubListChecks,
  githubListIssueComments,
  githubListIssues,
  githubListPulls,
  githubListReleases,
  githubListReviewComments,
  githubMergePull,
  githubRerunJob,
  githubSubmitReview,
  githubUpdateIssue,
  githubUpdatePull,
  githubUpdateRelease,
} from "../lib/api";
import { cn } from "../lib/cn";
import { detectStacks } from "../lib/stackDetect";
import { btn, btnPrimary, btnStow, emptyText, fieldInput, fieldLabel, stamp } from "../lib/ui";
import type {
  CheckRunSummary,
  CommitDetail,
  CreateIssue,
  CreatePullRequest,
  CreateRelease,
  DocketTab,
  IssueComment,
  IssueSummary,
  PullRequestSummary,
  ReleaseSummary,
  ReviewComment,
  Timeline,
  TimelineNode,
} from "../lib/types";
import { CaseFile } from "./CaseFile";
import { HintMark, TvaTerm } from "./TvaTerm";
import { TvaScrollArea } from "./TvaScrollArea";

interface DocketProps {
  tab: DocketTab;
  onTab: (tab: DocketTab) => void;
  node: TimelineNode | null;
  detail: CommitDetail | null;
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
  onSelectCommit: (id: string) => void;
  owner: string | null;
  repoName: string | null;
  signedIn: boolean;
  currentBranch: string | null;
  sacredBranch: string | null;
  timeline: Timeline;
  onCheckoutPr: (number: number) => void;
  onCreateTag: (name: string, sha: string, message?: string) => void;
  onPushTag: (name: string) => void;
  selectedSha: string | null;
  checksBySha: Record<string, string>;
  onStow: () => void;
}

export function Docket(props: DocketProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#1b1713] p-0">
      <div className="flex shrink-0 border-b border-tva-gold/16">
        <div className="flex min-w-0 flex-1">
          <TabBtn active={props.tab === "case"} onClick={() => props.onTab("case")} flavor="Case file" noun="Commit" />
          <TabBtn active={props.tab === "requests"} onClick={() => props.onTab("requests")} flavor="Requests" noun="Pull requests" />
          <TabBtn active={props.tab === "incidents"} onClick={() => props.onTab("incidents")} flavor="Incidents" noun="Issues" />
          <TabBtn active={props.tab === "canon"} onClick={() => props.onTab("canon")} flavor="Canon" noun="Releases" />
        </div>
        <button type="button" className={cn(btnStow, "m-1")} onClick={props.onStow}>
          Stow
        </button>
      </div>
      {props.tab === "case" ? (
        <div className="min-h-0 flex-1 overflow-hidden [&_aside]:border-0">
          <CaseFile
            node={props.node}
            detail={props.detail}
            selectedPath={props.selectedPath}
            onOpenFile={props.onOpenFile}
            onSelectCommit={props.onSelectCommit}
            checks={props.selectedSha ? props.checksBySha[props.selectedSha] : undefined}
          />
        </div>
      ) : null}
      {props.tab === "requests" ? <RequestsPanel {...props} /> : null}
      {props.tab === "incidents" ? <IncidentsPanel {...props} /> : null}
      {props.tab === "canon" ? <CanonPanel {...props} /> : null}
    </aside>
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

function RequestsPanel(props: DocketProps) {
  const [filter, setFilter] = useState("open");
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [selected, setSelected] = useState<PullRequestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [checks, setChecks] = useState<CheckRunSummary[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const stacks = useMemo(() => detectStacks(prs), [prs]);

  async function reload() {
    if (!props.owner || !props.repoName || !props.signedIn) return;
    try {
      setError(null);
      setPrs(await githubListPulls(props.owner, props.repoName, filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void reload();
  }, [props.owner, props.repoName, props.signedIn, filter]);

  useEffect(() => {
    if (!selected || !props.owner || !props.repoName) return;
    void githubGetPull(props.owner, props.repoName, selected.number).then(setSelected).catch(() => {});
    void githubListChecks(props.owner, props.repoName, selected.headSha).then(setChecks).catch(() => setChecks([]));
    void githubListReviewComments(props.owner, props.repoName, selected.number)
      .then(setComments)
      .catch(() => setComments([]));
  }, [selected?.number, selected?.headSha, props.owner, props.repoName]);

  if (!props.signedIn) {
    return <NeedClearance />;
  }
  if (!props.owner) {
    return <p className={`${emptyText} p-4`}>No GitHub origin on this archive.</p>;
  }

  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="p-3">
      <div className="mb-2 flex flex-wrap gap-1">
        {["open", "mine", "review", "draft"].map((item) => (
          <button key={item} type="button" className={btn} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-[#ff8a6a]">{error}</p> : null}
      {stacks.length > 0 ? (
        <div className="mb-3 border border-tva-gold/20 p-2">
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
      ) : null}
      <div className="mb-3 border border-tva-gold/16 p-2">
        <p className="m-0 mb-2 text-[10px] uppercase tracking-[0.12em] text-tva-gold">Open request</p>
        <input className={`${fieldInput} mb-1`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={`${fieldInput} mb-1`} rows={2} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
        <label className="mb-2 flex items-center gap-2.5 text-[11px] text-tva-muted">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          Draft pull request
        </label>
        <button
          type="button"
          className={btnPrimary}
          disabled={!title.trim() || !props.currentBranch}
          onClick={async () => {
            if (!props.owner || !props.repoName || !props.currentBranch) return;
            const input: CreatePullRequest = {
              title,
              body,
              head: props.currentBranch,
              base: props.sacredBranch ?? "main",
              draft,
            };
            const created = await githubCreatePull(props.owner, props.repoName, input);
            setTitle("");
            setBody("");
            setSelected(created);
            await reload();
          }}
        >
          <TvaTerm flavor="Open request" noun="Create pull request" onPrimary />
        </button>
      </div>
      {prs.map((pr) => (
        <button
          key={pr.number}
          type="button"
          className="mb-1 w-full border border-tva-gold/14 p-2 text-left text-xs hover:bg-tva-orange/8"
          onClick={() => setSelected(pr)}
        >
          <span className="flex justify-between">
            <span>#{pr.number} {pr.title}</span>
            {pr.draft ? <span className={stamp} title="Draft pull request">DRAFT</span> : null}
            {pr.mergeable === false ? <span className={stamp} title="Merge conflict">CONFLICT</span> : null}
          </span>
          <span className="block text-[10px] text-tva-muted">
            {pr.headRef} → {pr.baseRef} · {pr.ciStatus ?? "checks unknown"}
          </span>
        </button>
      ))}
      {selected ? (
        <div className="mt-3 border-t border-tva-gold/16 pt-3">
          <h3 className="m-0 text-sm text-tva-paper">
            #{selected.number} {selected.title}
          </h3>
          <p className="text-xs text-tva-paper-dim">{selected.body || "No description."}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" className={btn} onClick={() => props.onCheckoutPr(selected.number)}>
              Check out pull request
            </button>
            <button
              type="button"
              className={btn}
              onClick={async () => {
                if (!props.owner || !props.repoName) return;
                await githubUpdatePull(props.owner, props.repoName, selected.number, {
                  draft: !selected.draft,
                });
                await reload();
              }}
            >
              {selected.draft ? "Mark ready" : "Convert to draft"}
            </button>
            <button
              type="button"
              className={btn}
              onClick={async () => {
                if (!props.owner || !props.repoName) return;
                await githubUpdatePull(props.owner, props.repoName, selected.number, {
                  state: selected.state === "open" ? "closed" : "open",
                });
                await reload();
              }}
            >
              {selected.state === "open" ? "Close" : "Reopen"}
            </button>
          </div>
          <p className="mt-2 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
            Restore · Merge pull request
          </p>
          <div className="flex flex-wrap gap-1">
            {["merge", "squash", "rebase"].map((method) => (
              <button
                key={method}
                type="button"
                className={btnPrimary}
                onClick={async () => {
                  if (!props.owner || !props.repoName) return;
                  await githubMergePull(props.owner, props.repoName, selected.number, method);
                  await reload();
                }}
              >
                {method}
              </button>
            ))}
          </div>
          <p className="mt-3 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
            Integrity · Checks
          </p>
          {checks.map((run) => (
            <div key={run.id} className="flex items-center justify-between text-[11px] text-tva-paper-dim">
              <span>
                {run.name} · {run.conclusion ?? run.status}
              </span>
              {run.conclusion === "failure" ? (
                <button
                  type="button"
                  className={btn}
                  title="Re-run GitHub Actions job"
                  onClick={() => {
                    if (!props.owner || !props.repoName) return;
                    void githubRerunJob(props.owner, props.repoName, run.id);
                  }}
                >
                  Re-run
                </button>
              ) : null}
            </div>
          ))}
          <p className="mt-3 mb-1 text-[10px] uppercase tracking-[0.12em] text-tva-gold">
            Tribunal · Review comments
          </p>
          {comments.map((c) => (
            <p key={c.id} className="m-0 mb-1 text-[11px] text-tva-paper-dim" title="Pull request review comment">
              {c.path}:{c.line ?? "?"} · {c.userLogin}: {c.body}
            </p>
          ))}
          <ReviewForm
            onSubmit={async (event, reviewBody) => {
              if (!props.owner || !props.repoName) return;
              await githubSubmitReview(props.owner, props.repoName, selected.number, {
                body: reviewBody,
                event,
                comments: [],
              });
            }}
          />
        </div>
      ) : null}
    </TvaScrollArea>
  );
}

function ReviewForm({ onSubmit }: { onSubmit: (event: string, body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  return (
    <div className="mt-2">
      <textarea className={fieldInput} rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Review note" />
      <div className="mt-1 flex flex-wrap gap-1">
        <button type="button" className={btn} onClick={() => void onSubmit("APPROVE", body)}>
          Approve
        </button>
        <button type="button" className={btn} onClick={() => void onSubmit("COMMENT", body)}>
          Comment
        </button>
        <button type="button" className={btn} onClick={() => void onSubmit("REQUEST_CHANGES", body)}>
          Request changes
        </button>
      </div>
      <p className="m-0 mt-1 text-[10px] text-tva-muted">Stamps CLEAR / FLAG apply after GitHub records the review.</p>
    </div>
  );
}

function IncidentsPanel(props: DocketProps) {
  const [filter, setFilter] = useState("open");
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [selected, setSelected] = useState<IssueSummary | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  async function reload() {
    if (!props.owner || !props.repoName || !props.signedIn) return;
    setIssues(await githubListIssues(props.owner, props.repoName, filter));
  }

  useEffect(() => {
    void reload().catch(() => {});
  }, [props.owner, props.repoName, props.signedIn, filter]);

  useEffect(() => {
    if (!selected || !props.owner || !props.repoName) return;
    void githubListIssueComments(props.owner, props.repoName, selected.number)
      .then(setComments)
      .catch(() => setComments([]));
  }, [selected?.number, props.owner, props.repoName]);

  if (!props.signedIn) return <NeedClearance />;
  if (!props.owner) return <p className={`${emptyText} p-4`}>No GitHub origin on this archive.</p>;

  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="p-3">
      <div className="mb-2 flex gap-1">
        {["open", "assigned", "closed"].map((item) => (
          <button key={item} type="button" className={btn} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="mb-3 border border-tva-gold/16 p-2">
        <input className={`${fieldInput} mb-1`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={`${fieldInput} mb-1`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <button
          type="button"
          className={btnPrimary}
          disabled={!title.trim()}
          onClick={async () => {
            if (!props.owner || !props.repoName) return;
            const input: CreateIssue = { title, body, labels: [], assignees: [] };
            const created = await githubCreateIssue(props.owner, props.repoName, input);
            setTitle("");
            setBody("");
            setSelected(created);
            await reload();
          }}
        >
          <TvaTerm flavor="File incident" noun="Create issue" onPrimary />
        </button>
      </div>
      {issues.map((issue) => (
        <button
          key={issue.number}
          type="button"
          className="mb-1 w-full border border-tva-gold/14 p-2 text-left text-xs"
          onClick={() => setSelected(issue)}
        >
          #{issue.number} {issue.title}
          <span className="block text-[10px] text-tva-muted">{issue.labels.join(", ") || "unlabeled"}</span>
        </button>
      ))}
      {selected ? (
        <div className="mt-3 border-t border-tva-gold/16 pt-3">
          <h3 className="m-0 text-sm">#{selected.number} {selected.title}</h3>
          <p className="text-xs text-tva-paper-dim">{selected.body}</p>
          <button
            type="button"
            className={`${btn} mt-2`}
            onClick={async () => {
              if (!props.owner || !props.repoName) return;
              await githubUpdateIssue(props.owner, props.repoName, selected.number, {
                state: selected.state === "open" ? "closed" : "open",
              });
              await reload();
            }}
          >
            {selected.state === "open" ? "Close" : "Reopen"}
          </button>
          {comments.map((c) => (
            <p key={c.id} className="text-[11px] text-tva-paper-dim">
              {c.userLogin}: {c.body}
            </p>
          ))}
          <textarea className={`${fieldInput} mt-2`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            type="button"
            className={`${btn} mt-1`}
            onClick={async () => {
              if (!props.owner || !props.repoName || !note.trim()) return;
              await githubAddIssueComment(props.owner, props.repoName, selected.number, note);
              setNote("");
              const next = await githubListIssueComments(props.owner, props.repoName, selected.number);
              setComments(next);
            }}
          >
            Comment
          </button>
        </div>
      ) : null}
    </TvaScrollArea>
  );
}

function CanonPanel(props: DocketProps) {
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);

  async function reload() {
    if (!props.owner || !props.repoName || !props.signedIn) return;
    setReleases(await githubListReleases(props.owner, props.repoName));
  }

  useEffect(() => {
    void reload().catch(() => {});
  }, [props.owner, props.repoName, props.signedIn]);

  const tags = props.timeline.nodes.flatMap((n) => n.refs.filter((r) => r.kind === "tag").map((r) => r.name));

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
                if (!props.owner || !props.repoName) return;
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
                    if (!props.owner || !props.repoName) return;
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
      ) : null}
    </TvaScrollArea>
  );
}

function NeedClearance() {
  return (
    <p className={`${emptyText} p-4`}>
      Sign in with GitHub to load this docket.
    </p>
  );
}
