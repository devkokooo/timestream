import { cn } from "../lib/cn";
import { emptyText, stamp, stampGold } from "../lib/ui";
import { listTimelineTags, type TimelineTag } from "../lib/timelineView";
import type { Timeline } from "../lib/types";
import { PersonName } from "./PersonName";
import { TvaScrollArea } from "./TvaScrollArea";
import { TvaVirtualList } from "./TvaVirtualList";

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TagsRail({ timeline, selectedId, onSelect }: Props) {
  const tags = listTimelineTags(timeline);
  if (tags.length === 0) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-3 py-4">
        <p className={emptyText}>No canon seals on this timeline.</p>
      </TvaScrollArea>
    );
  }

  return (
    <TvaVirtualList
      className="min-h-0 flex-1"
      axis="y"
      fill
      viewportClassName="px-3 py-3"
      count={tags.length}
      estimateSize={() => 78}
      getItemKey={(index) => tags[index].name}
    >
      {(index) => {
        const tag = tags[index];
        return <SealCard tag={tag} selected={tag.id === selectedId} onSelect={onSelect} />;
      }}
    </TvaVirtualList>
  );
}

function SealCard({
  tag,
  selected,
  onSelect,
}: {
  tag: TimelineTag;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "mb-2 w-full border border-tva-gold/18 p-2.5 text-left text-inherit",
        tag.isSacred
          ? "bg-linear-to-b from-[#3a2a16] to-[#241910]"
          : "bg-linear-to-b from-[#2a221a] to-[#1e1914]",
        selected && "border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]",
      )}
      onClick={() => onSelect(tag.id)}
    >
      <div className="flex justify-between font-mono text-xs">
        <span className={cn(selected && "font-semibold text-tva-gold-bright")}>{tag.name}</span>
        <span className="flex gap-1">
          {tag.isHead ? <span className={cn(stamp, stampGold)}>NOW</span> : null}
          <span className={cn(stamp, tag.isSacred && stampGold)}>{tag.isSacred ? "CANON" : "VARIANT"}</span>
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[11px] leading-snug text-tva-paper">
        {tag.shortId} · {tag.summary}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10px] tracking-[0.12em] text-tva-muted">
        <PersonName name={tag.author} email={tag.email} />
        <span>· {formatSealWhen(tag.timestamp)}</span>
      </div>
    </button>
  );
}

function formatSealWhen(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
