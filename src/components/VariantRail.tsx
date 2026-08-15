import { threatCopy } from "../lib/timelineView";
import type { Timeline, VariantDossier } from "../lib/types";

interface Props {
  timeline: Timeline;
  onCheckout: (name: string) => void;
  busy: boolean;
}

export function VariantRail({ timeline, onCheckout, busy }: Props) {
  return (
    <aside className="rail">
      <h2 className="panel-title">VARIANT DOSSIERS</h2>
      {timeline.dossiers.map((d) => (
        <DossierCard
          key={d.name}
          dossier={d}
          onCheckout={onCheckout}
          busy={busy}
        />
      ))}
    </aside>
  );
}

function DossierCard({
  dossier,
  onCheckout,
  busy,
}: {
  dossier: VariantDossier;
  onCheckout: (name: string) => void;
  busy: boolean;
}) {
  return (
    <button
      className={`dossier ${dossier.isSacred ? "sacred" : ""} ${dossier.isHead ? "active" : ""}`}
      onClick={() => onCheckout(dossier.name)}
      disabled={busy || dossier.isHead}
    >
      <div className="dossier-name">
        <span>{dossier.name}</span>
        {dossier.isSacred ? (
          <span className="stamp gold">SACRED</span>
        ) : (
          <span className="stamp">VARIANT</span>
        )}
      </div>
      <div className={`threat ${dossier.threat}`}>
        {dossier.isSacred
          ? "PRIMARY SEQUENCE"
          : `${threatCopy(dossier.threat)} · ${dossier.exclusiveCommits} exclusive · ${dossier.commitsApart} apart`}
      </div>
    </button>
  );
}
