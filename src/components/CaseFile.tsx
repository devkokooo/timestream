import { cn } from "../lib/cn";
import {
  actionColor,
  emptyText,
  panelTitle,
  stamp,
  stampGold,
} from "../lib/ui";
import { actionLabel, fileAction, fileDisplayPath } from "../lib/diffView";
import type { CommitDetail, FileChange, TimelineNode } from "../lib/types";
import { CaseFileDetailSkeleton } from "./TvaSkeleton";
import { TvaScrollArea } from "./TvaScrollArea";

interface Props {
  node: TimelineNode | null;
  detail: CommitDetail | null;
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
}

export function CaseFile({ node, detail, selectedPath, onOpenFile }: Props) {
  if (!node) {
    return (
      <aside className="flex min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#1b1713] p-0">
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
  const stampLabel = node.refs.some((r) => r.kind === "branch" && r.name !== "HEAD")
    ? node.column === 0
      ? "NEXUS"
      : "VARIANT"
    : "EVENT";

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-tva-gold/16 bg-[#1b1713] p-0">
      <div className="shrink-0 px-4 pt-4 pb-2.5">
        <div className="mb-0 flex items-start justify-between">
          <h2 className={panelTitle}>CASE FILE</h2>
          <span className={cn(stamp, node.column === 0 && stampGold)}>{stampLabel}</span>
        </div>
      </div>
      <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden">
        <div className="h-[220px] max-h-[45%] shrink-0 overflow-hidden border-b border-tva-gold/16">
          <TvaScrollArea className="h-full min-h-0" axis="y" fill viewportClassName="px-4 pb-4">
            <div className="font-mono text-xs text-tva-gold">
              {detail && !loading ? detail.shortId : node.shortId}
            </div>
            <h3 className="m-0 mb-2 font-display text-lg leading-[1.35] tracking-[0.02em]">
              {detail && !loading ? detail.summary : node.summary}
            </h3>
            {!loading && detail?.body ? <p className={cn(emptyText, "mb-0")}>{detail.body}</p> : null}
            <p className={cn(emptyText, "mb-0")}>
              {detail && !loading ? detail.author : node.author}
              {detail && !loading && detail.email ? ` · ${detail.email}` : ""}
            </p>
            <p className={cn(emptyText, "mb-0")}>
              {new Date((detail && !loading ? detail.timestamp : node.timestamp) * 1000).toUTCString()}
            </p>
            <p className={cn(emptyText, "mb-0")}>
              parents{" "}
              {(detail && !loading ? detail.parents : node.parents)
                .map((p) => p.slice(0, 7))
                .join(", ") || "none"}
            </p>
          </TvaScrollArea>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <h2 className={cn(panelTitle, "mx-4 mt-2.5 mb-1.5 shrink-0")}>AFFECTED FILES</h2>
          <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-4 pb-4">
            {loading ? (
              <CaseFileDetailSkeleton />
            ) : (
              (detail?.files ?? []).map((file) => (
                <FileRow
                  key={`${file.status}-${file.path}`}
                  file={file}
                  selected={selectedPath === file.path}
                  onOpen={() => onOpenFile(file.path)}
                />
              ))
            )}
          </TvaScrollArea>
        </div>
      </div>
    </aside>
  );
}

function FileRow({
  file,
  selected,
  onOpen,
}: {
  file: FileChange;
  selected: boolean;
  onOpen: () => void;
}) {
  const action = fileAction(file.status);
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-baseline justify-between gap-2 border-0 border-b border-dashed border-tva-gold/12 bg-transparent px-1 py-1.5 text-left font-mono text-xs hover:bg-tva-orange/8",
        actionColor[action],
        selected && "bg-tva-orange/14 shadow-[inset_3px_0_0_var(--color-tva-orange)]",
      )}
      onClick={onOpen}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {fileDisplayPath(file)}
      </span>
      <span className="shrink-0 text-[10px] tracking-[0.12em]">{actionLabel(action)}</span>
    </button>
  );
}
