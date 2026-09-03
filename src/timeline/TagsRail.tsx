import { useState, type MouseEvent } from "react";
import { cn } from "@/ui/cn";
import { btn, btnDanger, btnStow, emptyText, stamp, stampGold } from "@/ui/ui";
import { listTimelineTags, type TimelineTag } from "@/timeline/timelineView";
import type { Timeline } from "@/timeline/types";
import { PersonName } from "@/auth/PersonName";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { TvaVirtualList } from "@/ui/TvaVirtualList";
import { TvaTerm } from "@/ui/TvaTerm";
import {
  menuAtPointer,
  TvaContextMenu,
  type TvaContextMenuState,
} from "@/ui/TvaContextMenu";

interface Props {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canFileSeal?: boolean;
  canPush?: boolean;
  busy?: boolean;
  onFileSeal?: () => void;
  onCullLocal?: (name: string) => void;
  onPush?: (name: string) => void;
  onCullRemote?: (name: string) => void;
}

export function TagsRail({
  timeline,
  selectedId,
  onSelect,
  canFileSeal = false,
  canPush = false,
  busy = false,
  onFileSeal,
  onCullLocal,
  onPush,
  onCullRemote,
}: Props) {
  const tags = listTimelineTags(timeline);
  const [contextMenu, setContextMenu] = useState<TvaContextMenuState | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmRemote, setConfirmRemote] = useState<string | null>(null);

  function openSealMenu(e: MouseEvent, tag: TimelineTag) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(null);
    setConfirmRemote(null);
    setContextMenu(
      menuAtPointer(e, [
        {
          id: "select",
          label: "Show on timeline",
          onSelect: () => onSelect(tag.id),
        },
        {
          id: "push",
          label: "Dispatch to origin",
          disabled: !canPush || !onPush || busy,
          onSelect: () => onPush?.(tag.name),
        },
        {
          id: "cull-local",
          label: "Cull local seal",
          danger: true,
          disabled: !onCullLocal || busy,
          onSelect: () => setConfirming(tag.name),
        },
        {
          id: "cull-remote",
          label: "Cull on origin",
          danger: true,
          disabled: !canPush || !onCullRemote || busy,
          onSelect: () => setConfirmRemote(tag.name),
        },
      ]),
    );
  }

  const body =
    tags.length === 0 ? (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-3 py-4">
        <p className={emptyText}>No canon seals on this timeline.</p>
        <p className={cn(emptyText, "mt-2")}>Right-click a nexus to file a seal.</p>
      </TvaScrollArea>
    ) : (
      <TvaVirtualList
        className="min-h-0 flex-1"
        axis="y"
        fill
        viewportClassName="px-3 py-3"
        count={tags.length}
        estimateSize={() => (confirming || confirmRemote ? 110 : 78)}
        getItemKey={(index) => tags[index].name}
      >
        {(index) => {
          const tag = tags[index];
          return (
            <SealCard
              tag={tag}
              selected={tag.id === selectedId}
              confirming={confirming === tag.name}
              confirmingRemote={confirmRemote === tag.name}
              busy={busy}
              onSelect={onSelect}
              onContextMenu={(e) => openSealMenu(e, tag)}
              onCancelConfirm={() => {
                setConfirming(null);
                setConfirmRemote(null);
              }}
              onConfirmCull={() => {
                onCullLocal?.(tag.name);
                setConfirming(null);
              }}
              onConfirmCullRemote={() => {
                onCullRemote?.(tag.name);
                setConfirmRemote(null);
              }}
            />
          );
        }}
      </TvaVirtualList>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {body}
      <div className="flex shrink-0 items-center gap-2 border-t border-tva-gold/16 px-3 py-2">
        <button
          type="button"
          className={btn}
          disabled={!canFileSeal || !onFileSeal || busy}
          title={canFileSeal ? "File a seal on the selected nexus" : "Select a nexus first"}
          onClick={() => onFileSeal?.()}
        >
          <TvaTerm flavor="+ File seal" noun="Create tag" />
        </button>
      </div>
      <TvaContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
}

function SealCard({
  tag,
  selected,
  confirming,
  confirmingRemote,
  busy,
  onSelect,
  onContextMenu,
  onCancelConfirm,
  onConfirmCull,
  onConfirmCullRemote,
}: {
  tag: TimelineTag;
  selected: boolean;
  confirming: boolean;
  confirmingRemote: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (e: MouseEvent) => void;
  onCancelConfirm: () => void;
  onConfirmCull: () => void;
  onConfirmCullRemote: () => void;
}) {
  return (
    <div
      className={cn(
        "mb-2 w-full border border-tva-gold/18 p-2.5 text-left text-inherit",
        tag.isSacred
          ? "bg-linear-to-b from-[#3a2a16] to-[#241910]"
          : "bg-linear-to-b from-[#2a221a] to-[#1e1914]",
        selected && "border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]",
      )}
    >
      <button
        type="button"
        className="w-full border-0 bg-transparent p-0 text-left text-inherit"
        onClick={() => onSelect(tag.id)}
        onContextMenu={onContextMenu}
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
      {confirming ? (
        <div className="mt-2 flex items-center justify-end gap-1 border-t border-tva-gold/12 pt-2">
          <span className="mr-auto text-[10px] uppercase tracking-[0.12em] text-[#f3c2b8]">Cull local?</span>
          <button type="button" className={btnStow} disabled={busy} onClick={onCancelConfirm}>
            Cancel
          </button>
          <button type="button" className={cn(btn, btnDanger)} disabled={busy} onClick={onConfirmCull}>
            Cull
          </button>
        </div>
      ) : null}
      {confirmingRemote ? (
        <div className="mt-2 flex items-center justify-end gap-1 border-t border-tva-gold/12 pt-2">
          <span className="mr-auto text-[10px] uppercase tracking-[0.12em] text-[#f3c2b8]">Cull on origin?</span>
          <button type="button" className={btnStow} disabled={busy} onClick={onCancelConfirm}>
            Cancel
          </button>
          <button type="button" className={cn(btn, btnDanger)} disabled={busy} onClick={onConfirmCullRemote}>
            Cull
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatSealWhen(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
