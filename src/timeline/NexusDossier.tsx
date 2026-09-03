import { useMemo, type ReactNode } from "react";
import { cn } from "@/ui/cn";
import { formatPerson, parseCommitBody, type Trailer } from "@/timeline/commitTrailers";
import { btnStow, emptyText, eyebrow, panelTitle, stamp, stampGold } from "@/ui/ui";
import type { CommitDetail, TimelineNode } from "@/timeline/types";
import { PersonName } from "@/auth/PersonName";
import { CaseFileDetailSkeleton } from "@/ui/TvaSkeleton";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { PierreFileTree } from "@/diff/PierreFileTree";

interface Props {
  node: TimelineNode;
  detail: CommitDetail | null;
  reviewers?: string[];
  reviewDecision?: string | null;
  checks?: string | null;
  isPr?: boolean;
  failed?: boolean;
  onStow: () => void;
  onSelectCommit: (id: string) => void;
  onOpenFile?: (path: string) => void;
  onSeal?: () => void;
}

export function NexusDossier({
  node,
  detail,
  reviewers,
  reviewDecision,
  checks,
  isPr,
  failed,
  onStow,
  onSelectCommit,
  onOpenFile,
  onSeal,
}: Props) {
  const loading = !detail || detail.id !== node.id;
  const parsed = useMemo(() => parseCommitBody(detail && !loading ? detail.body : ""), [detail, loading]);
  const stampLabel = node.refs.some((r) => r.kind === "branch" && r.name !== "HEAD")
    ? node.column === 0
      ? "NEXUS"
      : "VARIANT"
    : "EVENT";
  const refs = node.refs.filter((r) => r.kind !== "head").map((r) => r.name);
  const parents = detail && !loading ? detail.parents : node.parents;
  const githubReviewers = (reviewers ?? []).filter(Boolean);
  const reviewNames = uniquePeople([
    ...parsed.reviewers.map((t) => formatPerson(t.name, t.email)),
    ...githubReviewers,
  ]);

  return (
    <div className="nexus-dossier absolute inset-0 z-20 flex min-h-0 flex-col" role="dialog" aria-label="Nexus dossier">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-tva-gold/20 px-5 py-3">
        <div>
          <p className={eyebrow}>Chronomonitoring division</p>
          <h2 className={cn(panelTitle, "mt-1")}>NEXUS DOSSIER</h2>
        </div>
        <div className="flex items-start gap-1.5">
          {node.isHead ? <span className={cn(stamp, stampGold)}>NOW</span> : null}
          {failed ? <span className={stamp}>FAILED</span> : null}
          {isPr ? <span className={cn(stamp, stampGold)}>REQUEST</span> : null}
          <span className={cn(stamp, node.column === 0 && stampGold)}>{stampLabel}</span>
          {onSeal ? (
            <button type="button" className={cn(btnStow, "ml-1")} onClick={onSeal} title="File a seal on this nexus">
              Seal
            </button>
          ) : null}
          <button type="button" className={cn(btnStow, onSeal ? undefined : "ml-1")} onClick={onStow}>
            Stow
          </button>
        </div>
      </div>
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-5 py-4">
        <div className="font-mono text-xs text-tva-gold-bright">
          {detail && !loading ? detail.id : node.id}
        </div>
        <h3 className="mt-2 mb-0 font-display text-[22px] leading-[1.35] tracking-[0.02em] text-tva-paper">
          {detail && !loading ? detail.summary : node.summary}
        </h3>

        <Section title="Description">
          {loading ? (
            <CaseFileDetailSkeleton />
          ) : parsed.narrative ? (
            <p className="m-0 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-tva-paper-dim">
              {parsed.narrative}
            </p>
          ) : (
            <p className={emptyText}>No description on file.</p>
          )}
        </Section>

        <Section title="Filed">
          <Meta
            label="Author"
            value={
              <PersonName
                name={formatPerson(
                  detail && !loading ? detail.author : node.author,
                  detail && !loading ? detail.email : node.email,
                )}
                email={detail && !loading ? detail.email : node.email}
              />
            }
          />
          <Meta
            label="Filed"
            value={formatWhen(detail && !loading ? detail.timestamp : node.timestamp)}
          />
          {detail && !loading ? (
            <>
              <Meta
                label="Committer"
                value={
                  <PersonName
                    name={formatPerson(detail.committer, detail.committerEmail)}
                    email={detail.committerEmail}
                  />
                }
              />
              {detail.committerTimestamp !== detail.timestamp ? (
                <Meta label="Committed" value={formatWhen(detail.committerTimestamp)} />
              ) : null}
              <Meta label="Seal" value={sealLabel(detail.signed, detail.signatureKind)} />
            </>
          ) : null}
          <p className="m-0 mt-1.5 font-mono text-[11px] text-tva-paper-dim">
            Parents{" "}
            {parents.length === 0
              ? "none"
              : parents.map((parentId, i) => (
                  <span key={parentId}>
                    {i > 0 ? ", " : null}
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 font-mono text-[11px] text-tva-muted underline decoration-tva-gold/25 underline-offset-2 hover:text-tva-gold hover:decoration-tva-gold/60"
                      onClick={() => onSelectCommit(parentId)}
                    >
                      {parentId.slice(0, 7)}
                    </button>
                  </span>
                ))}
          </p>
          {refs.length ? (
            <Meta label="Refs" value={refs.join(" · ")} />
          ) : null}
          {checks ? <Meta label="Integrity" value={`Checks · ${checks}`} /> : null}
          {reviewDecision ? <Meta label="Review" value={reviewDecision.replace(/_/g, " ")} /> : null}
        </Section>

        <People title="Co-authors" people={parsed.coauthors} empty="No co-authors on file." />
        <People title="Signers" people={parsed.signers} empty="No sign-offs on file." extra={signerExtra(detail, loading)} />
        <Section title="Reviewers">
          {reviewNames.length ? (
            <ul className="m-0 list-none p-0">
              {reviewNames.map((name) => (
                <li key={name} className="font-mono text-[12px] text-tva-paper">
                  <PersonName name={name} login={githubReviewers.includes(name) ? name : undefined} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={emptyText}>No reviewers on file.</p>
          )}
        </Section>
        <People title="Testers" people={parsed.testers} empty="No testers on file." />
        {parsed.others.length ? <People title="Other attestations" people={parsed.others} empty="" /> : null}

        <Section title="Affected files">
          {loading ? (
            <CaseFileDetailSkeleton />
          ) : (detail?.files ?? []).length === 0 ? (
            <p className={emptyText}>No files on this filing.</p>
          ) : (
            <div className="relative h-[min(22rem,50vh)] min-h-[12rem] overflow-hidden">
              <PierreFileTree files={detail?.files ?? []} selectedPath={null} onSelectPath={onOpenFile} />
            </div>
          )}
        </Section>
      </TvaScrollArea>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-tva-gold/14 pt-3">
      <h4 className={cn(eyebrow, "mb-2")}>{title}</h4>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="m-0 font-mono text-[11px] leading-snug text-tva-paper-dim">
      <span className="text-tva-muted">{label}</span> · {value}
    </p>
  );
}

function People({
  title,
  people,
  empty,
  extra,
}: {
  title: string;
  people: Trailer[];
  empty: string;
  extra?: string | null;
}) {
  return (
    <Section title={title}>
      {people.length ? (
        <ul className="m-0 list-none p-0">
          {people.map((person, i) => (
            <li key={`${person.key}-${person.value}-${i}`} className="font-mono text-[12px] text-tva-paper">
              <PersonName name={formatPerson(person.name, person.email)} email={person.email} />
            </li>
          ))}
        </ul>
      ) : extra ? (
        <p className="m-0 font-mono text-[12px] text-tva-paper">{extra}</p>
      ) : (
        <p className={emptyText}>{empty}</p>
      )}
    </Section>
  );
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp * 1000).toUTCString();
}

function sealLabel(signed: boolean, kind: string | null): string {
  if (!signed) return "Unsigned";
  if (kind === "ssh") return "SSH seal";
  if (kind === "gpg") return "GPG seal";
  return "Sealed";
}

function signerExtra(detail: CommitDetail | null, loading: boolean): string | null {
  if (!detail || loading || !detail.signed) return null;
  return sealLabel(true, detail.signatureKind);
}

function uniquePeople(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
