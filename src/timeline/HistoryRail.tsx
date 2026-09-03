import { useState, type MouseEvent } from "react";
import { cn } from "@/ui/cn";
import { emptyText, stamp, stampGold } from "@/ui/ui";
import { currentBranchName, listBranchHistory } from "@/timeline/timelineView";
import type { Timeline, TimelineNode } from "@/timeline/types";
import { PersonName } from "@/auth/PersonName";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { TvaVirtualList } from "@/ui/TvaVirtualList";
import {
  menuAtPointer,
  TvaContextMenu,
  type TvaContextMenuState,
} from "@/ui/TvaContextMenu";

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
  branch?: string | null;
  onSealNexus?: (node: TimelineNode) => void;
  onOpenDossier?: (id: string) => void;
  onCullTag?: (name: string) => void;
}

export function HistoryRail({
  timeline,
  selectedId,
  onSelect,
  branch,
  onSealNexus,
  onOpenDossier,
  onCullTag,
}: Props) {
  const commits = listBranchHistory(timeline);
  const name = branch ?? currentBranchName(timeline);
  const [contextMenu, setContextMenu] = useState<TvaContextMenuState | null>(null);

  if (commits.length === 0) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-3 py-4">
        <p className={emptyText}>No events on the current sequence.</p>
      </TvaScrollArea>
    );
  }

  function openMenu(e: MouseEvent, node: TimelineNode) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(node.id);
    const tags = node.refs.filter((r) => r.kind === "tag").map((r) => r.name);
    setContextMenu(
      menuAtPointer(e, [
        {
          id: "seal",
          label: "Seal this nexus",
          onSelect: () => onSealNexus?.(node),
          disabled: !onSealNexus,
        },
        {
          id: "dossier",
          label: "Open dossier",
          onSelect: () => onOpenDossier?.(node.id),
          disabled: !onOpenDossier,
        },
        ...tags.map((tagName) => ({
          id: `cull-${tagName}`,
          label: `Cull seal · ${tagName}`,
          danger: true as const,
          disabled: !onCullTag,
          onSelect: () => onCullTag?.(tagName),
        })),
      ]),
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
          return (
            <EventCard
              node={node}
              selected={node.id === selectedId}
              onOpen={onOpenDossier ?? onSelect}
              onContextMenu={(e) => openMenu(e, node)}
            />
          );
        }}
      </TvaVirtualList>
      <TvaContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
}

function EventCard({
  node,
  selected,
  onOpen,
  onContextMenu,
}: {
  node: TimelineNode;
  selected: boolean;
  onOpen: (id: string) => void;
  onContextMenu: (e: MouseEvent) => void;
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
      onClick={() => onOpen(node.id)}
      onContextMenu={onContextMenu}
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
