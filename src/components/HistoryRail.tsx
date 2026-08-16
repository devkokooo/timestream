import { cn } from "../lib/cn";
import { emptyText, stamp, stampGold } from "../lib/ui";
import { currentBranchName, listBranchHistory } from "../lib/timelineView";
import type { Timeline, TimelineNode } from "../lib/types";
import { PersonName } from "./PersonName";
import { TvaScrollArea } from "./TvaScrollArea";
import { TvaVirtualList } from "./TvaVirtualList";

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
  branch?: string | null;
}

export function HistoryRail({ timeline, selectedId, onSelect, branch }: Props) {
  const commits = listBranchHistory(timeline);
  const name = branch ?? currentBranchName(timeline);

  if (commits.length === 0) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-3 py-4">
        <p className={emptyText}>No events on the current sequence.</p>
      </TvaScrollArea>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-tva-gold/12 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-tva-muted">
        {name ?? "DETACHED"} · {commits.length} {commits.length === 1 ? "EVENT" : "EVENTS"}
      </div>
      <TvaVirtualList
        className="min-h-0 flex-1"
        axis="y"
        fill
        viewportClassName="px-3 py-3"
        count={commits.length}
        estimateSize={() => 78}
        getItemKey={(index) => commits[index].id}
      >
        {(index) => {
          const node = commits[index];
          return <EventCard node={node} selected={node.id === selectedId} onSelect={onSelect} />;
        }}
      </TvaVirtualList>
    </div>
  );
}

function EventCard({
  node,
  selected,
  onSelect,
}: {
  node: TimelineNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const merged = node.parents.length > 1;
  return (
    <button
      type="button"
      className={cn(
        "mb-2 w-full border border-tva-gold/18 p-2.5 text-left text-inherit",
        node.column === 0
          ? "bg-linear-to-b from-[#3a2a16] to-[#241910]"
          : "bg-linear-to-b from-[#2a221a] to-[#1e1914]",
        selected && "border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]",
      )}
      onClick={() => onSelect(node.id)}
    >
      <div className="flex justify-between font-mono text-xs">
        <span className={cn(selected && "font-semibold text-tva-gold-bright")}>{node.shortId}</span>
        <span className="flex gap-1">
          {node.isHead ? <span className={cn(stamp, stampGold)}>NOW</span> : null}
          {merged ? <span className={stamp}>MERGE</span> : null}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[11px] leading-snug text-tva-paper">{node.summary}</div>
      <div className="mt-1 flex items-center gap-1 text-[10px] tracking-[0.12em] text-tva-muted">
        <PersonName name={node.author} email={node.email} />
        <span>· {formatWhen(node.timestamp)}</span>
      </div>
    </button>
  );
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
