import { cn } from "@/ui/cn";
import { emptyText, panelTitle, stamp, stampGold } from "@/ui/ui";
import type { CommitDetail, TimelineNode } from "@/timeline/types";
import { PersonName } from "@/auth/PersonName";
import { CaseFileDetailSkeleton } from "@/ui/TvaSkeleton";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { PierreFileTree } from "@/diff/PierreFileTree";

interface Props {
  node: TimelineNode | null;
  detail: CommitDetail | null;
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
  onSelectCommit: (id: string) => void;
  checks?: string;
}

export function CaseFile({ node, detail, selectedPath, onOpenFile, onSelectCommit, checks }: Props) {
  if (!node) {
    return (
      <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#1b1713] p-0">
        <div className="shrink-0 px-4 pt-4 pb-2.5">
          <h2 className={panelTitle}>CASE FILE</h2>
        </div>
        <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-4 pb-4">
          <p className={emptyText}>Select a nexus event on the Sacred Timeline.</p>
        </TvaScrollArea>
      </aside>
    );
  }

  const loading = !detail || detail.id !== node.id;
  const parents = detail && !loading ? detail.parents : node.parents;
  const files = !loading ? (detail?.files ?? []) : [];
  const stampLabel = node.refs.some((r) => r.kind === "branch" && r.name !== "HEAD")
    ? node.column === 0
      ? "NEXUS"
      : "VARIANT"
    : "EVENT";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#1b1713] p-0">
      <div className="shrink-0 px-4 pt-4 pb-2.5">
        <div className="mb-0 flex items-start justify-between">
          <h2 className={panelTitle}>CASE FILE</h2>
          <div className="flex items-start gap-1.5">
            {node.isHead ? <span className={cn(stamp, stampGold)}>NOW</span> : null}
            <span className={cn(stamp, node.column === 0 && stampGold)}>{stampLabel}</span>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="h-[220px] max-h-[45%] shrink-0 overflow-hidden border-b border-tva-gold/16">
          <TvaScrollArea className="h-full min-h-0" axis="y" fill viewportClassName="px-4 pb-4">
            <div className="font-mono text-xs text-tva-gold">
              {detail && !loading ? detail.shortId : node.shortId}
            </div>
            <h3 className="m-0 mb-2 font-display text-lg leading-[1.35] tracking-[0.02em] text-tva-paper">
              {detail && !loading ? detail.summary : node.summary}
            </h3>
            {!loading && detail?.body ? (
              <p className="mb-3 text-xs leading-relaxed text-tva-paper-dim">{detail.body}</p>
            ) : null}
            <div className="mt-3 space-y-0.5 border-t border-tva-gold/12 pt-3 font-mono text-[11px] leading-snug text-tva-paper-dim">
              <p className="m-0">
                <PersonName
                  name={detail && !loading ? detail.author : node.author}
                  email={detail && !loading ? detail.email : node.email}
                />
                {detail && !loading && detail.email ? ` · ${detail.email}` : ""}
              </p>
              <p className="m-0">
                {new Date((detail && !loading ? detail.timestamp : node.timestamp) * 1000).toUTCString()}
              </p>
              {checks ? (
                <p className="m-0" title="GitHub Checks">
                  Integrity · Checks: {checks}
                </p>
              ) : null}
              <p className="m-0">
                parents{" "}
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
            </div>
          </TvaScrollArea>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <h2 className={cn(panelTitle, "mx-4 mt-2.5 mb-1.5 shrink-0")}>AFFECTED FILES</h2>
          {loading ? (
            <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-4 pb-4">
              <CaseFileDetailSkeleton />
            </TvaScrollArea>
          ) : files.length === 0 ? (
            <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-4 pb-4">
              <p className={emptyText}>No files on this filing.</p>
            </TvaScrollArea>
          ) : (
            <div className="relative min-h-0 flex-1 overflow-hidden px-2 pb-3">
              <PierreFileTree files={files} selectedPath={selectedPath} onSelectPath={onOpenFile} />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
