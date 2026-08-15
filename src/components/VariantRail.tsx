import { cn } from "../lib/cn";
import { panelTitle, stamp, stampGold } from "../lib/ui";
import { threatCopy } from "../lib/timelineView";
import type { Timeline, VariantDossier } from "../lib/types";
import { TvaScrollArea } from "./TvaScrollArea";

interface Props {
  timeline: Timeline;
  onCheckout: (name: string) => void;
  busy: boolean;
  prByBranch?: Record<string, number>;
  aheadBehind?: { ahead: number; behind: number } | null;
}

export function VariantRail({ timeline, onCheckout, busy, prByBranch, aheadBehind }: Props) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-tva-gold/16 bg-[#1b1713] p-0">
      <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="px-3 py-3.5 pb-5">
        <h2 className={cn(panelTitle, "mb-2.5")}>VARIANT DOSSIERS</h2>
        {timeline.dossiers.map((d) => (
          <DossierCard
            key={d.name}
            dossier={d}
            onCheckout={onCheckout}
            busy={busy}
            prNumber={prByBranch?.[d.name]}
            sync={d.isHead ? aheadBehind : null}
          />
        ))}
      </TvaScrollArea>
    </aside>
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
        dossier.isHead && "border-tva-orange shadow-[inset_0_0_0_1px_rgba(232,93,4,0.35)]",
      )}
      onClick={() => onCheckout(dossier.name)}
      disabled={busy || dossier.isHead}
    >
      <div className="flex justify-between font-mono text-xs">
        <span>{dossier.name}</span>
        {dossier.isSacred ? (
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
