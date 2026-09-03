import { cn } from "@/ui/cn";
import { btn, btnDanger, btnStow } from "@/ui/ui";
import { TvaTerm } from "@/ui/TvaTerm";

interface Props {
  name: string | null;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

export function CullSealConfirm({ name, onCancel, onConfirm }: Props) {
  if (!name) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-6 z-50 bg-black/45"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-label="Cull seal"
        className="absolute bottom-1 left-1 w-[min(360px,calc(100vw-8px))] border border-tva-gold/30 bg-[#1b1713] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 mb-2">
          <TvaTerm flavor="Cull seal" noun={`Delete local tag ${name}`} />
        </h2>
        <p className="m-0 mb-3 font-mono text-[11px] text-tva-paper-dim">
          Remove <span className="text-tva-gold-bright">{name}</span> from this archive. Remotes are
          unchanged.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnStow} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={cn(btn, btnDanger)} onClick={() => onConfirm(name)}>
            Cull
          </button>
        </div>
      </div>
    </div>
  );
}
