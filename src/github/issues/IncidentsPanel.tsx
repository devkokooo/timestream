import { useEffect, useState } from "react";
import {
  githubAddIssueComment,
  githubCreateIssue,
  githubListIssueComments,
  githubListIssues,
  githubUpdateIssue,
} from "@/github/issues/api";
import { buildIssueDocket } from "@/github/pulls/prDocket";
import { cn } from "@/ui/cn";
import { btn, btnPrimary, emptyText, fieldInput, fileRowPad, fileRowSelected } from "@/ui/ui";
import type { CreateIssue, IssueComment, IssueSummary } from "@/github/issues/types";
import { dispatchMessage } from "@/github/dispatch";
import { DocketFeed } from "@/github/pulls/DocketFeed";
import { PersonName } from "@/auth/PersonName";
import { TransmitButton } from "@/ui/TransmitButton";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { TvaVirtualList } from "@/ui/TvaVirtualList";
import { FeatureSeal, HqDesk, HqDispatch, HqListPane, NeedClearance } from "@/github/hqChrome";
import type { FeatureDesk, HqModeProps } from "@/github/hqTypes";

export function IncidentsPanel(props: HqModeProps & FeatureDesk) {
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
      setError(dispatchMessage(err));
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
      .catch((err) => {
        setComments([]);
        setError(dispatchMessage(err));
      });
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
          onRetry={() => void reload()}
          onSignIn={props.onSignIn}
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
                      setError(dispatchMessage(err));
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
                      setError(dispatchMessage(err));
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
            <HqDispatch error={error} compact onSignIn={props.onSignIn} />
            <button
              type="button"
              className={`${btn} mt-3`}
              onClick={async () => {
                if (!props.signedIn || !props.owner || !props.repoName) return;
                try {
                  await githubUpdateIssue(props.owner, props.repoName, selected.number, {
                    state: selected.state === "open" ? "closed" : "open",
                  });
                  await reload();
                } catch (err) {
                  setError(dispatchMessage(err));
                }
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
