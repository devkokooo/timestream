import { cn } from "@/ui/cn";
import { emptyText, stamp, stampGold } from "@/ui/ui";
import { threatCopy } from "@/timeline/timelineView";
import type { Timeline, VariantDossier } from "@/timeline/types";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { TvaVirtualList } from "@/ui/TvaVirtualList";

interface Props {
  timeline: Timeline;
  onCheckout: (name: string) => void;
  busy: boolean;
  prByBranch?: Record<string, number>;
  aheadBehind?: { ahead: number; behind: number } | null;
}

export function VariantRail({ timeline, onCheckout, busy, prByBranch, aheadBehind }: Props) {
  if (timeline.dossiers.length === 0) {
    return (
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-3 py-4">
        <p className={emptyText}>No variant dossiers on this timeline.</p>
      </TvaScrollArea>
    );
  }

  return (
    <TvaVirtualList
      className="min-h-0 flex-1"
      axis="y"
      fill
      viewportClassName="px-3 py-3"
      count={timeline.dossiers.length}
      estimateSize={() => 88}
      getItemKey={(index) => timeline.dossiers[index].name}
    >
      {(index) => {
        const d = timeline.dossiers[index];
        return (
          <DossierCard
            dossier={d}
            onCheckout={onCheckout}
            busy={busy}
            prNumber={prByBranch?.[d.name]}
            sync={d.isHead ? aheadBehind : null}
          />
        );
      }}
    </TvaVirtualList>
  );
}

function DossierCard({
  dossier,
  onCheckout,
  busy,
  prNumber,
  sync,
}: {
  dossier: VariantDossier;
  onCheckout: (name: string) => void;
  busy: boolean;
  prNumber?: number;
  sync?: { ahead: number; behind: number } | null;
}) {
  return (
    <button
      type="button"
      className={cn(
        "mb-2 w-full border border-tva-gold/18 p-2.5 text-left text-inherit",
        dossier.isSacred
          ? "bg-linear-to-b from-[#3a2a16] to-[#241910]"
          : "bg-linear-to-b from-[#2a221a] to-[#1e1914]",
        dossier.isHead && "border-tva-gold-bright shadow-[inset_0_0_0_1px_rgba(244,196,48,0.45)]",
      )}
      onClick={() => onCheckout(dossier.name)}
      disabled={busy || dossier.isHead}
    >
      <div className="flex justify-between font-mono text-xs">
        <span className={cn(dossier.isHead && "font-semibold text-tva-gold-bright")}>{dossier.name}</span>
        {dossier.isHead ? (
          <span className={cn(stamp, stampGold)}>NOW</span>
        ) : dossier.isSacred ? (
          <span className={cn(stamp, stampGold)}>SACRED</span>
        ) : dossier.isUpstream ? (
          <span className={stamp} title="Remote-tracking branch">
            UPSTREAM
          </span>
        ) : (
          <span className={stamp}>VARIANT</span>
        )}
      </div>
      {prNumber ? (
        <div className="mt-1">
          <span className={stamp} title="Open pull request">
            REQUEST #{prNumber}
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "mt-1.5 text-[10px] tracking-[0.12em] text-tva-muted",
          dossier.threat === "severe" && "text-[#ff8a6a]",
          dossier.threat === "moderate" && "text-tva-gold-bright",
        )}
      >
        {dossier.isSacred
          ? "PRIMARY SEQUENCE"
          : `${threatCopy(dossier.threat)} · ${dossier.exclusiveCommits} exclusive · ${dossier.commitsApart} apart`}
        {sync ? ` · ↑${sync.ahead} ↓${sync.behind}` : ""}
      </div>
    </button>
  );
}
